import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnisongRandomSong } from "../lib/anisongdb.ts";
import type { RankedAnime } from "./partyCatalogGrid.ts";

const fetchRandomSongs = vi.fn();
const fetchSongsByMalIds = vi.fn();
let ranking: RankedAnime[] | null = null;

vi.mock("../lib/anisongdb.ts", () => ({ fetchRandomSongs: (...args: unknown[]) => fetchRandomSongs(...args), fetchSongsByMalIds: (...args: unknown[]) => fetchSongsByMalIds(...args) }));
vi.mock("./popularityRanking.ts", () => ({ rankingWithin: async () => ranking }));

const { noteCatalogShows, pickCatalogSongs, resetCatalogPicker } = await import("./partyCatalogPicker.ts");

const song = (annSongId: number, aniListId: number | null, animeVintage: string | null = "Fall 2013"): AnisongRandomSong => ({
  annSongId,
  aniListId,
  animeVintage,
  songType: "Opening 1",
  songTitle: `Song ${annSongId}`,
  artistName: "Artist",
  animeEnglish: "Anime",
  animeRomaji: "Anime",
  videoUrl: "https://naedist.animemusicquiz.com/x.webm",
  audioUrl: null,
});

// Ranks 1-1000 for AniList ids 1-1000, MAL id = AniList id + 5000.
const fullRanking: RankedAnime[] = Array.from({ length: 1000 }, (_, i) => ({ aniListId: i + 1, malId: i + 5001, rank: i + 1 }));
const request = (over = {}) => ({ tier: "veryEasy" as const, options: {}, seasons: null, queued: new Set<number>(), count: 5, ...over });

beforeEach(() => {
  fetchRandomSongs.mockReset();
  fetchSongsByMalIds.mockReset();
  ranking = fullRanking;
  resetCatalogPicker();
});

describe("pickCatalogSongs", () => {
  it("draws Very easy from the top-500 band at 50+, one song per show", async () => {
    fetchSongsByMalIds.mockResolvedValue([song(1, 10), song(2, 10), song(3, 20)]);
    const pick = await pickCatalogSongs(request());
    expect(fetchSongsByMalIds.mock.calls[0]![0]).toHaveLength(500);
    expect(fetchSongsByMalIds.mock.calls[0]![1]).toEqual({ start: 50, end: 100, includeUnrated: false });
    expect(pick.songs.map((s) => s.aniListId).sort()).toEqual([10, 20]);
    expect(pick).toMatchObject({ noMatch: false, usedRanking: true });
  });

  it("keeps a band's pool, so the next batch asks AnisongDB nothing", async () => {
    fetchSongsByMalIds.mockResolvedValue([song(1, 10), song(2, 20)]);
    await pickCatalogSongs(request());
    await pickCatalogSongs(request());
    expect(fetchSongsByMalIds).toHaveBeenCalledTimes(1);
    resetCatalogPicker();
    await pickCatalogSongs(request());
    expect(fetchSongsByMalIds).toHaveBeenCalledTimes(2);
  });

  it("refetches a pool after half an hour", async () => {
    fetchSongsByMalIds.mockResolvedValue([song(1, 10)]);
    await pickCatalogSongs(request(), 0);
    await pickCatalogSongs(request(), 31 * 60 * 1000);
    expect(fetchSongsByMalIds).toHaveBeenCalledTimes(2);
  });

  it("drops top-1000 shows from the rest cells", async () => {
    fetchRandomSongs.mockResolvedValue([song(1, 5), song(2, 900), song(3, 4000), song(4, null)]);
    // Hard's only band-free cells are rest/mid and rest/low; make top1000/low empty.
    fetchSongsByMalIds.mockResolvedValue([]);
    const pick = await pickCatalogSongs(request({ tier: "hard" }));
    expect(pick.songs.map((s) => s.annSongId).sort()).toEqual([3, 4]);
  });

  it("tries the tier's other cells before giving up, and says no match only when all are empty", async () => {
    fetchSongsByMalIds.mockResolvedValue([]);
    fetchRandomSongs.mockResolvedValue([]);
    const pick = await pickCatalogSongs(request({ tier: "medium" }));
    expect(fetchSongsByMalIds).toHaveBeenCalledTimes(2);
    expect(fetchRandomSongs).toHaveBeenCalledTimes(1);
    expect(pick).toEqual({ songs: [], noMatch: true, usedRanking: true });
  });

  it("is not a no match when a cell had songs that were all queued", async () => {
    fetchSongsByMalIds.mockResolvedValue([song(1, 10)]);
    const pick = await pickCatalogSongs(request({ queued: new Set([1]) }));
    expect(pick).toEqual({ songs: [], noMatch: false, usedRanking: true });
  });

  it("is not a no match when a random draw landed only on top-1000 shows", async () => {
    fetchRandomSongs.mockResolvedValue([song(1, 5)]);
    fetchSongsByMalIds.mockResolvedValue([]);
    expect((await pickCatalogSongs(request({ tier: "hard" }))).noMatch).toBe(false);
  });

  it("falls back to guess rate alone while the ranking is missing", async () => {
    ranking = null;
    fetchRandomSongs.mockResolvedValue([song(1, 10)]);
    const pick = await pickCatalogSongs(request());
    expect(fetchRandomSongs.mock.calls[0]![1]).toEqual({ start: 50, end: 100 });
    expect(fetchSongsByMalIds).not.toHaveBeenCalled();
    expect(pick).toMatchObject({ noMatch: false, usedRanking: false });
  });

  it("leaves Random to the whole catalog", async () => {
    fetchRandomSongs.mockResolvedValue([]);
    expect(await pickCatalogSongs(request({ tier: "random" }))).toEqual({ songs: [], noMatch: true, usedRanking: false });
    expect(fetchRandomSongs.mock.calls[0]!.slice(0, 2)).toEqual([20, null]);
  });

  it("checks seasons song by song and asks for more when it must", async () => {
    fetchSongsByMalIds.mockResolvedValue([song(1, 10, "Fall 2013"), song(2, 20, "Spring 2013")]);
    const pick = await pickCatalogSongs(request({ seasons: ["SPRING"] }));
    expect(pick.songs.map((s) => s.annSongId)).toEqual([2]);
  });

  it("skips recently queued shows while others remain", async () => {
    fetchSongsByMalIds.mockResolvedValue([song(1, 10), song(2, 20)]);
    noteCatalogShows([song(9, 10)]);
    const pick = await pickCatalogSongs(request({ count: 1 }));
    expect(pick.songs.map((s) => s.aniListId)).toEqual([20]);
  });
});
