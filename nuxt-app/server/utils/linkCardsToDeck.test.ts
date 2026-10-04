import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, deck, deckCard, song } from "../db/schema.ts";
import { linkCardsToDeck } from "./decks.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

afterEach(() => {
  db.delete(deckCard).run(); db.delete(deck).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

function addCard(slot: string): number {
  const animeRow = upsertAnime({ aniListId: 1, animethemesId: null, titleRomaji: "A", titleEnglish: null, titleNative: null });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("X").id, title: slot, themeSlot: slot, animethemesThemeId: null });
  return db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a/x.ogg" }).returning().get().id;
}
const makeDeck = () => db.insert(deck).values({ name: "D" }).returning().get().id;

describe("linkCardsToDeck", () => {
  it("links new cards and counts ones already in the deck", () => {
    const deckId = makeDeck();
    const [a, b, c] = [addCard("OP1"), addCard("OP2"), addCard("ED1")];
    db.insert(deckCard).values({ deckId, cardId: a }).run();
    expect(linkCardsToDeck(deckId, [a, b, c])).toEqual({ addedToDeck: 2, alreadyInDeck: 1 });
    expect(db.select().from(deckCard).all()).toHaveLength(3);
  });

  it("de-duplicates repeated ids and ignores an empty list", () => {
    const deckId = makeDeck();
    const a = addCard("OP1");
    expect(linkCardsToDeck(deckId, [a, a])).toEqual({ addedToDeck: 1, alreadyInDeck: 0 });
    expect(linkCardsToDeck(deckId, [])).toEqual({ addedToDeck: 0, alreadyInDeck: 0 });
  });
});
