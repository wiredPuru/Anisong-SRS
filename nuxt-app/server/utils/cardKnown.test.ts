import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, reviewLog, song } from "../db/schema.ts";
import { parseKnownBody, setCardsKnown } from "./cardKnown.ts";
import { setCardsSuspended } from "./cardSuspend.ts";
import { getCollectionHealth } from "./stats.ts";
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
    songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg", box: 3, streak: 2, nextReviewAt: DUE_AT,
  }).returning().get().id;
}

function row(id: number) {
  return db.select().from(card).where(eq(card.id, id)).get()!;
}

beforeEach(() => {
  ids = [addCard("alpha", 1), addCard("beta", 2)];
});

afterEach(() => {
  db.delete(reviewLog).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run(); db.delete(artist).run();
});

describe("setCardsKnown", () => {
  it("marks and unmarks without touching the schedule or history", () => {
    const [first, second] = ids as [number, number];
    db.insert(reviewLog).values({ cardId: first, result: "pass", boxBefore: 2, boxAfter: 3 }).run();

    expect(setCardsKnown([first], true)).toEqual({ updated: 1, notFound: [], statuses: { [first]: "known" } });
    expect(row(first)).toMatchObject({ known: true, box: 3, streak: 2, nextReviewAt: DUE_AT });
    expect(row(second).known).toBe(false);

    expect(setCardsKnown([first], false)).toEqual({ updated: 1, notFound: [], statuses: { [first]: "learning" } });
    expect(row(first)).toMatchObject({ known: false, box: 3, streak: 2, nextReviewAt: DUE_AT });
    expect(db.select().from(reviewLog).all()).toHaveLength(1);
  });

  it("reports New for an unmarked card that was never reviewed", () => {
    const [, second] = ids as [number, number];
    setCardsKnown([second], true);
    expect(setCardsKnown([second], false).statuses).toEqual({ [second]: "new" });
  });

  it("reports ids that are not in the library", () => {
    const [first] = ids as [number, number];
    expect(setCardsKnown([first, 9999], true)).toEqual({ updated: 1, notFound: [9999], statuses: { [first]: "known" } });
  });

  it("clears suspended when marking known", () => {
    const [first] = ids as [number, number];
    setCardsSuspended([first], true);
    setCardsKnown([first], true);
    expect(row(first)).toMatchObject({ known: true, suspended: false });
  });

  it("clears known when suspending, and leaves the other flag alone when unsetting", () => {
    const [first] = ids as [number, number];
    setCardsKnown([first], true);
    setCardsSuspended([first], true);
    expect(row(first)).toMatchObject({ known: false, suspended: true });

    setCardsKnown([first], false);
    expect(row(first).suspended).toBe(true);

    setCardsSuspended([first], false);
    setCardsKnown([first], true);
    setCardsSuspended([first], false);
    expect(row(first).known).toBe(true);
  });
});

describe("parseKnownBody", () => {
  it("accepts ids and a boolean, dropping repeats", () => {
    expect(parseKnownBody({ ids: [3, 1, 3], known: true })).toEqual({ ids: [3, 1], known: true });
    expect(parseKnownBody({ ids: [2], known: false })).toEqual({ ids: [2], known: false });
  });

  it.each([
    null,
    "x",
    { ids: [1] },
    { ids: [1], known: "true" },
    { ids: [1], suspended: true },
    { ids: [], known: true },
    { ids: "1", known: true },
    { ids: [0], known: true },
    { ids: [1.5], known: true },
    { ids: Array.from({ length: 501 }, (_, index) => index + 1), known: true },
  ])("rejects %j", (body) => {
    expect(parseKnownBody(body)).toHaveProperty("error");
  });
});

describe("collection health", () => {
  it("counts known cards apart from the box figures", () => {
    const [first] = ids as [number, number];
    setCardsKnown([first], true);

    const health = getCollectionHealth();
    expect(health.knownCards).toBe(1);
    expect(health.totalCards).toBe(1);
    expect(health.boxes.find((entry) => entry.box === 3)!.count).toBe(1);
    expect(health.neverReviewed).toBe(1);
  });
});
