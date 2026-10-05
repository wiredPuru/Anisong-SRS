import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { animeCoverRoute, animeCoverUrl } from "./animeCoverSql.ts";
import { animeCoverFolder, MAX_ANIME_COVER_BYTES, resolveAnimeCover, saveAnimeCover } from "./animeCoverStore.ts";
import { upsertAnime } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const REMOTE = "https://s4.anilist.co/cover.jpg";

let dataDir: string;
let animeId: number;

function files(): string[] {
  return existsSync(animeCoverFolder()) ? readdirSync(animeCoverFolder()) : [];
}

function storedName(): string | null {
  return db.select({ path: anime.coverImagePath }).from(anime).where(eq(anime.id, animeId)).get()!.path;
}

function clientUrl(): string | null {
  return db.select({ url: animeCoverUrl }).from(anime).where(eq(anime.id, animeId)).get()!.url;
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "gaq-anime-covers-"));
  vi.stubEnv("GAQ_SRS_DATA_DIR", dataDir);
  animeId = upsertAnime({
    aniListId: 1,
    animethemesId: null,
    titleEnglish: "Show",
    titleRomaji: "Show",
    titleNative: "Show",
    coverImageUrl: REMOTE,
  }).id;
});

afterEach(() => {
  db.delete(anime).run();
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("saveAnimeCover", () => {
  it("writes the file under anime-covers beside the database and records its name", () => {
    const result = saveAnimeCover(animeId, png);
    const name = storedName()!;

    expect(result).toEqual({ fileName: name });
    expect(name).toMatch(new RegExp(`^${animeId}-[0-9a-f]{8}\\.png$`));
    expect(animeCoverFolder()).toBe(join(dataDir, "anime-covers"));
    expect(files()).toEqual([name]);
  });

  it("replaces a previous copy and deletes its file", () => {
    saveAnimeCover(animeId, png);
    const first = storedName()!;
    saveAnimeCover(animeId, jpeg);

    expect(storedName()).not.toBe(first);
    expect(files()).toEqual([storedName()]);
  });

  it("refuses an oversized or non-image file and leaves the row alone", () => {
    expect(saveAnimeCover(animeId, new Uint8Array(MAX_ANIME_COVER_BYTES + 1))).toEqual({ error: "too-large" });
    expect(saveAnimeCover(animeId, Uint8Array.from([1, 2, 3, 4]))).toEqual({ error: "unsupported" });
    expect(storedName()).toBeNull();
    expect(files()).toEqual([]);
  });

  it("reports an anime that does not exist", () => {
    expect(saveAnimeCover(animeId + 100, png)).toEqual({ notFound: true });
    expect(files()).toEqual([]);
  });
});

describe("resolveAnimeCover", () => {
  it("returns the saved file with its type", () => {
    saveAnimeCover(animeId, png);
    expect(resolveAnimeCover(animeId)).toEqual({ kind: "file", path: join(animeCoverFolder(), storedName()!), mime: "image/png" });
  });

  it("falls back to the AniList URL when the file is gone", () => {
    saveAnimeCover(animeId, png);
    rmSync(animeCoverFolder(), { recursive: true });
    expect(resolveAnimeCover(animeId)).toEqual({ kind: "remote", url: REMOTE });
  });

  it("returns null when there is neither, or no such anime", () => {
    db.update(anime).set({ coverImageUrl: null }).where(eq(anime.id, animeId)).run();
    expect(resolveAnimeCover(animeId)).toBeNull();
    expect(resolveAnimeCover(animeId + 100)).toBeNull();
  });
});

describe("animeCoverUrl", () => {
  it("is the AniList URL until a copy is saved, then the local route", () => {
    expect(clientUrl()).toBe(REMOTE);
    saveAnimeCover(animeId, png);
    expect(clientUrl()).toBe(animeCoverRoute(animeId, storedName()!));
  });
});
