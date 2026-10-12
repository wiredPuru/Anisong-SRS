import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anime, apiCache, mediaLibrarySettings } from "../db/schema.ts";

vi.unmock("../utils/networkMode.ts");
vi.unmock("../utils/apiCache.ts");
vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const media = {
  id: 1,
  idMal: 11,
  title: { romaji: "Show", english: null, native: null },
  coverImage: { large: "https://example.test/cover.jpg" },
  genres: [],
  tags: [],
  season: null,
  format: "TV",
  averageScore: null,
  popularity: null,
};
const fetchMock = vi.fn();
let database: typeof import("../db/client.ts").db;
let settings: typeof import("../utils/mediaLibrary.ts");
let policy: typeof import("../utils/networkMode.ts");
let cache: typeof import("../utils/apiCache.ts");
let aniList: typeof import("./anilist.ts");
let animeThemes: typeof import("./animethemes.ts");
let anisong: typeof import("./anisongdb.ts");
let mal: typeof import("./mal.ts");

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T13:00:00Z"));
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    if (url.includes("anilist.co")) return Response.json({ data: { Media: media, Page: { media: [media] } } });
    if (url.includes("animethemes.moe")) return Response.json({ data: { animePagination: { data: [] } } });
    return Response.json([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  database = (await import("../db/client.ts")).db;
  database.delete(apiCache).run();
  database.delete(anime).run();
  database.delete(mediaLibrarySettings).run();
  settings = await import("../utils/mediaLibrary.ts");
  policy = await import("../utils/networkMode.ts");
  cache = await import("../utils/apiCache.ts");
  aniList = await import("./anilist.ts");
  animeThemes = await import("./animethemes.ts");
  anisong = await import("./anisongdb.ts");
  mal = await import("./mal.ts");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function providerCall(provider: string) {
  if (provider === "anilist") return aniList.fetchAnimeFromAniList(1);
  if (provider === "animethemes") return animeThemes.searchAnimeOnAnimeThemes("Show");
  return anisong.fetchThemesByMalId(11, 1);
}

describe("offline metadata provider enforcement", () => {
  it.each(["anilist", "animethemes", "anisongdb"])("blocks cold %s requests before cache reads or writes", async (provider) => {
    settings.setOfflineMode(true);
    const through = vi.spyOn(cache.apiResponseCache, "through");
    await expect(providerCall(provider)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(through).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(database.select().from(apiCache).all()).toEqual([]);
  });

  it.each(["anilist", "animethemes", "anisongdb"])("does not bypass offline mode with a warm %s answer", async (provider) => {
    const result = await providerCall(provider);
    const saved = database.select().from(apiCache).all();
    expect(saved).toHaveLength(1);
    settings.setOfflineMode(true);
    await expect(providerCall(provider)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(database.select().from(apiCache).all()).toEqual(saved);
    settings.setOfflineMode(false);
    await expect(providerCall(provider)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["anilist", "animethemes", "anisongdb"])("does not turn offline intent into stale %s success", async (provider) => {
    await providerCall(provider);
    database.update(apiCache).set({ expiresAt: Date.now() - 1 }).run();
    const saved = database.select().from(apiCache).all();
    settings.setOfflineMode(true);
    await expect(providerCall(provider)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(database.select().from(apiCache).all()).toEqual(saved);
  });

  it.each(["anilist", "animethemes", "anisongdb"])("rechecks %s after cache lookup and before external fetch", async (provider) => {
    vi.spyOn(cache.apiResponseCache, "through").mockImplementationOnce(async (_provider, _parts, _ttl, run) => {
      settings.setOfflineMode(true);
      return run();
    });
    await expect(providerCall(provider)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(database.select().from(apiCache).all()).toEqual([]);
  });

  it("guards raw GraphQL fetch outside its outage catch", async () => {
    settings.setOfflineMode(true);
    const { postGraphQL, ProviderUnavailableError } = await import("./graphql.ts");
    const blocked = postGraphQL("https://example.test/graphql", "Provider", "query {}", {});
    await expect(blocked).rejects.toMatchObject({ statusCode: 409, data: { code: "OFFLINE_MODE" } });
    await expect(blocked).rejects.not.toBeInstanceOf(ProviderUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks fresh refresh without creating an AniList cooldown", async () => {
    settings.setOfflineMode(true);
    await expect(aniList.fetchAnimeFromAniListFresh(1)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(fetchMock).not.toHaveBeenCalled();
    settings.setOfflineMode(false);
    await expect(aniList.fetchAnimeFromAniListFresh(1)).resolves.toMatchObject({ aniListId: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports offline intent without resetting an existing provider cooldown", async () => {
    fetchMock.mockResolvedValueOnce(new Response("limited", { status: 429, headers: { "retry-after": "120" } }));
    await expect(aniList.fetchAnimeFromAniListFresh(1)).rejects.toMatchObject({ statusCode: 503 });
    settings.setOfflineMode(true);
    await expect(aniList.fetchAnimeFromAniListFresh(1)).rejects.toBeInstanceOf(policy.OfflineModeError);
    settings.setOfflineMode(false);
    await expect(aniList.fetchAnimeFromAniListFresh(1)).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120_000);
    await expect(aniList.fetchAnimeFromAniListFresh(1)).resolves.toMatchObject({ aniListId: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks uncached random AnisongDB discovery", async () => {
    settings.setOfflineMode(true);
    await expect(anisong.fetchRandomSongs(10)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks the first MAL page without relabeling it as an outage", async () => {
    settings.setOfflineMode(true);
    const onPage = vi.fn();
    await expect(mal.fetchMalCompletedList("user", onPage)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(onPage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops MAL pagination when offline mode is enabled between pages", async () => {
    fetchMock.mockResolvedValue(Response.json(Array.from({ length: 300 }, (_, index) => ({ anime_id: index + 1, anime_title: `Show ${index + 1}` }))));
    const onPage = vi.fn(() => settings.setOfflineMode(true));
    await expect(mal.fetchMalCompletedList("user", onPage)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPage).toHaveBeenCalledExactlyOnceWith(1, 300);
  });

  it("returns saved metadata offline without changing its checked timestamp", async () => {
    const { upsertAnime } = await import("../utils/lookup.ts");
    const { createAnimeMetadataResolver } = await import("../utils/animeMetadata.ts");
    const stored = upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Saved", titleEnglish: null, titleNative: null, details: {
      year: 2020, season: "SPRING", format: "TV", averageScore: 80, popularity: 100, genres: ["Music"], tags: [],
    } });
    settings.setOfflineMode(true);
    vi.advanceTimersByTime(60_000);
    await expect(createAnimeMetadataResolver().byAniListId(1)).resolves.toMatchObject({
      titleRomaji: "Saved", aniListDetailsCheckedAt: stored.aniListDetailsCheckedAt, details: { year: 2020 },
    });
    expect(database.select().from(anime).where(eq(anime.id, stored.id)).get()).toEqual(stored);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not attempt a fallback when a resolver already remembers an outage", async () => {
    const { createAnimeMetadataResolver } = await import("../utils/animeMetadata.ts");
    const resolver = createAnimeMetadataResolver();
    fetchMock.mockImplementation(async (url: string) => url.includes("anilist.co")
      ? new Response("down", { status: 503 }) : Response.json({ data: { findAnimeByExternalSite: [] } }));
    await expect(resolver.byAniListId(1)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    settings.setOfflineMode(true);
    await expect(resolver.byAniListId(2)).rejects.toBeInstanceOf(policy.OfflineModeError);
    await expect(resolver.byMalId(11)).rejects.toBeInstanceOf(policy.OfflineModeError);
    await expect(resolver.search("Show")).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks explicit refresh before injected fetch or metadata writes", async () => {
    const { upsertAnime } = await import("../utils/lookup.ts");
    const { refreshAnimeMetadata } = await import("../utils/animeMetadataRefresh.ts");
    const stored = upsertAnime({ aniListId: 1, animethemesId: null, titleRomaji: "Saved", titleEnglish: null, titleNative: null });
    settings.setOfflineMode(true);
    const refreshFetch = vi.fn();
    await expect(refreshAnimeMetadata(stored.id, refreshFetch)).rejects.toBeInstanceOf(policy.OfflineModeError);
    expect(refreshFetch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(database.select().from(anime).where(eq(anime.id, stored.id)).get()).toEqual(stored);
  });
});
