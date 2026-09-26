// The repo name deliberately differs from the local directory name (GAQ_SRS);
// never derive it from the folder.
export const GITHUB_REPO = "wiredPuru/Anisong-SRS";

// GitHub rejects API requests that send no User-Agent. Same trap that already
// cost this project two fixes: animethemes.moe (feature 3) and the packaged
// Windows AniList 403 (feature 48).
export const USER_AGENT = "GAQ-SRS/1.0 (personal AMQ study app)";
const REQUEST_TIMEOUT_MS = 5000;

// A packaged app is launched fresh per session, so a long success TTL means
// roughly one call per launch, far inside GitHub's 60/hour unauthenticated
// limit. Failures are re-tried sooner, but not on every page load.
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;

export interface UpdateStatus {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  downloadUrl: string | null;
  releaseNotes: string | null;
  checkFailed: boolean;
  checkedAt: string;
}

export interface ReleaseAsset {
  name: string;
  url: string;
  digest: string | null;
  size: number | null;
}

// Only the remote lookup is cached. `updateAvailable` is recomputed per call
// against the running version, so a cached result can never outlive the
// version it was compared against.
export interface ReleaseLookup {
  latest: string | null;
  releaseUrl: string | null;
  releaseNotes: string | null;
  assets: ReleaseAsset[];
  checkFailed: boolean;
  checkedAt: string;
}

let cached: { lookup: ReleaseLookup; expiresAt: number } | null = null;

function parseVersion(raw: string): number[] | null {
  const trimmed = raw.trim().replace(/^v/i, "");
  if (!trimmed) return null;

  const parts = trimmed.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0)) return null;

  return parts;
}

// Compared part by part as numbers, never as strings: "1.10.0" < "1.9.0"
// lexically, which would hide every release past x.9.
export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  if (!latestParts || !currentParts) return false;

  const length = Math.max(latestParts.length, currentParts.length);
  for (let index = 0; index < length; index++) {
    const a = latestParts[index] ?? 0;
    const b = currentParts[index] ?? 0;
    if (a !== b) return a > b;
  }

  return false;
}

// Must match the archive names `bun run package` produces (scripts/package.ts).
export function platformAssetName(platform: string, arch: string): string | null {
  if (platform === "win32" && arch === "x64") return "gaq-srs-windows-x64.zip";
  if (platform === "darwin" && arch === "x64") return "gaq-srs-macos-x64.zip";
  if (platform === "darwin" && arch === "arm64") return "gaq-srs-macos-arm64.zip";
  if (platform === "linux" && arch === "x64") return "gaq-srs-linux-x64.zip";
  return null;
}

// GitHub publishes a digest per asset as "sha256:<hex>". Anything else,
// including another algorithm, is treated as no digest so self-update refuses
// the asset rather than trusting an unverifiable download.
export function parseDigest(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = /^sha256:([0-9a-f]{64})$/i.exec(raw.trim());
  return match ? match[1]!.toLowerCase() : null;
}

export function parseReleaseAssets(raw: unknown): ReleaseAsset[] {
  if (!Array.isArray(raw)) return [];

  const assets: ReleaseAsset[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { name, browser_download_url: url, digest, size } = entry as Record<string, unknown>;
    if (typeof name !== "string" || typeof url !== "string") continue;
    assets.push({
      name,
      url,
      digest: parseDigest(digest),
      size: typeof size === "number" && Number.isInteger(size) && size > 0 ? size : null,
    });
  }
  return assets;
}

export function pickPlatformAsset(
  assets: ReleaseAsset[],
  platform: string,
  arch: string,
): ReleaseAsset | null {
  const wanted = platformAssetName(platform, arch);
  if (!wanted) return null;
  return assets.find((asset) => asset.name === wanted) ?? null;
}

export function pickDownloadUrl(
  assets: ReleaseAsset[],
  platform: string,
  arch: string,
): string | null {
  return pickPlatformAsset(assets, platform, arch)?.url ?? null;
}

// Never throws and never surfaces an error state: an offline machine, a rate
// limit, a repo with no releases yet, or malformed JSON all degrade to "no
// update notice", which is the same thing the user saw before this feature.
export async function getUpdateStatus(current: string): Promise<UpdateStatus> {
  const lookup = await getReleaseLookup();

  return {
    current,
    latest: lookup.latest,
    updateAvailable: lookup.latest ? isNewerVersion(lookup.latest, current) : false,
    releaseUrl: lookup.releaseUrl,
    downloadUrl: pickDownloadUrl(lookup.assets, process.platform, process.arch),
    releaseNotes: lookup.releaseNotes,
    checkFailed: lookup.checkFailed,
    checkedAt: lookup.checkedAt,
  };
}

export async function getReleaseLookup(): Promise<ReleaseLookup> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.lookup;

  const checkedAt = new Date().toISOString();
  let lookup: ReleaseLookup;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);

    const release = (await response.json()) as {
      tag_name?: unknown;
      html_url?: unknown;
      body?: unknown;
      assets?: unknown;
    };

    lookup = {
      latest: typeof release.tag_name === "string" ? release.tag_name : null,
      releaseUrl: typeof release.html_url === "string" ? release.html_url : null,
      releaseNotes:
        typeof release.body === "string" && release.body.trim() ? release.body : null,
      assets: parseReleaseAssets(release.assets),
      checkFailed: false,
      checkedAt,
    };
  } catch {
    lookup = {
      latest: null,
      releaseUrl: null,
      releaseNotes: null,
      assets: [],
      checkFailed: true,
      checkedAt,
    };
  }

  cached = {
    lookup,
    expiresAt: now + (lookup.checkFailed ? FAILURE_TTL_MS : SUCCESS_TTL_MS),
  };

  return lookup;
}
