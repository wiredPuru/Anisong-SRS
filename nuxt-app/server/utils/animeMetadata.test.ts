import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { findAnimeByAniListId, getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const raw = (id: number) => ({ id: 500 + id, title: { romaji: `Anime ${id}`, english: null, native: null }, resources: { nodes: [{ externalId: id }] } });
const fetch = vi.fn();
let createResolver: typeof import("./animeMetadata.ts").createAnimeMetadataResolver;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
  createResolver = (await import("./animeMetadata.ts")).createAnimeMetadataResolver;
  fetch.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.includes("anilist.co")) return new Response("outage", { status: 403 });
    const { variables } = JSON.parse(String(init.body));
    return Response.json({ data: { findAnimeByExternalSite: [raw(variables.id[0])] } });
  });
});
afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(artist).run(); db.delete(anime).run();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe("metadata resolver during AniList downtime", () => {
  it("uses stored metadata without requesting the backup", async () => {
    const stored = upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Stored", titleEnglish: "English", titleNative: "日本語", coverImageUrl: "cover.jpg" });
    expect(await createResolver().byAniListId(1)).toMatchObject(stored);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back for uncached anime and retains that choice in a long bulk import", async () => {
    const resolver = createResolver();
    expect(await resolver.byAniListId(1)).toMatchObject({ aniListId: 1, animethemesId: 501 });
    vi.advanceTimersByTime(120_000);
    expect(await resolver.byAniListId(2)).toMatchObject({ aniListId: 2 });
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("anilist.co"))).toHaveLength(1);
    fetch.mockResolvedValueOnce(Response.json({ data: { Media: { id: 3, title: { romaji: "Recovered", english: "Recovered EN", native: "復旧" } } } }));
    expect(await createResolver().byAniListId(3)).toMatchObject({ titleRomaji: "Recovered" });
  });

  it("resolves MAL's exact mapping to the richer stored AniList row", async () => {
    const stored = upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Stored", titleEnglish: "English", titleNative: "日本語", coverImageUrl: "cover.jpg" });
    expect(await createResolver().byMalId(1)).toMatchObject(stored);
    expect(JSON.parse(fetch.mock.calls[1]![1].body).query).toContain("site: MAL");
  });

  it("does not fall back for primary not-found or validation failures", async () => {
    fetch.mockResolvedValueOnce(Response.json({ data: { Media: null } }));
    expect(await createResolver().byAniListId(1)).toBeNull();
    fetch.mockResolvedValueOnce(new Response("invalid", { status: 400 }));
    await expect(createResolver().byAniListId(1)).rejects.toThrow("rejected");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports backup failure instead of a missing MAL mapping", async () => {
    fetch.mockResolvedValue(new Response("outage", { status: 503 }));
    await expect(createResolver().byMalId(1)).rejects.toMatchObject({ statusCode: 503, statusMessage: expect.stringContaining("try again") });
  });

  it("preserves sparse fields, existing rows and cards, then accepts richer primary metadata", async () => {
    const stored = upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Stored", titleEnglish: "English", titleNative: "日本語", coverImageUrl: "cover.jpg" });
    const performer = getOrCreateArtist("Singer");
    const songData = { animeId: stored.id, artistId: performer.id, title: "Opening", themeSlot: "OP1", animethemesThemeId: 123 };
    const theme = upsertSong(songData);
    const savedCard = db.insert(card).values({ songId: theme.id, animethemesAudioUrl: "https://a.animethemes.moe/clip.ogg", box: 4, streak: 3 }).returning().get();
    expect(upsertAnime({ aniListId: 1, animethemesId: null, titleRomaji: "Stored", titleEnglish: null, titleNative: null })).toEqual(stored);
    expect(upsertSong(songData).id).toBe(theme.id);
    expect(db.select().from(anime).all()).toHaveLength(1);
    expect(db.select().from(song).all()).toHaveLength(1);
    expect(db.select().from(card).all()).toEqual([savedCard]);
    upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Stored", titleEnglish: "Better English", titleNative: "更新", coverImageUrl: "new-cover.jpg" });
    expect(findAnimeByAniListId(1)).toMatchObject({ id: stored.id, titleEnglish: "Better English", titleNative: "更新", coverImageUrl: "new-cover.jpg" });
  });

  it("uses title defaults and no cover for a fresh sparse row", () => {
    expect(upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Romaji", titleEnglish: null, titleNative: null })).toMatchObject({ titleEnglish: "Romaji", titleNative: "Romaji", coverImageUrl: null });
  });
});


describe("fallback anime search", () => {
  it("uses primary results and treats a successful empty search normally", async () => {
    fetch.mockResolvedValueOnce(Response.json({ data: { Page: { media: [{ id: 1, title: { romaji: "Primary", english: null, native: null } }] } } }))
      .mockResolvedValueOnce(Response.json({ data: { Page: { media: [] } } }));
    expect(await createResolver().search("primary")).toEqual([{ aniListId: 1, titleRomaji: "Primary", titleEnglish: null, titleNative: null, coverImageUrl: null }]);
    expect(await createResolver().search("empty")).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns only candidate fields, with richer stored metadata where available", async () => {
    upsertAnime({ aniListId: 1, animethemesId: 501, titleRomaji: "Stored", titleEnglish: "English", titleNative: "日本語", coverImageUrl: "cover.jpg" });
    fetch.mockResolvedValueOnce(new Response("", { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: { animePagination: { data: [raw(1), raw(2), raw(2)] } } }));
    expect(await createResolver().search("anime")).toEqual([
      { aniListId: 1, titleRomaji: "Stored", titleEnglish: "English", titleNative: "日本語", coverImageUrl: "cover.jpg" },
      { aniListId: 2, titleRomaji: "Anime 2", titleEnglish: null, titleNative: null, coverImageUrl: null },
    ]);
  });

  it("distinguishes an empty fallback search from a dual outage", async () => {
    fetch.mockResolvedValueOnce(new Response("", { status: 403 }))
      .mockResolvedValueOnce(Response.json({ data: { animePagination: { data: [] } } }))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    expect(await createResolver().search("missing")).toEqual([]);
    await expect(createResolver().search("outage")).rejects.toMatchObject({ statusCode: 503, statusMessage: expect.stringContaining("try again") });
  });

  it("does not hide search query validation failures behind the backup", async () => {
    fetch.mockResolvedValue(Response.json({ errors: [{ message: "Cannot query field wrong" }] }));
    await expect(createResolver().search("query")).rejects.toThrow("rejected");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
