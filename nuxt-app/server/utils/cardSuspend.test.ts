import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { listCardIds, listCards } from "./cards.ts";
import { parseSuspendBody, setCardsSuspended } from "./cardSuspend.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const DUE_AT = new Date("2026-09-01T00:00:00.000Z");
let ids: number[] = [];

function addCard(title: string, aniListId: number) {
  const animeRow = upsertAnime({
    aniListId, animethemesId: null, titleRomaji: title, titleEnglish: null, titleNative: null,
    details: { year: 2005, season: null, format: "TV", averageScore: 70, genres: [], tags: [] },
  });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title, themeSlot: "OP1", animethemesThemeId: null });
  return db.insert(card).values({
    songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg", box: 3, streak: 0, nextReviewAt: DUE_AT,
  }).returning().get().id;
}

function row(id: number) {
  return db.select().from(card).where(eq(card.id, id)).get()!;
}

beforeEach(() => {
  ids = [addCard("alpha", 1), addCard("beta", 2), addCard("gamma", 3)];
});

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run(); db.delete(artist).run();
});

describe("setCardsSuspended", () => {
  it("suspends and unsuspends without touching the schedule", () => {
    const [first, second] = ids as [number, number, number];
    expect(setCardsSuspended([first, second], true)).toEqual({ updated: 2, notFound: [] });
    expect(row(first)).toMatchObject({ suspended: true, box: 3, streak: 0, nextReviewAt: DUE_AT });

    expect(setCardsSuspended([first], false)).toEqual({ updated: 1, notFound: [] });
    expect(row(first).suspended).toBe(false);
    expect(row(second).suspended).toBe(true);
  });

  it("reports ids that are not in the library", () => {
    const [first] = ids as [number, number, number];
    expect(setCardsSuspended([first, 9999], true)).toEqual({ updated: 1, notFound: [9999] });
  });
});

describe("the Suspended library filter", () => {
  it("lists only suspended cards, alone or combined with a search", () => {
    const [first, , third] = ids as [number, number, number];
    setCardsSuspended([first, third], true);

    expect(listCardIds("", { suspendedOnly: true }).sort()).toEqual([first, third].sort());
    expect(listCardIds("gamma", { suspendedOnly: true })).toEqual([third]);
    expect(listCards(1, undefined, { suspendedOnly: true }).total).toBe(2);
    expect(listCards(1).total).toBe(3);
  });
});

describe("parseSuspendBody", () => {
  it("accepts ids and a boolean, dropping repeats", () => {
    expect(parseSuspendBody({ ids: [3, 1, 3], suspended: true })).toEqual({ ids: [3, 1], suspended: true });
    expect(parseSuspendBody({ ids: [2], suspended: false })).toEqual({ ids: [2], suspended: false });
  });

  it.each([
    null,
    "x",
    { ids: [1] },
    { ids: [1], suspended: "true" },
    { ids: [], suspended: true },
    { ids: "1", suspended: true },
    { ids: [0], suspended: true },
    { ids: [1.5], suspended: true },
    { ids: ["1"], suspended: true },
    { ids: Array.from({ length: 501 }, (_, index) => index + 1), suspended: true },
  ])("rejects %j", (body) => {
    expect(parseSuspendBody(body)).toHaveProperty("error");
  });
});
