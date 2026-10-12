import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, mediaLibrarySettings, song } from "../db/schema.ts";
import { fetchThemeTitlesByAniListIds } from "../lib/animethemes.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { backfillAnimeDetails, countAnimeMissingDetails } from "./animeDetailsBackfill.ts";
import { backfillAnimeThemesLinks } from "./animethemesLinkBackfill.ts";
import { backfillAnimeThemesMatches } from "./animethemesMatch.ts";
import { backfillMissingCovers } from "./coverBackfill.ts";
import { saveCoversLocally } from "./coverSaveLocal.ts";
import { refreshCardSources } from "./cardSourceRefresh.ts";
import { createImportStream, respondWithImportProgress } from "./importProgress.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { createCard } from "./cards.ts";
import { requestAniList } from "../lib/anilist.ts";
import { popularityCutoffs } from "./popularityCutoffs.ts";
import { setOfflineMode } from "./mediaLibrary.ts";
import { OfflineModeError } from "./networkMode.ts";
import { startMatchIndexLoads, type AnimeThemesMatchIndex } from "./themeSource.ts";
import { getRequestHeader, setResponseHeader, type H3Event } from "h3";

vi.unmock("./networkMode.ts");
vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});
vi.mock("../lib/animethemes.ts", () => ({ fetchThemeTitlesByAniListIds: vi.fn() }));
vi.mock("../lib/anilist.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/anilist.ts")>(), requestAniList: vi.fn(),
}));
vi.mock("h3", async (importOriginal) => ({
  ...await importOriginal<typeof import("h3")>(),
  getRequestHeader: vi.fn(), setResponseHeader: vi.fn(), sendStream: vi.fn((_event, stream) => stream),
}));

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(artist).run(); db.delete(anime).run();
  db.delete(mediaLibrarySettings).run();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function seed(aniListId: number, coverImageUrl?: string) {
  return upsertAnime({ aniListId, titleRomaji: `Saved ${aniListId}`, titleEnglish: null, titleNative: null, coverImageUrl });
}

const index: AnimeThemesMatchIndex = {
  status: "ok", animethemesId: 1, animethemesSlug: "saved", byTitle: new Map(), videoSlugByThemeId: new Map(),
};
const candidates = [1, 2].map((id) => ({ animeId: id, aniListId: id, songId: id, songTitle: "Song", themeSlot: "OP1" }));

function seedRefreshCard(aniListId: number) {
  const animeRow = seed(aniListId);
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title: "Song", themeSlot: "OP1", animethemesThemeId: null });
  createCard({ songId: songRow.id, animethemesVideoUrl: "https://v.animethemes.moe/old.webm" });
}

