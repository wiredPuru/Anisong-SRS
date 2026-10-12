import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { mediaLibrarySettings } from "../db/schema.ts";
import { setOfflineMode } from "./mediaLibrary.ts";

vi.unmock("./networkMode.ts");
vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

let version: typeof import("./version.ts");
let update: typeof import("./selfUpdate.ts");
let directory: string;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gaq-offline-updates-"));
  vi.stubEnv("GAQ_SRS_DATA_DIR", directory);
  vi.stubEnv("GAQ_SRS_INSTALL_DIR", "");
  vi.resetModules();
  version = await import("./version.ts");
  update = await import("./selfUpdate.ts");
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ tag_name: "v2.0.0", html_url: "https://github.com/release", assets: [] })));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  db.delete(mediaLibrarySettings).run();
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("offline updates", () => {
  it("returns not-checked offline status without a GitHub request", async () => {
    setOfflineMode(true);
    expect(await version.getUpdateStatus("1.0.0")).toEqual({ current: "1.0.0", latest: null, updateAvailable: false,
      releaseUrl: null, downloadUrl: null, releaseNotes: null, checkFailed: true, checkedAt: null, offlineMode: true });
    expect(await update.getSelfUpdateStatus("1.0.0")).toMatchObject({ state: "unavailable", reason: "offline-mode" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses warm provider answers offline and restores online cached behavior", async () => {
    expect((await version.getUpdateStatus("1.0.0")).offlineMode).toBe(false);
    setOfflineMode(true);
    expect((await version.getUpdateStatus("1.0.0")).latest).toBeNull();
    await expect(version.getReleaseLookup()).rejects.toMatchObject({ statusCode: 409, data: { code: "OFFLINE_MODE" } });
    await expect(update.startSelfUpdate("1.0.0")).rejects.toMatchObject({ statusCode: 409, data: { code: "OFFLINE_MODE" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    setOfflineMode(false);
    expect((await version.getUpdateStatus("1.0.0")).latest).toBe("v2.0.0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks the injected release downloader before filesystem changes", async () => {
    setOfflineMode(true);
    const fetchImpl = vi.fn();
    const asset = { name: "release.zip", url: "https://github.com/release.zip", digest: "ab".repeat(32), size: null };
    await expect(update.downloadAndVerify(asset, join(directory, "updates"), { fetchImpl }))
      .rejects.toMatchObject({ statusCode: 409, data: { code: "OFFLINE_MODE" } });
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(readFile(join(directory, "updates/download.zip.partial"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves and exposes an already verified local staged update offline", async () => {
    vi.stubEnv("GAQ_SRS_INSTALL_DIR", join(directory, "install"));
    const staged = join(directory, "updates/staged");
    await mkdir(staged, { recursive: true });
    const manifest = JSON.stringify({ version: "v2.0.0", assetName: "release.zip", sha256: "ab".repeat(32), binaryName: "gaq-srs", stagedAt: new Date().toISOString() });
    await writeFile(join(staged, "ready.json"), manifest);
    await writeFile(join(staged, "gaq-srs"), "verified binary");
    setOfflineMode(true);
    expect(await update.getSelfUpdateStatus("1.0.0")).toMatchObject({ state: "ready", version: "v2.0.0" });
    expect(await update.startSelfUpdate("1.0.0")).toMatchObject({ state: "ready", version: "v2.0.0" });
    expect(await readFile(join(staged, "ready.json"), "utf8")).toBe(manifest);
    expect(await readFile(join(staged, "gaq-srs"), "utf8")).toBe("verified binary");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports late activation before transfer as offline, not a connection failure", async () => {
    const fetchImpl = vi.fn();
    const asset = { name: "release.zip", url: "https://github.com/release.zip", digest: "ab".repeat(32), size: null };
    const pending = update.downloadAndVerify(asset, join(directory, "updates"), { fetchImpl });
    setOfflineMode(true);
    expect(await pending).toEqual({ ok: false, error: "Offline mode is enabled. Turn it off in Settings to use online features." });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
