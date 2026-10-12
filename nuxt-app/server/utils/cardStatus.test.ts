import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, reviewLog, song } from "../db/schema.ts";
import type { CardStatus } from "./cardStatus.ts";
import { listCardIds, listCards } from "./cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

function addCard(title: string, aniListId: number) {
  const animeRow = upsertAnime({
    aniListId, animethemesId: null, titleRomaji: title, titleEnglish: null, titleNative: null,
    details: { year: 2005, season: null, format: "TV", averageScore: 70, genres: [], tags: [] },
  });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title, themeSlot: "OP1", animethemesThemeId: null });
  return db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg" }).returning().get().id;
}

function statusOf(id: number) {
  const row = listCards(1).items.find((item) => item.id === id)!;
  return { status: row.status, known: row.known };
}

afterEach(() => {
  db.delete(reviewLog).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run(); db.delete(artist).run();
});

describe("card status", () => {
  let id: number;
  beforeEach(() => {
    id = addCard("alpha", 1);
  });

  it("reads new until the card has been reviewed", () => {
    expect(statusOf(id)).toEqual({ status: "new", known: false });
  });

  it("reads learning once any grading track has a review", () => {
    db.insert(reviewLog).values({ cardId: id, result: "pass", boxBefore: 1, boxAfter: 1, criterion: "song" }).run();
    expect(statusOf(id).status).toBe("learning");
  });

  it("reads known, beating a reviewed card", () => {
    db.insert(reviewLog).values({ cardId: id, result: "pass", boxBefore: 1, boxAfter: 1 }).run();
    db.update(card).set({ known: true }).where(eq(card.id, id)).run();
    expect(statusOf(id)).toEqual({ status: "known", known: true });
  });

  it("reads suspended, beating known", () => {
    db.update(card).set({ known: true, suspended: true }).where(eq(card.id, id)).run();
    expect(statusOf(id).status).toBe("suspended");
  });
});

describe("the Status library filter", () => {
  it("lists only cards with that status, alone or with a search", () => {
    const fresh = addCard("alpha", 1);
    const reviewed = addCard("beta", 2);
    const known = addCard("gamma", 3);
    const suspended = addCard("delta", 4);
    db.insert(reviewLog).values({ cardId: reviewed, result: "pass", boxBefore: 1, boxAfter: 1 }).run();
    db.update(card).set({ known: true }).where(eq(card.id, known)).run();
    db.update(card).set({ suspended: true }).where(eq(card.id, suspended)).run();

    const idsFor = (status: CardStatus, q?: string) => listCardIds(q ?? "", { status });
    expect(idsFor("new")).toEqual([fresh]);
    expect(idsFor("learning")).toEqual([reviewed]);
    expect(idsFor("known")).toEqual([known]);
    expect(idsFor("suspended")).toEqual([suspended]);
    expect(idsFor("known", "alpha")).toEqual([]);
    expect(listCards(1, undefined, { status: "known" }).total).toBe(1);
  });
});
