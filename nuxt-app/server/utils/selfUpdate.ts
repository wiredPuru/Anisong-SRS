import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { unzip } from "fflate";
import {
  getReleaseLookup,
  isNewerVersion,
  pickPlatformAsset,
  USER_AGENT,
  type ReleaseAsset,
} from "./version.ts";

export type SelfUpdateUnavailableReason =
  | "not-packaged"
  | "up-to-date"
  | "no-asset"
  | "no-digest"
  | "not-writable"
  | "check-failed";

export type SelfUpdateAvailability =
  | { available: true }
  | { available: false; reason: SelfUpdateUnavailableReason };

export interface SelfUpdateAvailabilityInput {
  installDir: string | null;
  current: string;
  latest: string | null;
  checkFailed: boolean;
  asset: ReleaseAsset | null;
  writable: boolean;
}

export function selfUpdateAvailability(
  input: SelfUpdateAvailabilityInput,
): SelfUpdateAvailability {
  if (!input.installDir) return { available: false, reason: "not-packaged" };
  if (input.checkFailed) return { available: false, reason: "check-failed" };
  if (!input.latest || !isNewerVersion(input.latest, input.current)) {
    return { available: false, reason: "up-to-date" };
  }
  if (!input.asset) return { available: false, reason: "no-asset" };
  if (!input.asset.digest) return { available: false, reason: "no-digest" };
  if (!input.writable) return { available: false, reason: "not-writable" };
  return { available: true };
}

// Actually creates a file: fs.access(W_OK) reports Windows folders like
// Program Files as writable when they are not.
export async function probeWritable(dir: string): Promise<boolean> {
  const probe = join(dir, `.gaq-srs-write-probe-${randomBytes(6).toString("hex")}`);
  try {
    await writeFile(probe, "", { flag: "wx" });
  } catch {
    return false;
  }
  await unlink(probe).catch(() => {});
  return true;
}

export interface SelfUpdateStatus {
  state: "unavailable" | "idle" | "downloading" | "verifying" | "unpacking" | "ready" | "failed";
  reason: SelfUpdateUnavailableReason | null;
  version: string | null;
  receivedBytes: number;
  totalBytes: number | null;
  error: string | null;
}

// F-21 is a whole-body timeout failing every large download at 30s. These zips
// are 40-60MB, so only a stall (no bytes for this long) counts as a failure.
const IDLE_TIMEOUT_MS = 30_000;

export function resolveUpdatesDir(env: { GAQ_SRS_DATA_DIR?: string }, cwd: string): string {
  return env.GAQ_SRS_DATA_DIR
    ? resolve(env.GAQ_SRS_DATA_DIR, "updates")
    : resolve(cwd, ".data/updates");
}

// The download URL only ever comes from the server's own GitHub lookup, but it
// is still checked so a changed API response cannot point the job elsewhere.
export function isAllowedAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "github.com";
  } catch {
    return false;
  }
}

export function verifyDownload(
  actual: { sha256: string; bytes: number },
  expected: { digest: string; size: number | null },
): string | null {
  if (expected.size !== null && actual.bytes !== expected.size) {
    return "The download was incomplete. Try again.";
  }
  if (actual.sha256 !== expected.digest) {
    return "The download did not match the published release. Try again.";
  }
  return null;
}

export type DownloadResult = { ok: true; zipPath: string } | { ok: false; error: string };

export interface DownloadOptions {
  fetchImpl?: typeof fetch;
  idleTimeoutMs?: number;
  onBytes?: (receivedBytes: number) => void;
  onVerifying?: () => void;
}

export async function downloadAndVerify(
  asset: ReleaseAsset & { digest: string },
  updatesDir: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  const { fetchImpl = fetch, idleTimeoutMs = IDLE_TIMEOUT_MS, onBytes, onVerifying } = options;
  if (!isAllowedAssetUrl(asset.url)) {
    return { ok: false, error: "The release download link was not a GitHub address." };
  }

  await mkdir(updatesDir, { recursive: true });
  const partialPath = join(updatesDir, "download.zip.partial");
  const zipPath = join(updatesDir, "download.zip");
  await rm(partialPath, { force: true });
  await rm(zipPath, { force: true });

  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
  };

  const hash = createHash("sha256");
  let received = 0;
  const file = await open(partialPath, "w");
  try {
    resetIdle();
    const response = await fetchImpl(asset.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`GitHub responded ${response.status}`);

    const reader = response.body.getReader();
    while (true) {
      resetIdle();
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      await file.write(value);
      received += value.byteLength;
      onBytes?.(received);
    }
  } catch {
    await file.close();
    await rm(partialPath, { force: true });
    return {
      ok: false,
      error: controller.signal.aborted
        ? "The download stalled. Check your connection and try again."
        : "The download failed. Check your connection and try again.",
    };
  } finally {
    clearTimeout(idleTimer);
  }
  await file.close();

  onVerifying?.();
  const mismatch = verifyDownload(
    { sha256: hash.digest("hex"), bytes: received },
    { digest: asset.digest, size: asset.size },
  );
  if (mismatch) {
    await rm(partialPath, { force: true });
    return { ok: false, error: mismatch };
  }

  await rename(partialPath, zipPath);
  return { ok: true, zipPath };
}

