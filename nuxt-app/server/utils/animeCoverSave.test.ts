import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { animeCoverFolder } from "./animeCoverStore.ts";
import { ensureAnimeCoverLocal } from "./animeCoverSave.ts";
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

let dataDir: string;

function addAnime(coverImageUrl: string | null): number {
  return upsertAnime({
    aniListId: Math.floor(Math.random() * 1e9),
    animethemesId: null,
    titleEnglish: "Show",
    titleRomaji: "Show",
    titleNative: "Show",
    coverImageUrl,
  }).id;
}

function files(): string[] {
  return existsSync(animeCoverFolder()) ? readdirSync(animeCoverFolder()) : [];
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "gaq-cover-save-"));
  vi.stubEnv("GAQ_SRS_DATA_DIR", dataDir);
});

afterEach(() => {
  db.delete(anime).run();
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("ensureAnimeCoverLocal", () => {
  it("saves the downloaded image and records it", async () => {
    const id = addAnime("https://s4.anilist.co/a.jpg");
    const fetchImage = vi.fn(async () => png);

    expect(await ensureAnimeCoverLocal(id, fetchImage)).toBe("saved");
    expect(fetchImage).toHaveBeenCalledWith("https://s4.anilist.co/a.jpg");
    expect(files()).toHaveLength(1);
    expect(db.select({ p: anime.coverImagePath }).from(anime).where(eq(anime.id, id)).get()!.p).toBe(files()[0]);
  });

  it("does not download again once a file is saved", async () => {
    const id = addAnime("https://s4.anilist.co/a.jpg");
    await ensureAnimeCoverLocal(id, async () => png);
    const fetchImage = vi.fn(async () => png);

    expect(await ensureAnimeCoverLocal(id, fetchImage)).toBe("already-local");
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("downloads again when the saved file has gone missing", async () => {
    const id = addAnime("https://s4.anilist.co/a.jpg");
    await ensureAnimeCoverLocal(id, async () => png);
    rmSync(animeCoverFolder(), { recursive: true });

    expect(await ensureAnimeCoverLocal(id, async () => png)).toBe("saved");
    expect(files()).toHaveLength(1);
  });

  it("reports an anime with no cover URL without fetching", async () => {
    const id = addAnime(null);
    const fetchImage = vi.fn(async () => png);

    expect(await ensureAnimeCoverLocal(id, fetchImage)).toBe("no-cover");
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("fails quietly when the download fails, returns a non-image, or throws", async () => {
    const id = addAnime("https://s4.anilist.co/a.jpg");

    expect(await ensureAnimeCoverLocal(id, async () => null)).toBe("failed");
    expect(await ensureAnimeCoverLocal(id, async () => Uint8Array.from([1, 2, 3]))).toBe("failed");
    expect(await ensureAnimeCoverLocal(id, async () => { throw new Error("boom"); })).toBe("failed");
    expect(files()).toEqual([]);
  });
});
