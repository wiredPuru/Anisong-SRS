import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { AniListBrowseItem } from "../lib/anilistBrowse.ts";
import { withLibraryFlags } from "./anilistBrowseLibrary.ts";
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

const item = (aniListId: number): AniListBrowseItem => ({
  aniListId, titleRomaji: `Show ${aniListId}`, titleEnglish: null, titleNative: null, coverImageUrl: null,
  year: 2012, season: "SPRING", format: "TV", averageScore: 70, popularity: 10,
});

function addShow(aniListId: number, cards: number) {
  const animeRow = upsertAnime({ aniListId, animethemesId: null, titleRomaji: `Show ${aniListId}`, titleEnglish: null, titleNative: null });
  const artistId = getOrCreateArtist("Artist").id;
  for (let n = 1; n <= Math.max(cards, 1); n += 1) {
    const songRow = upsertSong({ animeId: animeRow.id, artistId, title: `S${n}`, themeSlot: `OP${n}`, animethemesThemeId: null });
    if (n <= cards) db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a/x.ogg" }).run();
  }
}

describe("withLibraryFlags", () => {
  it("counts cards per show and leaves card-less and absent shows not in the library", () => {
    addShow(1, 2);
    addShow(2, 0);
    const [withCards, noCards, absent] = withLibraryFlags([item(1), item(2), item(3)]);
    expect(withCards).toMatchObject({ aniListId: 1, inLibrary: true, cardCount: 2 });
    expect(noCards).toMatchObject({ aniListId: 2, inLibrary: false, cardCount: 0 });
    expect(absent).toMatchObject({ aniListId: 3, inLibrary: false, cardCount: 0 });
    expect(withCards).not.toHaveProperty("popularity");
  });

  it("returns an empty list without querying", () => {
    expect(withLibraryFlags([])).toEqual([]);
  });
});
