import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, deck, deckCard, song } from "../db/schema.ts";
import { getDueCardCount, getNextDueCard, getUpcomingDueCards, getWithheldNewCount } from "./cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import type { AnimeSeason } from "../lib/anilist.ts";
import type { StudyFilters } from "./studyFilters.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const FILTERS: StudyFilters = {
  yearMin: 2000, yearMax: 2009, seasons: [], scoreMin: null, scoreMax: null, formats: [], themeTypes: [],
  genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60, listAniListIds: null, listSource: null,
};

let deckId = 0;
const cardIds: Record<string, number> = {};

function addCard(title: string, aniListId: number, year: number, season: AnimeSeason | null = null) {
  const animeRow = upsertAnime({
    aniListId, animethemesId: null, titleRomaji: title, titleEnglish: null, titleNative: null,
    details: { year, season, format: "TV", averageScore: 70, genres: [], tags: [] },
  });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title, themeSlot: "OP1", animethemesThemeId: null });
  cardIds[title] = db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg", nextReviewAt: new Date(0) }).returning().get().id;
}

beforeEach(() => {
  addCard("old", 1, 1995);
  addCard("mid", 2, 2005);
  addCard("new", 3, 2020);
  deckId = db.insert(deck).values({ name: "Deck" }).returning().get().id;
  db.insert(deckCard).values([{ deckId, cardId: cardIds.old! }, { deckId, cardId: cardIds.mid! }]).run();
});

afterEach(() => {
  db.delete(deckCard).run(); db.delete(deck).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

describe("due queries with study filters", () => {
  it("leaves every due card in play without filters", () => {
    expect(getDueCardCount({ type: "all" })).toBe(3);
    expect(getDueCardCount({ type: "all" }, false, "title", null)).toBe(3);
  });

  it("narrows the next card, the count, and the lookahead", () => {
    expect(getDueCardCount({ type: "all" }, false, "title", FILTERS)).toBe(1);
    expect(getNextDueCard({ type: "all" }, false, "title", FILTERS)?.id).toBe(cardIds.mid);
    expect(getUpcomingDueCards({ type: "all" }, cardIds.mid, 2, false, "title", FILTERS)).toEqual([]);
    expect(getWithheldNewCount({ type: "all" }, "title", FILTERS)).toBe(0);
  });

  it("serves only the picked seasons on top of the year range, skipping anime with no season", () => {
    addCard("spring", 4, 2005, "SPRING");
    addCard("fall", 5, 2005, "FALL");
    const spring = { ...FILTERS, seasons: ["SPRING" as const] };
    expect(getDueCardCount({ type: "all" }, false, "title", spring)).toBe(1);
    expect(getNextDueCard({ type: "all" }, false, "title", spring)?.id).toBe(cardIds.spring);
    expect(getDueCardCount({ type: "all" }, false, "title", { ...spring, seasons: ["SPRING", "FALL"] })).toBe(2);
    expect(getDueCardCount({ type: "all" }, false, "title", { ...spring, yearMin: 2010, yearMax: null })).toBe(0);
  });

  it("applies on top of a scope", () => {
    const deckScope = { type: "created" as const, id: deckId };
    expect(getDueCardCount(deckScope, false, "title", { ...FILTERS, yearMin: 1990 })).toBe(2);
    expect(getDueCardCount(deckScope, false, "title", { ...FILTERS, yearMin: 2010, yearMax: null })).toBe(0);
    expect(getNextDueCard(deckScope, false, "title", { ...FILTERS, yearMin: 2010, yearMax: null })).toBeUndefined();
  });
});
