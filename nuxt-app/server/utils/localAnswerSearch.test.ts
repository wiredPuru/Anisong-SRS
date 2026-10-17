import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { isLocalAnswerKind, searchLocalAnimeAnswers, searchLocalArtistAnswers, searchLocalSongAnswers } from "./localAnswerSearch.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

function add(aniListId: number, animeTitle: string, artistName: string, songTitle: string, withCard = true) {
  const animeRow = upsertAnime({
    aniListId, animethemesId: null, titleRomaji: animeTitle, titleEnglish: `${animeTitle} EN`, titleNative: null,
    details: { year: 2005, season: null, format: "TV", averageScore: 70, genres: [], tags: [] },
  });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist(artistName).id, title: songTitle, themeSlot: "OP1", animethemesThemeId: null });
  if (withCard) db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://naedist.animemusicquiz.com/a.mp3" }).run();
}

beforeEach(() => {
  add(1, "Higurashi", "Eufonius", "Super Scription of Data");
  add(2, "Higurashi Kai", "Eufonius", "Super Scription of Data");
  add(3, "Hidden Show", "Nobody", "No Card Song", false);
});

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run(); db.delete(artist).run();
});

describe("local answer search", () => {
  it("suggests only anime the library has cards for", () => {
    expect(searchLocalAnimeAnswers("Higu").map((o) => o.aniListId).sort()).toEqual([1, 2]);
    expect(searchLocalAnimeAnswers("Hidden")).toEqual([]);
  });

  it("matches an English title and carries all three titles (native falls back to romaji, as on import)", () => {
    expect(searchLocalAnimeAnswers("Kai EN")).toEqual([
      { aniListId: 2, titleRomaji: "Higurashi Kai", titleEnglish: "Higurashi Kai EN", titleNative: "Higurashi Kai" },
    ]);
  });

  it("suggests artists and songs in the redacted shapes", () => {
    expect(searchLocalArtistAnswers("eufo")).toEqual([{ key: "eufonius", artistName: "Eufonius" }]);
    expect(searchLocalSongAnswers("scription")).toEqual([
      { key: "super scription of data|eufonius", songTitle: "Super Scription of Data", artistName: "Eufonius" },
    ]);
    expect(searchLocalSongAnswers("No Card")).toEqual([]);
  });

  it("never leaks the anime into a song or artist suggestion", () => {
    expect(Object.keys(searchLocalSongAnswers("scription")[0]!).sort()).toEqual(["artistName", "key", "songTitle"]);
    expect(Object.keys(searchLocalArtistAnswers("eufo")[0]!).sort()).toEqual(["artistName", "key"]);
  });

  it("recognizes only the three kinds", () => {
    expect(isLocalAnswerKind("anime") && isLocalAnswerKind("artist") && isLocalAnswerKind("song")).toBe(true);
    expect(isLocalAnswerKind("deck")).toBe(false);
    expect(isLocalAnswerKind(undefined)).toBe(false);
  });
});
