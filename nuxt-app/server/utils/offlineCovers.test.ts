import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, mediaLibrarySettings } from "../db/schema.ts";
import { animeCoverFolder, resolveAnimeCover, saveAnimeCover } from "./animeCoverStore.ts";
import { ensureAnimeCoverLocal, fetchCoverImage, saveAnimeCoverInBackground } from "./animeCoverSave.ts";
import { upsertAnime } from "./lookup.ts";
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

let directory: string;
let animeId: number;
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "gaq-offline-cover-"));
  vi.stubEnv("GAQ_SRS_DATA_DIR", directory);
  vi.stubGlobal("fetch", vi.fn());
  animeId = upsertAnime({ aniListId: 1, titleRomaji: "Saved", titleEnglish: null, titleNative: null, coverImageUrl: "https://s4.anilist.co/cover.jpg" }).id;
});
afterEach(() => {
  db.delete(anime).run(); db.delete(mediaLibrarySettings).run();
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe("offline covers", () => {
  it("resolves saved files without a provider request", async () => {
    saveAnimeCover(animeId, png);
    setOfflineMode(true);
    expect(resolveAnimeCover(animeId)?.kind).toBe("file");
    const fetchImage = vi.fn();
    expect(await ensureAnimeCoverLocal(animeId, fetchImage)).toBe("already-local");
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("returns no cover rather than an external redirect offline", () => {
    setOfflineMode(true);
    expect(resolveAnimeCover(animeId)).toBeNull();
    expect(db.select().from(anime).where(eq(anime.id, animeId)).get()?.coverImageUrl).toBe("https://s4.anilist.co/cover.jpg");
    setOfflineMode(false);
    expect(resolveAnimeCover(animeId)).toEqual({ kind: "remote", url: "https://s4.anilist.co/cover.jpg" });
  });

  it("preserves stale local paths without falling back remotely", () => {
    saveAnimeCover(animeId, png);
    const original = db.select().from(anime).get();
    rmSync(animeCoverFolder(), { recursive: true });
    setOfflineMode(true);
    expect(resolveAnimeCover(animeId)).toBeNull();
    expect(db.select().from(anime).get()).toEqual(original);
  });

  it("blocks injected and actual fetchers with the typed offline error", async () => {
    setOfflineMode(true);
    const fetchImage = vi.fn();
    await expect(ensureAnimeCoverLocal(animeId, fetchImage)).rejects.toBeInstanceOf(OfflineModeError);
    await expect(fetchCoverImage("https://s4.anilist.co/cover.jpg")).rejects.toBeInstanceOf(OfflineModeError);
    expect(fetchImage).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("suppresses background saving without an unhandled rejection", async () => {
    setOfflineMode(true);
    saveAnimeCoverInBackground(animeId);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
    expect(db.select().from(anime).get()?.coverImagePath).toBeNull();
  });
});
