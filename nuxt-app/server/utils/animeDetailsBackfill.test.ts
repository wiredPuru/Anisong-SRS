import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import type { AniListDetails } from "../lib/anilist.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { backfillAnimeDetails, countAnimeMissingDetails } from "./animeDetailsBackfill.ts";
import { upsertAnime } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const details = (year: number): AniListDetails => ({ year, season: "SPRING", format: "TV", averageScore: 70, genres: ["Slice of Life"], tags: [{ name: "Moe", rank: 75 }] });
const unfetched = (aniListId: number) => upsertAnime({ aniListId, animethemesId: null, titleRomaji: `Anime ${aniListId}`, titleEnglish: null, titleNative: null });
const stored = (id: number) => db.select().from(anime).where(eq(anime.id, id)).get()!;
const fetcher = (found: Record<number, AniListDetails>) =>
  vi.fn(async (ids: number[]) => new Map(ids.filter((id) => found[id]).map((id) => [id, found[id]!])));

afterEach(() => {
  db.delete(anime).run();
});

describe("countAnimeMissingDetails", () => {
  it("counts only never-checked rows", () => {
    unfetched(1);
    unfetched(2);
    upsertAnime({ aniListId: 3, animethemesId: null, titleRomaji: "Fetched", titleEnglish: null, titleNative: null, details: details(2001) });
    expect(countAnimeMissingDetails()).toBe(2);
  });
});

describe("backfillAnimeDetails", () => {
  it("fills found rows and stamps rows AniList does not return so they are not re-probed", async () => {
    const found = unfetched(1);
    const gone = unfetched(2);
    const fetchDetails = fetcher({ 1: details(2004) });

    expect(await backfillAnimeDetails(fetchDetails)).toEqual({ checked: 2, updated: 1, skipped: 1 });
    expect(stored(found.id)).toMatchObject({ ...details(2004), aniListDetailsCheckedAt: expect.any(Date) });
    expect(stored(gone.id)).toMatchObject({ year: null, genres: [], aniListDetailsCheckedAt: expect.any(Date) });
    expect(countAnimeMissingDetails()).toBe(0);
    expect(await backfillAnimeDetails(fetchDetails)).toEqual({ checked: 0, updated: 0, skipped: 0 });
    expect(fetchDetails).toHaveBeenCalledTimes(1);
  });

  it("keeps earlier batches when a later batch fails, so a rerun resumes", async () => {
    for (let id = 1; id <= 60; id += 1) unfetched(id);
    const fetchDetails = vi.fn()
      .mockImplementationOnce(async (ids: number[]) => new Map(ids.map((id) => [id, details(1999)])))
      .mockRejectedValueOnce(new ProviderUnavailableError("AniList"));

    await expect(backfillAnimeDetails(fetchDetails)).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(fetchDetails.mock.calls[0]![0]).toHaveLength(50);
    expect(countAnimeMissingDetails()).toBe(10);
  });
});
