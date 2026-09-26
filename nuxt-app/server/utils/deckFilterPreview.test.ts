import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { eq } from "drizzle-orm";
import { anime, card, deck, deckCard, song } from "../db/schema.ts";
import type { AniListDetails } from "../lib/anilist.ts";
import { copyFilteredCards, listFilteredAnime, parseCopyFilteredBody } from "./deckFilterPreview.ts";
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
  yearMin: null, yearMax: null, seasons: [], scoreMin: null, scoreMax: null, formats: [], themeTypes: [],
  genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
  listAniListIds: null, listSource: null,
};

const DETAILS: AniListDetails = { year: 2010, season: null, format: "TV", averageScore: 75, genres: [], tags: [] };

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
  db.delete(deckCard).run(); db.delete(deck).run();
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

function makeDeck(name = "Deck") {
  return db.insert(deck).values({ name }).returning({ id: deck.id }).get().id;
}

function deckSlots(deckId: number) {
  return db
    .select({ slot: song.themeSlot, anime: song.animeId })
    .from(deckCard)
    .innerJoin(card, eq(deckCard.cardId, card.id))
    .innerJoin(song, eq(card.songId, song.id))
    .where(eq(deckCard.deckId, deckId))
    .all();
}

describe("copyFilteredCards", () => {
  it("adds exactly the cards the preview counted for the picked anime", () => {
    const kon = addAnime(1, "K-On!", { tags: [{ name: "CGDCT", rank: 90 }] }, ["OP1", "OP2", "ED1"]);
    addAnime(2, "Lucky Star", { tags: [{ name: "CGDCT", rank: 80 }] }, ["OP1"]);
    addAnime(3, "Berserk", {}, ["OP1"]);
    const tagged = filters({ tagsInclude: ["CGDCT"] });
    const deckId = makeDeck();

    const preview = listFilteredAnime(tagged).anime.find((row) => row.id === kon)!;
    expect(copyFilteredCards(deckId, [kon], tagged)).toEqual({ added: preview.cardCount, alreadyInDeck: 0 });
    expect(new Set(deckSlots(deckId).map((row) => row.anime))).toEqual(new Set([kon]));
  });

  it("adds only the theme type an OP/ED filter allows", () => {
    const kon = addAnime(1, "K-On!", {}, ["OP1", "OP2", "ED1"]);
    const deckId = makeDeck();

    expect(copyFilteredCards(deckId, [kon], filters({ themeTypes: ["OP"] }))).toEqual({ added: 2, alreadyInDeck: 0 });
    expect(deckSlots(deckId).map((row) => row.slot).sort()).toEqual(["OP1", "OP2"]);
  });

  it("adds nothing on a second run and counts every card as already in the deck", () => {
    const kon = addAnime(1, "K-On!", {}, ["OP1", "ED1"]);
    const deckId = makeDeck();

    copyFilteredCards(deckId, [kon], null);
    expect(copyFilteredCards(deckId, [kon], null)).toEqual({ added: 0, alreadyInDeck: 2 });
  });

  it("counts a card already in the deck from elsewhere as already in it", () => {
    const kon = addAnime(1, "K-On!", {}, ["OP1", "ED1"]);
    const deckId = makeDeck();
    const [first] = db.select({ id: card.id }).from(card).all();
    db.insert(deckCard).values({ deckId, cardId: first!.id }).run();

    expect(copyFilteredCards(deckId, [kon], null)).toEqual({ added: 1, alreadyInDeck: 1 });
  });

  it("adds only the picked season's cards for a single year", () => {
    const kon = addAnime(1, "K-On!", { year: 2009, season: "SPRING" }, ["OP1", "ED1"]);
    const late = addAnime(2, "Kanamemo", { year: 2009, season: "SUMMER" }, ["OP1"]);
    const movie = addAnime(3, "Movie", { year: 2009, season: null }, ["OP1"]);
    const spring2009 = filters({ yearMin: 2009, yearMax: 2009, seasons: ["SPRING"] });

    expect(titles(listFilteredAnime(spring2009))).toEqual([["K-On!", 2]]);
    expect(copyFilteredCards(makeDeck(), [kon, late, movie], spring2009)).toEqual({ added: 2, alreadyInDeck: 0 });
  });

  it("reports an unknown deck as not found", () => {
    const kon = addAnime(1, "K-On!", {}, ["OP1"]);
    expect(copyFilteredCards(9999, [kon], null)).toEqual({ notFound: true });
  });

  it("adds nothing for an anime id that no longer exists", () => {
    addAnime(1, "K-On!", {}, ["OP1"]);
    expect(copyFilteredCards(makeDeck(), [9999], null)).toEqual({ added: 0, alreadyInDeck: 0 });
  });
});

describe("parseCopyFilteredBody", () => {
  it("accepts a body, deduping anime ids and parsing filters", () => {
    expect(parseCopyFilteredBody({ deckId: 3, animeIds: [5, 7, 5], filters: JSON.stringify({ themeTypes: ["OP"] }) })).toEqual({
      deckId: 3,
      animeIds: [5, 7],
      filters: { ...EMPTY, themeTypes: ["OP"] },
    });
    expect(parseCopyFilteredBody({ deckId: 3, animeIds: [5] })).toEqual({ deckId: 3, animeIds: [5], filters: null });
  });

  it.each([
    [null, "deckId and animeIds are required"],
    [{ animeIds: [1] }, "deckId must be a positive integer"],
    [{ deckId: 0, animeIds: [1] }, "deckId must be a positive integer"],
    [{ deckId: 1, animeIds: [] }, "animeIds must be a non-empty array"],
    [{ deckId: 1 }, "animeIds must be a non-empty array"],
    [{ deckId: 1, animeIds: [1.5] }, "animeIds must all be positive integers"],
    [{ deckId: 1, animeIds: ["2"] }, "animeIds must all be positive integers"],
    [{ deckId: 1, animeIds: Array.from({ length: 5001 }, (_, i) => i + 1) }, "animeIds may hold at most 5000 entries"],
    [{ deckId: 1, animeIds: [1], filters: JSON.stringify({ yearMin: 2020, yearMax: 2010 }) }, "yearMin must not be after yearMax"],
  ])("rejects %j", (body, error) => {
    expect(parseCopyFilteredBody(body)).toEqual({ error });
  });
});
