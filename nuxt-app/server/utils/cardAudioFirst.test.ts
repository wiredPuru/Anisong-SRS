import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { parseAudioFirstBody, setCardsAudioFirst } from "./cardAudioFirst.ts";
import { setCardsKnown } from "./cardKnown.ts";
import { getCardsByIds } from "./cards.ts";
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
    songId: songRow.id, animethemesVideoUrl: "https://v.animethemes.moe/x.webm", box: 3, streak: 2, nextReviewAt: DUE_AT,
  }).returning().get().id;
}

function row(id: number) {
  return db.select().from(card).where(eq(card.id, id)).get()!;
}

beforeEach(() => {
  ids = [addCard("alpha", 1), addCard("beta", 2)];
});

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run(); db.delete(artist).run();
});

describe("setCardsAudioFirst", () => {
  it("defaults to false and is carried on the card shape", () => {
    const [first] = ids as [number, number];
    expect(row(first).audioFirst).toBe(false);
    setCardsAudioFirst([first], true);
    expect(getCardsByIds([first])[0]).toMatchObject({ id: first, audioFirst: true });
  });

  it("marks and unmarks without touching the schedule or the other flags", () => {
    const [first, second] = ids as [number, number];
    setCardsKnown([first], true);

    expect(setCardsAudioFirst([first], true)).toEqual({ updated: 1, notFound: [] });
    expect(row(first)).toMatchObject({ audioFirst: true, known: true, suspended: false, box: 3, streak: 2, nextReviewAt: DUE_AT });
    expect(row(second).audioFirst).toBe(false);

    expect(setCardsAudioFirst([first], false)).toEqual({ updated: 1, notFound: [] });
    expect(row(first)).toMatchObject({ audioFirst: false, known: true });
  });

  it("defaults the style to blind and sets it only when given", () => {
    const [first] = ids as [number, number];
    expect(row(first).audioFirstStyle).toBe("blind");
    setCardsAudioFirst([first], true, "pixelate");
    expect(getCardsByIds([first])[0]).toMatchObject({ audioFirst: true, audioFirstStyle: "pixelate" });
    setCardsAudioFirst([first], true);
    expect(row(first).audioFirstStyle).toBe("pixelate");
  });

  it("keeps the stored style when a card is unmarked and marked again", () => {
    const [first] = ids as [number, number];
    setCardsAudioFirst([first], true, "peephole");
    setCardsAudioFirst([first], false);
    expect(row(first)).toMatchObject({ audioFirst: false, audioFirstStyle: "peephole" });
    setCardsAudioFirst([first], true);
    expect(row(first)).toMatchObject({ audioFirst: true, audioFirstStyle: "peephole" });
  });

  it("reports ids that are not in the library", () => {
    const [first] = ids as [number, number];
    expect(setCardsAudioFirst([first, 9999], true)).toEqual({ updated: 1, notFound: [9999] });
  });
});

describe("parseAudioFirstBody", () => {
  it("accepts ids and a boolean, dropping repeats", () => {
    expect(parseAudioFirstBody({ ids: [3, 1, 3], audioFirst: true })).toEqual({ ids: [3, 1], audioFirst: true });
  });

  it.each(["blind", "blur", "pixelate", "peephole", "random"])("accepts the %s style", (style) => {
    expect(parseAudioFirstBody({ ids: [1], audioFirst: true, style })).toEqual({ ids: [1], audioFirst: true, style });
  });

  it.each([
    null,
    { ids: [1] },
    { ids: [1], audioFirst: "true" },
    { ids: [], audioFirst: true },
    { ids: [0], audioFirst: true },
    { ids: Array.from({ length: 501 }, (_, index) => index + 1), audioFirst: true },
    { ids: [1], audioFirst: true, style: "sepia" },
    { ids: [1], audioFirst: true, style: null },
    { ids: [1], audioFirst: false, style: "blur" },
  ])("rejects %j", (body) => {
    expect(parseAudioFirstBody(body)).toHaveProperty("error");
  });
});
