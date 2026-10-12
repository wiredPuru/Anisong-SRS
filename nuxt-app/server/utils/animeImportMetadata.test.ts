import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { importAnimeThemes } from "./animeImport.ts";
import { findAnimeByAniListId, getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

const mocks = vi.hoisted(() => ({ fetchAnime: vi.fn(), resolveThemes: vi.fn() }));
vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});
vi.mock("../lib/anilist.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/anilist.ts")>(),
  fetchAnimeFromAniList: mocks.fetchAnime,
}));
vi.mock("./themeSource.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("./themeSource.ts")>(),
  resolveThemes: mocks.resolveThemes,
}));
vi.mock("./animeCoverSave.ts", () => ({ saveAnimeCoverInBackground: vi.fn() }));
vi.mock("./mediaLibrary.ts", () => ({ getClipSource: () => "both", getIncludeInsertSongs: () => false, getThemesOnly: () => false }));

const details = { year: 2006, season: "SPRING" as const, format: "TV", averageScore: 78, popularity: 42, genres: ["Comedy"], tags: [{ name: "Iyashikei", rank: 80 }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchAnime.mockResolvedValue({ aniListId: 1, malId: 99, titleRomaji: "Remote renamed", titleEnglish: "Remote", titleNative: null, coverImageUrl: "remote.jpg", details: { ...details, year: 2026 } });
  mocks.resolveThemes.mockResolvedValue({ animethemesId: 501, animethemesSlug: "stored", animethemesUnavailable: false, themes: [{ themeSlot: "OP1", songTitle: "Opening", songTitleNative: "主題歌", artistName: "Singer", videoUrl: "https://naedist.animemusicquiz.com/clip.webm", audioUrl: null, animethemesThemeId: 123, animethemesVideoSlug: "OP1", source: "merged" }] });
});
afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(artist).run(); db.delete(anime).run();
});

describe("local-first metadata during theme imports", () => {
  it("acquires the MAL mapping without replacing stored metadata or scheduling", async () => {
    const stored = upsertAnime({ aniListId: 1, animethemesId: 501, animethemesSlug: "stored", titleRomaji: "Stored", titleEnglish: "English", titleNative: "日本語", coverImageUrl: "stored.jpg", details });
    const theme = upsertSong({ animeId: stored.id, artistId: getOrCreateArtist("Singer").id, title: "Opening", titleNative: "主題歌", themeSlot: "OP1", animethemesThemeId: 123, animethemesVideoSlug: "OP1" });
    const savedCard = db.insert(card).values({ songId: theme.id, localVideoPath: "/library/clip.webm", notes: "Keep this", box: 4, streak: 3 }).returning().get();
    await importAnimeThemes(1);
    expect(mocks.fetchAnime).toHaveBeenCalledWith(1);
    expect(mocks.resolveThemes).toHaveBeenCalledWith({ aniListId: 1, malId: 99, includeInserts: false });
    expect(findAnimeByAniListId(1)).toEqual(stored);
    expect(db.select().from(card).all()).toEqual([savedCard]);
    expect(db.select().from(song).all()).toEqual([theme]);
  });

  it("retains the previous fallback behavior when the mapping provider is unavailable", async () => {
    const stored = upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Stored", titleEnglish: null, titleNative: null });
    mocks.fetchAnime.mockRejectedValue(new ProviderUnavailableError("AniList"));
    expect(await importAnimeThemes(1)).toMatchObject({ anime: { id: stored.id } });
    expect(mocks.resolveThemes).toHaveBeenCalledWith({ aniListId: 1, malId: null, includeInserts: false });
  });

  it("does not acquire a mapping twice for a newly fetched anime", async () => {
    await importAnimeThemes(1);
    expect(mocks.fetchAnime).toHaveBeenCalledTimes(1);
    expect(mocks.resolveThemes).toHaveBeenCalledWith({ aniListId: 1, malId: 99, includeInserts: false });
  });

  it("propagates invalid mapping queries rather than hiding them as missing sources", async () => {
    upsertAnime({ aniListId: 1, animethemesId: null, titleRomaji: "Stored", titleEnglish: null, titleNative: null });
    mocks.fetchAnime.mockRejectedValue(new Error("Rejected query"));
    await expect(importAnimeThemes(1)).rejects.toThrow("Rejected query");
    expect(mocks.resolveThemes).not.toHaveBeenCalled();
  });
});
