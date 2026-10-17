import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, cardTrack, song } from "../db/schema.ts";
import { getDueCardCount, getNextDueCard, getPracticeCard, getUpcomingDueCards } from "./cards.ts";
import { listPartyCardIds } from "./partySources.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { setOfflineMode, setPlayableOfflineOnly } from "./mediaLibrary.ts";
import { offlineHiddenCount, resetOfflinePlayableMemo } from "./offlinePlayable.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

vi.mock("./streamCache.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./streamCache.ts")>()),
  isStreamCached: (url: string) => url.includes("cached"),
}));

const ALL = { type: "all" } as const;
let cachedId = 0;
let remoteId = 0;

function addCard(title: string, aniListId: number, url: string) {
  const animeRow = upsertAnime({
    aniListId, animethemesId: null, titleRomaji: title, titleEnglish: null, titleNative: null,
    details: { year: 2005, season: null, format: "TV", averageScore: 70, genres: [], tags: [] },
  });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title, themeSlot: "OP1", animethemesThemeId: null });
  return db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: url, nextReviewAt: new Date(0) }).returning().get().id;
}

function configure(offline: boolean, playableOnly: boolean) {
  setOfflineMode(offline);
  setPlayableOfflineOnly(playableOnly);
  resetOfflinePlayableMemo();
}

beforeEach(() => {
  cachedId = addCard("cached", 1, "https://naedist.animemusicquiz.com/cached.mp3");
  remoteId = addCard("remote", 2, "https://naedist.animemusicquiz.com/remote.mp3");
});

afterEach(() => {
  configure(false, false);
  db.delete(cardTrack).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run(); db.delete(artist).run();
});

describe("Playable offline only", () => {
  it("is ignored while online, even when the choice is saved", () => {
    configure(false, true);
    expect(getDueCardCount(ALL)).toBe(2);
    expect(offlineHiddenCount()).toBe(0);
  });

  it("is ignored offline when the choice is off", () => {
    configure(true, false);
    expect(getDueCardCount(ALL)).toBe(2);
    expect(offlineHiddenCount()).toBe(0);
  });

  it("serves, counts, prefetches, and practices only cached cards offline", () => {
    configure(true, true);
    expect(getNextDueCard(ALL)!.id).toBe(cachedId);
    expect(getDueCardCount(ALL)).toBe(1);
    expect(getUpcomingDueCards(ALL, undefined, 5).map((c) => c.id)).toEqual([cachedId]);
    expect(getPracticeCard(ALL)!.id).toBe(cachedId);
    expect(offlineHiddenCount()).toBe(1);
  });

  it("leaves non-playable cards out of the Listen and Party queues too", () => {
    configure(false, true);
    expect(listPartyCardIds(ALL, null).sort()).toEqual([cachedId, remoteId].sort());
    configure(true, true);
    expect(listPartyCardIds(ALL, null)).toEqual([cachedId]);
  });

  it("returns every card again after going back online", () => {
    configure(true, true);
    expect(getDueCardCount(ALL)).toBe(1);
    configure(false, true);
    expect(getDueCardCount(ALL)).toBe(2);
    expect([remoteId, cachedId]).toContain(getNextDueCard(ALL)!.id);
  });
});
