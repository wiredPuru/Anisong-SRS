import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { AniListDetails } from "../lib/anilist.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { getStudyFilterOptions } from "./studyFilterOptions.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

function addAnime(aniListId: number, details: AniListDetails | undefined, cardCount: number) {
  const animeRow = upsertAnime({ aniListId, animethemesId: null, titleRomaji: `Anime ${aniListId}`, titleEnglish: null, titleNative: null, details });
  for (let slot = 1; slot <= Math.max(cardCount, 1); slot += 1) {
    const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title: `Song ${slot}`, themeSlot: `OP${slot}`, animethemesThemeId: null });
    if (slot <= cardCount) db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg" }).run();
  }
}

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

describe("getStudyFilterOptions", () => {
  it("is empty for an empty library", () => {
    expect(getStudyFilterOptions()).toEqual({ yearRange: null, formats: [], genres: [], tags: [], missingDetailsCount: 0 });
  });

  it("summarises only anime with cards, counting each anime once per tag", () => {
    addAnime(1, { year: 2009, season: null, format: "TV", averageScore: 78, genres: ["Comedy", "Music"], tags: [{ name: "Band", rank: 90 }, { name: "Moe", rank: 60 }] }, 2);
    addAnime(2, { year: 2002, season: null, format: "TV", averageScore: null, genres: ["Comedy"], tags: [{ name: "Moe", rank: 80 }] }, 1);
    addAnime(3, { year: 1990, season: null, format: "MOVIE", averageScore: 70, genres: ["Drama"], tags: [{ name: "Tragedy", rank: 99 }] }, 0);
    addAnime(4, undefined, 1);

    expect(getStudyFilterOptions()).toEqual({
      yearRange: { min: 2002, max: 2009 },
      formats: ["TV"],
      genres: ["Comedy", "Music"],
      tags: [{ name: "Moe", ranks: [60, 80] }, { name: "Band", ranks: [90] }],
      missingDetailsCount: 1,
    });
  });
});