describe("offline provider workflows", () => {
  it.each(["application/json", "application/x-ndjson"])("rejects %s before task execution or response headers", (accept) => {
    setOfflineMode(true);
    vi.mocked(getRequestHeader).mockReturnValue(accept);
    const run = vi.fn();
    expect(() => respondWithImportProgress({} as H3Event, run)).toThrow(OfflineModeError);
    expect(run).not.toHaveBeenCalled();
    expect(setResponseHeader).not.toHaveBeenCalled();
  });

  it("reports activation as a typed terminal stream error, never completion or outage", async () => {
    const stream = createImportStream(async () => { throw new OfflineModeError(); });
    let output = "";
    for await (const chunk of stream) output += chunk;
    expect(JSON.parse(output)).toEqual({ type: "error", message: new OfflineModeError().statusMessage, unavailable: false, code: "OFFLINE_MODE" });
  });

  it("blocks all injected backfill loaders without writes", async () => {
    seed(1);
    const saved = db.select().from(anime).all();
    setOfflineMode(true);
    const load = vi.fn();
    for (const run of [
      () => backfillAnimeDetails(load), () => backfillMissingCovers(load), () => saveCoversLocally(load),
      () => backfillAnimeThemesLinks(candidates, { loadIndexes: load }),
      () => backfillAnimeThemesMatches(candidates, { loadIndexes: load }),
      () => refreshCardSources({ fetchAnime: load, fetchThemes: load }, vi.fn()),
    ]) await expect(run()).rejects.toBeInstanceOf(OfflineModeError);
    expect(load).not.toHaveBeenCalled();
    expect(db.select().from(anime).all()).toEqual(saved);
    expect(() => startMatchIndexLoads([1])).toThrow(OfflineModeError);
  });

  it("keeps completed details batches and leaves unprocessed rows retryable", async () => {
    for (let id = 1; id <= 51; id += 1) seed(id);
    const fetchDetails = vi.fn(async () => { setOfflineMode(true); return new Map(); });
    await expect(backfillAnimeDetails(fetchDetails)).rejects.toBeInstanceOf(OfflineModeError);
    expect(fetchDetails).toHaveBeenCalledTimes(1);
    expect(countAnimeMissingDetails()).toBe(1);
    setOfflineMode(false);
    await backfillAnimeDetails(fetchDetails);
    expect(fetchDetails).toHaveBeenCalledTimes(2);
    expect(countAnimeMissingDetails()).toBe(0);
  });

  it("does not start the next cover fetch after activation", async () => {
    seed(1); seed(2);
    const fetchAnime = vi.fn(async (aniListId: number) => {
      setOfflineMode(true);
      return { aniListId, titleRomaji: "Saved", titleEnglish: null, titleNative: null, coverImageUrl: "https://example.com/cover.jpg" };
    });
    await expect(backfillMissingCovers(fetchAnime)).rejects.toBeInstanceOf(OfflineModeError);
    expect(fetchAnime).toHaveBeenCalledTimes(1);
    expect(db.select().from(anime).all().filter((row) => row.coverImageUrl === null)).toHaveLength(1);
  });

  it("interrupts cover saving without counting untouched rows as failures", async () => {
    seed(1, "https://example.com/1.jpg"); seed(2, "https://example.com/2.jpg");
    const ensureCover = vi.fn(async () => { setOfflineMode(true); return "saved" as const; });
    await expect(saveCoversLocally(ensureCover)).rejects.toBeInstanceOf(OfflineModeError);
    expect(ensureCover).toHaveBeenCalledTimes(1);
  });

  it.each(["links", "matches"])("stops %s writes after a completed item", async (kind) => {
    const loadIndexes = vi.fn((ids: number[]) => new Map(ids.map((id) => [id, Promise.resolve(index)])));
    const store = vi.fn(() => setOfflineMode(true));
    const options = { loadIndexes, store };
    await expect(kind === "links" ? backfillAnimeThemesLinks(candidates, options) : backfillAnimeThemesMatches(candidates, options))
      .rejects.toBeInstanceOf(OfflineModeError);
    expect(store).toHaveBeenCalledTimes(1);
  });

  it("never turns an offline chunk into unavailable or missing provider data", async () => {
    vi.mocked(fetchThemeTitlesByAniListIds).mockImplementationOnce(async () => { setOfflineMode(true); return new Map(); });
    const loads = startMatchIndexLoads([1, 2], { chunkSize: 1, concurrency: 1 });
    expect((await loads.get(1))?.status).toBe("ok");
    await expect(loads.get(2)).rejects.toBeInstanceOf(OfflineModeError);
    expect(fetchThemeTitlesByAniListIds).toHaveBeenCalledTimes(1);
  });

  it("does not retry a provider outage once the user enables offline mode", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchThemeTitlesByAniListIds).mockImplementationOnce(async () => { setOfflineMode(true); throw new ProviderUnavailableError("AnimeThemes"); });
    const loads = startMatchIndexLoads([1], { retryDelayMs: 10 });
    const blocked = expect(loads.get(1)).rejects.toBeInstanceOf(OfflineModeError);
    await vi.runAllTimersAsync();
    await blocked;
    expect(fetchThemeTitlesByAniListIds).toHaveBeenCalledTimes(1);
  });

  it("stops source refresh before the next provider after activation", async () => {
    seedRefreshCard(1);
    const saved = db.select().from(card).all();
    const fetchAnime = vi.fn(async () => { setOfflineMode(true); return { malId: 1 }; });
    const fetchThemes = vi.fn();
    await expect(refreshCardSources({ fetchAnime, fetchThemes }, vi.fn())).rejects.toBeInstanceOf(OfflineModeError);
    expect(fetchAnime).toHaveBeenCalledTimes(1);
    expect(fetchThemes).not.toHaveBeenCalled();
    expect(db.select().from(card).all()).toEqual(saved);
  });

  it("interrupts rate-limit waiting without retrying or stamping cards", async () => {
    vi.useFakeTimers();
    seedRefreshCard(1);
    const saved = db.select().from(card).all();
    const fetchAnime = vi.fn(async () => { setOfflineMode(true); throw new ProviderUnavailableError("AniList", 10_000); });
    await expect(refreshCardSources({ fetchAnime, fetchThemes: vi.fn() }, vi.fn())).rejects.toBeInstanceOf(OfflineModeError);
    expect(fetchAnime).toHaveBeenCalledTimes(1);
    expect(db.select().from(card).all()).toEqual(saved);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns local popularity cutoffs without background work offline", () => {
    setOfflineMode(true);
    expect(popularityCutoffs()).toMatchObject({ top500: expect.any(Number), top1000: expect.any(Number) });
    expect(requestAniList).not.toHaveBeenCalled();
  });
});
