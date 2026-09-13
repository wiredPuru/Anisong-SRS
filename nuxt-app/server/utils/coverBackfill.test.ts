import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { backfillMissingCovers, countAnimeMissingCover } from "./coverBackfill.ts";
import { upsertAnime } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

// An outage import: titles from AnimeThemes, no cover art.
function coverless(aniListId: number) {
  return upsertAnime({ aniListId, animethemesId: null, titleRomaji: `Anime ${aniListId}`, titleEnglish: null, titleNative: null });
}

function fromAniList(aniListId: number, coverImageUrl: string | null) {
  return { aniListId, titleRomaji: `Anime ${aniListId}`, titleEnglish: null, titleNative: null, coverImageUrl };
}

const storedCover = (id: number) => db.select().from(anime).where(eq(anime.id, id)).get()?.coverImageUrl;

afterEach(() => {
  db.delete(anime).run();
});

describe("countAnimeMissingCover", () => {
  it("counts only the rows the backfill would touch", () => {
    coverless(1);
    coverless(2);
    upsertAnime({ aniListId: 3, animethemesId: null, titleRomaji: "Has cover", titleEnglish: null, titleNative: null, coverImageUrl: "cover.jpg" });

    expect(countAnimeMissingCover()).toBe(2);
  });
});

describe("backfillMissingCovers", () => {
  it("fills a row that has no cover", async () => {
    const row = coverless(1);
    const fetchAnime = vi.fn().mockResolvedValue(fromAniList(1, "cover-1.jpg"));

    expect(await backfillMissingCovers(fetchAnime)).toEqual({ checked: 1, updated: 1, skipped: 0 });
    expect(storedCover(row.id)).toBe("cover-1.jpg");
  });

  it("skips an anime AniList has no record of", async () => {
    const row = coverless(999001);
    const fetchAnime = vi.fn().mockResolvedValue(null);

    expect(await backfillMissingCovers(fetchAnime)).toEqual({ checked: 1, updated: 0, skipped: 1 });
    expect(storedCover(row.id)).toBeNull();
  });

  it("skips a record that has no cover art of its own", async () => {
    const row = coverless(2);
    const fetchAnime = vi.fn().mockResolvedValue(fromAniList(2, null));

    expect(await backfillMissingCovers(fetchAnime)).toEqual({ checked: 1, updated: 0, skipped: 1 });
    expect(storedCover(row.id)).toBeNull();
  });

  it("leaves rows that already have a cover alone", async () => {
    const kept = upsertAnime({ aniListId: 3, animethemesId: null, titleRomaji: "Has cover", titleEnglish: null, titleNative: null, coverImageUrl: "original.jpg" });
    const fetchAnime = vi.fn().mockResolvedValue(fromAniList(3, "replacement.jpg"));

    expect(await backfillMissingCovers(fetchAnime)).toEqual({ checked: 0, updated: 0, skipped: 0 });
    expect(fetchAnime).not.toHaveBeenCalled();
    expect(storedCover(kept.id)).toBe("original.jpg");
  });

  it("propagates a provider outage instead of counting every row as coverless", async () => {
    coverless(4);
    coverless(5);
    const fetchAnime = vi.fn().mockRejectedValue(new ProviderUnavailableError("AniList"));

    await expect(backfillMissingCovers(fetchAnime)).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(fetchAnime).toHaveBeenCalledTimes(1);
  });
});