export function binaryNameFor(platform: string): string {
  return platform === "win32" ? "gaq-srs.exe" : "gaq-srs";
}

// Zip-slip guard: an entry may only land inside the staging folder.
export function safeEntryPath(root: string, entryName: string): string | null {
  if (!entryName || entryName.includes("\0")) return null;
  if (/^[\\/]/.test(entryName) || /^[a-zA-Z]:/.test(entryName)) return null;
  if (entryName.split(/[\\/]/).some((segment) => segment === "..")) return null;

  const base = resolve(root);
  const target = resolve(base, entryName);
  return target.startsWith(base + sep) ? target : null;
}

export type StagedLayoutCheck = { ok: true; binaryName: string } | { ok: false; missing: string[] };

export function checkStagedLayout(fileList: string[], platform: string): StagedLayoutCheck {
  const binaryName = binaryNameFor(platform);
  const names = fileList.map((name) => name.replace(/\\/g, "/"));
  const required: [string, (name: string) => boolean][] = [
    [binaryName, (name) => name === binaryName],
    ["migrations/meta/_journal.json", (name) => name === "migrations/meta/_journal.json"],
    ["public/", (name) => name.startsWith("public/")],
    ["kuromoji/dict/", (name) => name.startsWith("kuromoji/dict/")],
  ];
  const missing = required.filter(([, test]) => !names.some(test)).map(([label]) => label);
  return missing.length ? { ok: false, missing } : { ok: true, binaryName };
}

export interface ReadyManifest {
  version: string;
  assetName: string;
  sha256: string;
  binaryName: string;
  stagedAt: string;
}

export function parseReadyManifest(raw: unknown): ReadyManifest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const keys = ["version", "assetName", "sha256", "binaryName", "stagedAt"] as const;
  if (keys.some((key) => typeof record[key] !== "string" || !record[key])) return null;
  const { version, assetName, sha256, binaryName, stagedAt } = record as Record<
    (typeof keys)[number],
    string
  >;
  return { version, assetName, sha256, binaryName, stagedAt };
}

const unzipAsync = promisify(unzip);

export async function unpackAndStage(
  zipPath: string,
  updatesDir: string,
  release: { version: string; assetName: string; sha256: string },
  platform: string = process.platform,
): Promise<{ ok: true; manifest: ReadyManifest } | { ok: false; error: string }> {
  const stagedDir = join(updatesDir, "staged");
  await rm(stagedDir, { recursive: true, force: true });

  let files: Record<string, Uint8Array>;
  try {
    files = await unzipAsync(await readFile(zipPath));
  } catch {
    await rm(zipPath, { force: true });
    return { ok: false, error: "The update could not be unpacked. Try again." };
  }

  const layout = checkStagedLayout(Object.keys(files), platform);
  const entries = Object.entries(files).map(([name, data]) => ({
    name,
    data,
    target: safeEntryPath(stagedDir, name),
  }));
  if (!layout.ok || entries.some((entry) => !entry.target)) {
    await rm(zipPath, { force: true });
    return { ok: false, error: "The update package is not laid out as expected." };
  }

  try {
    await mkdir(stagedDir, { recursive: true });
    for (const { name, data, target } of entries) {
      if (name.endsWith("/")) {
        await mkdir(target!, { recursive: true });
      } else {
        await mkdir(dirname(target!), { recursive: true });
        await writeFile(target!, data);
      }
    }
    // fflate does not keep Unix permission bits, so the binary comes out
    // non-executable without this.
    await chmod(join(stagedDir, layout.binaryName), 0o755);

    const manifest: ReadyManifest = {
      ...release,
      binaryName: layout.binaryName,
      stagedAt: new Date().toISOString(),
    };
    // Written last: 82b trusts a staging folder only once this exists.
    await writeFile(join(stagedDir, "ready.json"), JSON.stringify(manifest, null, 2));
    await rm(zipPath, { force: true });
    return { ok: true, manifest };
  } catch {
    await rm(stagedDir, { recursive: true, force: true });
    await rm(zipPath, { force: true });
    return { ok: false, error: "The update could not be saved. Try again." };
  }
}

