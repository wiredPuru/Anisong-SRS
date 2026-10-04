import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import { addCardsForThemes, type ImportedTheme } from "./animeImport.ts";
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
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

function theme(slot: string, overrides: Partial<ImportedTheme> = {}): ImportedTheme {
  const animeRow = upsertAnime({ aniListId: 1, animethemesId: null, titleRomaji: "Anime", titleEnglish: null, titleNative: null });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title: slot, themeSlot: slot, animethemesThemeId: null });
  return {
    songId: songRow.id,
    themeSlot: slot,
    songTitle: slot,
    artistName: "Artist",
    videoUrl: "https://naedist.animemusicquiz.com/a.webm",
    audioUrl: null,
    clipBlocked: false,
    noAnimethemesMatch: false,
    ...overrides,
  };
}

describe("addCardsForThemes", () => {
  it("adds a card for each playable theme", () => {
    expect(addCardsForThemes([theme("OP1"), theme("ED1")])).toMatchObject({ added: 2, alreadyAdded: 0, skipped: 0 });
    expect(db.select().from(card).all()).toHaveLength(2);
  });

  it("skips blocked and gated themes without failing", () => {
    const result = addCardsForThemes([
      theme("OP1", { clipBlocked: true, videoUrl: null }),
      theme("OP2", { noAnimethemesMatch: true }),
      theme("ED1"),
    ]);
    expect(result).toMatchObject({ added: 1, alreadyAdded: 0, skipped: 2 });
  });

  it("counts a theme that already has a card instead of duplicating it", () => {
    const themes = [theme("OP1")];
    addCardsForThemes(themes);
    expect(addCardsForThemes(themes)).toMatchObject({ added: 0, alreadyAdded: 1, skipped: 0 });
    expect(db.select().from(card).all()).toHaveLength(1);
  });

  it("skips a theme with no source at all", () => {
    expect(addCardsForThemes([theme("OP1", { videoUrl: null, audioUrl: null })])).toMatchObject({ added: 0, alreadyAdded: 0, skipped: 1 });
  });

  it("reports the ids of created and already-present cards, but not skipped themes", () => {
    const existing = theme("OP1");
    addCardsForThemes([existing]);
    const fresh = theme("ED1");
    const blocked = theme("OP2", { clipBlocked: true, videoUrl: null });
    const result = addCardsForThemes([existing, fresh, blocked]);
    const cardIds = db.select({ id: card.id }).from(card).all().map((row) => row.id);
    expect(result.cardIds.sort()).toEqual(cardIds.sort());
    expect(result.cardIds).toHaveLength(2);
  });

  it("reports no ids for an empty theme list", () => {
    expect(addCardsForThemes([]).cardIds).toEqual([]);
  });
});
