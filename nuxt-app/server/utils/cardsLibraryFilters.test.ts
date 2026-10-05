import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import { listCardIds, listCards, type CardListFilters } from "./cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import type { StudyFilters } from "./studyFilters.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const INSERTS_ONLY: StudyFilters = {
  yearMin: null, yearMax: null, seasons: [], scoreMin: null, scoreMax: null, formats: [], themeTypes: ["IN"],
  genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
  listAniListIds: null, listSource: null,
};

describe("card list library filters", () => {
  let nextAniListId = 1;

  function addCard(title: string, slot: string, paths: { video?: string; audio?: string } = {}) {
    const animeRow = upsertAnime({
      aniListId: nextAniListId++, animethemesId: null, titleRomaji: title, titleEnglish: null, titleNative: null,
    });
    const artistRow = getOrCreateArtist("Artist");
    const songRow = upsertSong({ animeId: animeRow.id, artistId: artistRow.id, title, themeSlot: slot, animethemesThemeId: null });
    db.insert(card)
      .values({ songId: songRow.id, localVideoPath: paths.video ?? null, localAudioPath: paths.audio ?? null, animethemesAudioUrl: "https://example.test/x.ogg" })
      .run();
  }

  const titles = (filters: CardListFilters) => listCards(1, undefined, filters).items.map((row) => row.songTitle).sort();

  beforeEach(() => {
    addCard("op-remote", "OP1");
    addCard("op-downloaded", "OP1", { video: "/lib/op.webm" });
    addCard("insert-remote", "IN-101");
    addCard("insert-video", "IN-102", { video: "/lib/insert.webm" });
    addCard("insert-audio", "IN-103", { audio: "/lib/insert.mp3" });
  });

  afterEach(() => {
    db.delete(card).run();
    db.delete(song).run();
    db.delete(anime).run();
    nextAniListId = 1;
  });

  it("narrows to downloaded cards, counting a local audio file as downloaded", () => {
    expect(titles({ downloadedOnly: true })).toEqual(["insert-audio", "insert-video", "op-downloaded"]);
  });

  it("narrows by the anime-level filters on their own", () => {
    expect(titles({ studyFilters: INSERTS_ONLY })).toEqual(["insert-audio", "insert-remote", "insert-video"]);
  });

  it("finds the insert songs that are downloaded when both are set", () => {
    const filters = { downloadedOnly: true, studyFilters: INSERTS_ONLY };
    expect(titles(filters)).toEqual(["insert-audio", "insert-video"]);
    expect(listCards(1, undefined, filters).total).toBe(2);
    expect(listCardIds("", filters)).toHaveLength(2);
  });

  it("combines with the existing text search", () => {
    expect(listCards(1, "audio", { downloadedOnly: true, studyFilters: INSERTS_ONLY }).items.map((row) => row.songTitle)).toEqual(["insert-audio"]);
  });

  it("treats null filters and false toggles as no narrowing", () => {
    expect(titles({ downloadedOnly: false, studyFilters: null })).toHaveLength(5);
  });
});
