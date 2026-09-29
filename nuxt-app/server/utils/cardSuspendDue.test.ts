import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, cardTrack, song } from "../db/schema.ts";
import { getDueCardCount, getNextDueCard, getUpcomingDueCards } from "./cards.ts";
import { listArtistDecks } from "./decks.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { getReviewForecast } from "./stats.ts";

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

function setSuspended(cardId: number, suspended: boolean) {
  db.update(card).set({ suspended }).where(eq(card.id, cardId)).run();
}

beforeEach(() => {
  ids = [addCard("one", 1), addCard("two", 2)];
});

afterEach(() => {
  db.delete(cardTrack).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run(); db.delete(artist).run();
});

describe("suspended cards and due state", () => {
  it("never serves, counts, or prefetches a suspended card", () => {
    const [first, second] = ids as [number, number];
    setSuspended(first, true);

    expect(getNextDueCard(ALL)!.id).toBe(second);
    expect(getDueCardCount(ALL)).toBe(1);
    expect(getUpcomingDueCards(ALL, undefined, 5).map((c) => c.id)).toEqual([second]);
  });

  it("leaves a suspended card out of every grading track", () => {
    const [first, second] = ids as [number, number];
    db.insert(cardTrack).values({ cardId: first, criterion: "song", nextReviewAt: new Date(0) }).run();
    setSuspended(first, true);

    expect(getDueCardCount(ALL, false, "song")).toBe(1);
    expect(getNextDueCard(ALL, false, "song")!.id).toBe(second);
  });

  it("leaves a suspended card out of the review forecast and deck tile due counts", () => {
    setSuspended(ids[0]!, true);

    const forecast = getReviewForecast();
    expect(forecast.backlog).toBe(1);
    expect(forecast.dueNow).toBe(1);
    expect(listArtistDecks(1).items[0]!.dueCount).toBe(1);
  });

  it("brings a card back once it is unsuspended, schedule untouched", () => {
    const [first] = ids as [number, number];
    setSuspended(first, true);
    setSuspended(first, false);

    expect(getDueCardCount(ALL)).toBe(2);
    expect(getNextDueCard(ALL, false, "title", null, [], [], first)).toMatchObject({ id: first, box: 1, suspended: false });
  });
});
