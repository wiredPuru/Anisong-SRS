import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { AniListDetails } from "../lib/anilist.ts";
import { listFilteredAnime } from "./deckFilterPreview.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import type { StudyFilters } from "./studyFilters.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const EMPTY: StudyFilters = {
  yearMin: null, yearMax: null, scoreMin: null, scoreMax: null, formats: [], themeTypes: [],
  genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
  listAniListIds: null, listSource: null,
};

const DETAILS: AniListDetails = { year: 2010, format: "TV", averageScore: 75, genres: [], tags: [] };

function addAnime(aniListId: number, title: string, details: Partial<AniListDetails> | null, slots: string[]) {
  const animeRow = upsertAnime({
    aniListId,
    animethemesId: null,
    titleRomaji: title,
    titleEnglish: null,
    titleNative: null,
    details: details ? { ...DETAILS, ...details } : undefined,
  });
  for (const slot of slots) {
    const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title: `${title} ${slot}`, themeSlot: slot, animethemesThemeId: null });
    db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg" }).run();
  }
  return animeRow.id;
}

function filters(overrides: Partial<StudyFilters>): StudyFilters {
  return { ...EMPTY, ...overrides };
}

function titles(result: ReturnType<typeof listFilteredAnime>) {
  return result.anime.map((row) => [row.titleRomaji, row.cardCount]);
}

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

describe("listFilteredAnime", () => {
  it("is empty for an empty library", () => {
    expect(listFilteredAnime(null)).toEqual({ anime: [], totalCards: 0 });
  });

  it("returns every anime with cards when no filter is active, skipping anime with none", () => {
    addAnime(1, "K-On!", {}, ["OP1", "ED1"]);
    addAnime(2, "Lucky Star", {}, ["OP1"]);
    upsertAnime({ aniListId: 3, animethemesId: null, titleRomaji: "No Cards", titleEnglish: null, titleNative: null });

    const result = listFilteredAnime(null);
    expect(titles(result)).toEqual([["K-On!", 2], ["Lucky Star", 1]]);
    expect(result.totalCards).toBe(3);
    expect(result.anime[0]).toMatchObject({ aniListId: 1, titleEnglish: "K-On!", year: 2010, format: "TV", coverImageUrl: null });
  });

  it("applies genre include and exclude", () => {
    addAnime(1, "K-On!", { genres: ["Comedy", "Slice of Life"] }, ["OP1"]);
    addAnime(2, "Clannad", { genres: ["Drama", "Slice of Life"] }, ["OP1"]);
    addAnime(3, "Berserk", { genres: ["Action"] }, ["OP1"]);

    expect(titles(listFilteredAnime(filters({ genresInclude: ["Slice of Life"], genresExclude: ["Drama"] })))).toEqual([["K-On!", 1]]);
  });

  it("ignores a tag ranked below tagMinRank", () => {
    addAnime(1, "K-On!", { tags: [{ name: "CGDCT", rank: 90 }] }, ["OP1"]);
    addAnime(2, "Bocchi", { tags: [{ name: "CGDCT", rank: 40 }] }, ["OP1"]);

    expect(titles(listFilteredAnime(filters({ tagsInclude: ["CGDCT"], tagMinRank: 60 })))).toEqual([["K-On!", 1]]);
  });

  it("counts only the matching theme type and drops an anime without it", () => {
    addAnime(1, "K-On!", {}, ["OP1", "OP2", "ED1"]);
    addAnime(2, "Only Endings", {}, ["ED1"]);

    const result = listFilteredAnime(filters({ themeTypes: ["OP"] }));
    expect(titles(result)).toEqual([["K-On!", 2]]);
    expect(result.totalCards).toBe(2);
  });

  it("drops an anime with an unknown year while a year filter is active", () => {
    addAnime(1, "K-On!", { year: 2009 }, ["OP1"]);
    addAnime(2, "Unknown Year", null, ["OP1"]);

    expect(titles(listFilteredAnime(filters({ yearMin: 2000 })))).toEqual([["K-On!", 1]]);
  });

  it("matches nothing for an empty user list", () => {
    addAnime(1, "K-On!", {}, ["OP1"]);

    const listSource = { site: "anilist" as const, username: "someone", fetchedAt: "2026-09-25T00:00:00.000Z" };
    expect(listFilteredAnime(filters({ listAniListIds: [], listSource }))).toEqual({ anime: [], totalCards: 0 });
  });

  it("orders by romaji title case-insensitively, then id", () => {
    addAnime(1, "yuru Camp", {}, ["OP1"]);
    addAnime(2, "Aria", {}, ["OP1"]);
    addAnime(3, "aria", {}, ["OP1"]);

    expect(listFilteredAnime(null).anime.map((row) => row.aniListId)).toEqual([2, 3, 1]);
  });
});
