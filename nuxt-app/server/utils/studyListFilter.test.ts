import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { resolveListAnimeIds, type ListDeps } from "./studyListFilter.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

function addAnime(aniListId: number, withCard: boolean) {
  const animeRow = upsertAnime({ aniListId, animethemesId: null, titleRomaji: `Anime ${aniListId}`, titleEnglish: null, titleNative: null });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title: "Song", themeSlot: "OP1", animethemesThemeId: null });
  if (withCard) db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg" }).run();
}

function deps(overrides: Partial<ListDeps>): ListDeps {
  return {
    aniListCompleted: vi.fn().mockRejectedValue(new Error("unexpected AniList list call")),
    malCompleted: vi.fn().mockRejectedValue(new Error("unexpected MAL list call")),
    aniListIdsByMalIds: vi.fn().mockRejectedValue(new Error("unexpected MAL mapping call")),
    ...overrides,
  };
}

beforeEach(() => {
  addAnime(10, true);
  addAnime(20, true);
  addAnime(30, false);
});

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

describe("resolveListAnimeIds", () => {
  it("keeps only listed AniList anime that have cards", async () => {
    const aniListCompleted = vi.fn().mockResolvedValue([{ aniListId: 20 }, { aniListId: 30 }, { aniListId: 99 }, { aniListId: 10 }]);
    expect(await resolveListAnimeIds("anilist", "Kyoto", deps({ aniListCompleted }))).toEqual({ aniListIds: [10, 20], listSize: 4, matched: 2 });
    expect(aniListCompleted).toHaveBeenCalledWith("Kyoto");
  });

  it("maps a MAL list through AniList ids once, de-duplicating MAL ids", async () => {
    const aniListIdsByMalIds = vi.fn().mockResolvedValue(new Map([[1, 10], [3, 99]]));
    const malCompleted = vi.fn().mockResolvedValue([{ malId: 1 }, { malId: 2 }, { malId: 3 }, { malId: 1 }]);
    expect(await resolveListAnimeIds("mal", "Xinil", deps({ malCompleted, aniListIdsByMalIds }))).toEqual({ aniListIds: [10], listSize: 4, matched: 1 });
    expect(aniListIdsByMalIds).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("reports an empty match for a list with nothing in the library", async () => {
    const aniListCompleted = vi.fn().mockResolvedValue([]);
    expect(await resolveListAnimeIds("anilist", "empty", deps({ aniListCompleted }))).toEqual({ aniListIds: [], listSize: 0, matched: 0 });
  });

  it("lets a provider failure propagate", async () => {
    const aniListCompleted = vi.fn().mockRejectedValue(new Error("down"));
    await expect(resolveListAnimeIds("anilist", "Kyoto", deps({ aniListCompleted }))).rejects.toThrow("down");
  });
});