// A staged build survives a relaunch. One that is no longer newer than the
// running version (already installed, or a downgrade) is deleted instead.
async function readStagedRelease(updatesDir: string, current: string): Promise<ReadyManifest | null> {
  const stagedDir = join(updatesDir, "staged");
  let manifest: ReadyManifest | null;
  try {
    manifest = parseReadyManifest(JSON.parse(await readFile(join(stagedDir, "ready.json"), "utf8")));
  } catch {
    return null;
  }
  if (manifest && isNewerVersion(manifest.version, current)) return manifest;
  await rm(stagedDir, { recursive: true, force: true });
  return null;
}

type Job = Omit<SelfUpdateStatus, "reason">;

let job: Job | null = null;

function jobStatus(current: Job): SelfUpdateStatus {
  const { state, version, receivedBytes, totalBytes, error } = current;
  return { state, reason: null, version, receivedBytes, totalBytes, error };
}

function isRunning(current: Job | null): boolean {
  return (
    current?.state === "downloading" ||
    current?.state === "verifying" ||
    current?.state === "unpacking"
  );
}

async function resolveTarget(current: string) {
  const installDir = process.env.GAQ_SRS_INSTALL_DIR || null;
  const lookup = await getReleaseLookup();
  const asset = pickPlatformAsset(lookup.assets, process.platform, process.arch);
  const input = {
    installDir,
    current,
    latest: lookup.latest,
    checkFailed: lookup.checkFailed,
    asset,
    writable: true,
  };
  // Only probe the install folder once every cheaper condition already holds.
  let availability = selfUpdateAvailability(input);
  if (availability.available && installDir) {
    availability = selfUpdateAvailability({ ...input, writable: await probeWritable(installDir) });
  }
  return { availability, asset, latest: lookup.latest };
}

function emptyStatus(
  state: SelfUpdateStatus["state"],
  reason: SelfUpdateStatus["reason"],
  version: string | null,
): SelfUpdateStatus {
  return { state, reason, version, receivedBytes: 0, totalBytes: null, error: null };
}

function updatesDir(): string {
  return resolveUpdatesDir(process.env, process.cwd());
}

export async function getSelfUpdateStatus(current: string): Promise<SelfUpdateStatus> {
  if (job && job.state !== "ready") return jobStatus(job);

  if (process.env.GAQ_SRS_INSTALL_DIR) {
    const staged = await readStagedRelease(updatesDir(), current);
    if (staged) return emptyStatus("ready", null, staged.version);
    job = null;
  }

  const { availability, latest } = await resolveTarget(current);
  if (!availability.available) return emptyStatus("unavailable", availability.reason, null);
  return emptyStatus("idle", null, latest);
}

// Starts the job and returns at once; the page polls getSelfUpdateStatus. The
// client sends nothing, so what gets downloaded is decided here alone.
export async function startSelfUpdate(current: string): Promise<SelfUpdateStatus> {
  const status = await getSelfUpdateStatus(current);
  if (status.state !== "idle" && status.state !== "failed") return status;

  const { availability, asset, latest } = await resolveTarget(current);
  if (!availability.available || !asset?.digest) return getSelfUpdateStatus(current);
  const verifiedAsset = { ...asset, digest: asset.digest };

  const running: Job = {
    state: "downloading",
    version: latest,
    receivedBytes: 0,
    totalBytes: asset.size,
    error: null,
  };
  job = running;
  void runJob(running, verifiedAsset);
  return jobStatus(running);
}

async function runJob(running: Job, asset: ReleaseAsset & { digest: string }): Promise<void> {
  const fail = (error: string) => {
    running.state = "failed";
    running.error = error;
  };
  try {
    const dir = updatesDir();
    const downloaded = await downloadAndVerify(asset, dir, {
      onBytes: (bytes) => {
        running.receivedBytes = bytes;
      },
      onVerifying: () => {
        running.state = "verifying";
      },
    });
    if (!downloaded.ok) return fail(downloaded.error);

    running.state = "unpacking";
    const staged = await unpackAndStage(downloaded.zipPath, dir, {
      version: running.version ?? "",
      assetName: asset.name,
      sha256: asset.digest,
    });
    if (!staged.ok) return fail(staged.error);
    running.state = "ready";
  } catch {
    fail("The update could not be saved. Try again.");
  }
}
