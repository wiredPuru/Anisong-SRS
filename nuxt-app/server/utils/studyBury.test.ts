import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import { getDueCardCount, getNextDueCard, getUpcomingDueCards } from "./cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const ALL = { type: "all" } as const;
let ids: number[] = [];

function addCard(title: string, aniListId: number) {
  const animeRow = upsertAnime({
    aniListId, animethemesId: null, titleRomaji: title, titleEnglish: null, titleNative: null,
    details: { year: 2005, season: null, format: "TV", averageScore: 70, genres: [], tags: [] },
  });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title, themeSlot: "OP1", animethemesThemeId: null });
  return db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg", nextReviewAt: new Date(0) }).returning().get().id;
}

beforeEach(() => {
  ids = [addCard("one", 1), addCard("two", 2), addCard("three", 3)];
});

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

describe("burying cards for a Study session", () => {
  it("serves and counts every due card when nothing is buried", () => {
    expect(getDueCardCount(ALL)).toBe(3);
    expect(getDueCardCount(ALL, false, "title", null, [])).toBe(3);
  });

  it("never serves a buried card and drops it from the count", () => {
    const served = getNextDueCard(ALL)!.id;
    expect(getNextDueCard(ALL, false, "title", null, [], [served])!.id).not.toBe(served);
    expect(getDueCardCount(ALL, false, "title", null, [served])).toBe(2);
  });

  it("leaves buried cards out of the prefetch lookahead", () => {
    const [first, second, third] = ids as [number, number, number];
    const upcoming = getUpcomingDueCards(ALL, first, 5, false, "title", null, [], [second]);
    expect(upcoming.map((c) => c.id)).toEqual([third]);
  });

  it("buries even a card the recent list would otherwise fall back to", () => {
    const [first, second, third] = ids as [number, number, number];
    const next = getNextDueCard(ALL, false, "title", null, [first, second, third], [first, second]);
    expect(next!.id).toBe(third);
  });

  it("returns no card and a zero count once every due card is buried", () => {
    expect(getNextDueCard(ALL, false, "title", null, [], ids)).toBeUndefined();
    expect(getDueCardCount(ALL, false, "title", null, ids)).toBe(0);
    expect(getUpcomingDueCards(ALL, undefined, 5, false, "title", null, [], ids)).toEqual([]);
  });
});
