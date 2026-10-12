import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { mediaLibrarySettings } from "../db/schema.ts";
import { setOfflineMode } from "./mediaLibrary.ts";
import { OfflineModeError } from "./networkMode.ts";

vi.unmock("./networkMode.ts");
vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const url = "https://v.animethemes.moe/Offline.webm";
let directory: string;
let cache: typeof import("./streamCache.ts");
let download: typeof import("./mediaDownload.ts");
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "gaq-offline-media-"));
  vi.stubEnv("GAQ_SRS_DATA_DIR", directory);
  vi.resetModules();
  cache = await import("./streamCache.ts");
  download = await import("./mediaDownload.ts");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  db.delete(mediaLibrarySettings).run();
  db.insert(mediaLibrarySettings).values({ id: 1, libraryPaths: [directory], streamCacheMaxBytes: 1024, autoDownload: true, partyAutoDownload: true }).run();
  mkdirSync(cache.getStreamCacheDir(), { recursive: true });
});

afterEach(() => {
  db.delete(mediaLibrarySettings).run();
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

function completeFile() {
  const path = join(cache.getStreamCacheDir(), `${createHash("sha256").update(url).digest("hex")}.webm`);
  writeFileSync(path, "complete clip");
  return path;
}

describe("local-only media transfers", () => {
  it("checks readable files without treating stale paths, directories, or outside paths as available", async () => {
    const { localMediaAvailable } = await import("./localMedia.ts");
    const path = join(directory, "local.wav");
    writeFileSync(path, "local audio");
    setOfflineMode(true);
    expect(localMediaAvailable(path)).toBe(true);
    for (const absent of [null, "", join(directory, "gone.wav"), directory, "/etc/hosts"]) {
      expect(localMediaAvailable(absent)).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("serves a complete cache entry offline without external work", async () => {
    const path = completeFile();
    setOfflineMode(true);
    expect(await cache.resolveCachedPath(url)).toEqual({ path });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a cache miss and leaves download preferences unchanged", async () => {
    setOfflineMode(true);
    await expect(cache.resolveCachedPath(url)).rejects.toMatchObject({ statusCode: 409, data: { code: "OFFLINE_MODE" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.select().from(mediaLibrarySettings).get()).toMatchObject({ autoDownload: true, partyAutoDownload: true });
  });

  it("never treats partial cache files as complete", async () => {
    writeFileSync(join(cache.getStreamCacheDir(), `${createHash("sha256").update(url).digest("hex")}.webm.tmp-1-1`), "partial");
    setOfflineMode(true);
    expect(cache.cachedFilePathIfPresent(url)).toBeNull();
    await expect(cache.resolveCachedPath(url)).rejects.toMatchObject({ statusCode: 409, data: { code: "OFFLINE_MODE" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not join an in-flight external fill while offline", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const inFlight = cache.resolveCachedPath(url);
    setOfflineMode(true);
    await expect(cache.resolveCachedPath(url)).rejects.toMatchObject({ statusCode: 409, data: { code: "OFFLINE_MODE" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(new Response("completed before shutdown"));
    const result = await inFlight;
    expect(result).toHaveProperty("path");
    expect(await cache.resolveCachedPath(url)).toEqual(result);
  });

  it("copies a complete cache entry into the library offline", async () => {
    completeFile();
    setOfflineMode(true);
    const events = [];
    for await (const event of download.downloadMediaFile(url, directory, "saved", ".webm")) events.push(event);
    expect(events).toEqual([{ type: "progress", loaded: 13, total: 13 }, { type: "success", path: join(directory, "saved.webm") }]);
    expect(readFileSync(join(directory, "saved.webm"), "utf8")).toBe("complete clip");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a typed terminal download error for an offline miss", async () => {
    setOfflineMode(true);
    const events = [];
    for await (const event of download.downloadMediaFile(url, directory, "saved", ".webm")) events.push(event);
    expect(events).toEqual([{ type: "error", message: new OfflineModeError().statusMessage, code: "OFFLINE_MODE" }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
