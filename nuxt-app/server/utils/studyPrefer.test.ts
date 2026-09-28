import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { eq } from "drizzle-orm";
import { anime, card, song } from "../db/schema.ts";
import { getNextDueCard } from "./cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { parsePreferredCardId } from "./studyRecent.ts";

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

describe("preferring a card for Study's next pick", () => {
  it("serves the preferred due card ahead of the earliest-due one", () => {
    const [first, , third] = ids as [number, number, number];
    db.update(card).set({ nextReviewAt: new Date(1000) }).where(eq(card.id, first)).run();
    expect(getNextDueCard(ALL, false, "title", null, [], [], third)!.id).toBe(third);
  });

  it("serves the preferred card even when it is in the recent list", () => {
    const [first, second, third] = ids as [number, number, number];
    expect(getNextDueCard(ALL, false, "title", null, [first, second, third], [], third)!.id).toBe(third);
  });

  it("ignores a buried preferred card", () => {
    const [, , third] = ids as [number, number, number];
    expect(getNextDueCard(ALL, false, "title", null, [], [third], third)!.id).not.toBe(third);
  });

  it("ignores a preferred card outside the scope", () => {
    const [first, , third] = ids as [number, number, number];
    const firstAnimeId = db.select({ animeId: song.animeId }).from(card).innerJoin(song, eq(song.id, card.songId)).where(eq(card.id, first)).get()!.animeId;
    expect(getNextDueCard({ type: "anime", id: firstAnimeId }, false, "title", null, [], [], third)!.id).toBe(first);
  });

  it("ignores a preferred card that is not due", () => {
    const [, , third] = ids as [number, number, number];
    db.update(card).set({ nextReviewAt: new Date(Date.now() + 86_400_000) }).where(eq(card.id, third)).run();
    expect(getNextDueCard(ALL, false, "title", null, [], [], third)!.id).not.toBe(third);
  });
});

describe("parsePreferredCardId", () => {
  it("reads one card id, or none when absent", () => {
    expect(parsePreferredCardId(undefined)).toEqual({ preferId: null });
    expect(parsePreferredCardId("")).toEqual({ preferId: null });
    expect(parsePreferredCardId("42")).toEqual({ preferId: 42 });
  });

  it("rejects more than one id or a malformed value", () => {
    expect(parsePreferredCardId("1,2")).toHaveProperty("error");
    expect(parsePreferredCardId("abc")).toHaveProperty("error");
    expect(parsePreferredCardId(["1"])).toHaveProperty("error");
  });
});
