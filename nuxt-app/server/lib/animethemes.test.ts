import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnimeMetadataFromAnimeThemes, fetchThemeTitlesByAniListIds, searchAnimeOnAnimeThemes } from "./animethemes.ts";

const record = (id = 521, aniListId: unknown = 1) => ({ id, title: { romaji: "Cowboy Bebop", english: null, native: null }, resources: { nodes: [{ externalId: aniListId }] } });
const fetch = vi.fn();
beforeEach(() => { fetch.mockReset(); vi.stubGlobal("fetch", fetch); });
afterEach(() => vi.unstubAllGlobals());

describe("AnimeThemes identity mapping", () => {
  it.each(["ANILIST", "MAL"] as const)("uses exact %s IDs and omits unavailable cover art", async (site) => {
    fetch.mockResolvedValue(Response.json({ data: { findAnimeByExternalSite: [record()] } }));
    expect(await fetchAnimeMetadataFromAnimeThemes(1, site)).toEqual({ aniListId: 1, animethemesId: 521, titleRomaji: "Cowboy Bebop", titleEnglish: null, titleNative: null });
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.variables).toEqual({ id: [1] });
    expect(body.query).toContain(`site: ${site}, id: $id`);
    expect(body.query).toContain("resources(site: ANILIST, first: 1)");
  });

  it.each([null, -1, 0, 1.5, "1", undefined])("skips invalid mappings (%s) without substituting the AnimeThemes ID", async (id) => {
    fetch.mockResolvedValue(Response.json({ data: { findAnimeByExternalSite: [record(521, id)] } }));
    // undefined invokes the fixture's default, so explicitly remove the mapping.
    if (id === undefined) fetch.mockResolvedValue(Response.json({ data: { findAnimeByExternalSite: [{ ...record(), resources: { nodes: [] } }] } }));
    expect(await fetchAnimeMetadataFromAnimeThemes(1, "MAL")).toBeNull();
  });

  it("rejects conflicting or mismatched exact mappings", async () => {
    for (const records of [[record(521, 2)], [record(), record(522, 1)], [record(), record(522, 2)]]) {
      fetch.mockResolvedValue(Response.json({ data: { findAnimeByExternalSite: records } }));
      await expect(fetchAnimeMetadataFromAnimeThemes(1, "ANILIST")).rejects.toMatchObject({ statusCode: 503 });
    }
  });

  it("returns valid distinct search candidates, omitting conflicts and invalid mappings", async () => {
    fetch.mockResolvedValue(Response.json({ data: { animePagination: { data: [record(), record(), record(600, 2), record(601, 2), record(700, null), record(800, 3)] } } }));
    expect((await searchAnimeOnAnimeThemes("Bebop")).map((anime) => anime.aniListId)).toEqual([1, 3]);
  });

  it("caps valid search results at ten", async () => {
    fetch.mockResolvedValue(Response.json({ data: { animePagination: { data: Array.from({ length: 15 }, (_, i) => record(500 + i, i + 1)) } } }));
    expect(await searchAnimeOnAnimeThemes("anime")).toHaveLength(10);
  });

  it("keeps empty results distinct from a failed or malformed backup", async () => {
    fetch.mockResolvedValueOnce(Response.json({ data: { findAnimeByExternalSite: [] } }))
      .mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    expect(await fetchAnimeMetadataFromAnimeThemes(1, "MAL")).toBeNull();
    await expect(fetchAnimeMetadataFromAnimeThemes(1, "MAL")).rejects.toThrow();
    await expect(searchAnimeOnAnimeThemes("Bebop")).rejects.toThrow();
  });
});

describe("AnimeThemes theme titles by AniList id", () => {
  const theme = (id: number, romaji: string | null, native: string | null = null) => ({ id, song: romaji || native ? { title: { romaji, native } } : null });
  const anime = (id: number, aniListIds: unknown[], themes: unknown[]) => ({ id, resources: { nodes: aniListIds.map((externalId) => ({ externalId })) }, animethemes: themes });
  const answer = (records: unknown[]) => fetch.mockResolvedValue(Response.json({ data: { findAnimeByExternalSite: records } }));

  it("sends every id in one request", async () => {
    answer([]);
    await fetchThemeTitlesByAniListIds([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.variables).toEqual({ anilistId: [1, 2, 3] });
    expect(body.query).toContain("site: ANILIST, id: $anilistId");
  });

  it("maps each anime back to the AniList id it was asked for", async () => {
    answer([anime(521, [1], [theme(9, "Tank!")]), anime(522, [2], [theme(10, "Blue")])]);
    expect(await fetchThemeTitlesByAniListIds([1, 2])).toEqual(new Map([
      [1, { animethemesId: 521, themes: [{ animethemesThemeId: 9, songTitle: "Tank!" }] }],
      [2, { animethemesId: 522, themes: [{ animethemesThemeId: 10, songTitle: "Blue" }] }],
    ]));
  });

  it("omits an id AnimeThemes has no entry for", async () => {
    answer([anime(521, [1], [theme(9, "Tank!")])]);
    expect((await fetchThemeTitlesByAniListIds([1, 2])).has(2)).toBe(false);
  });

  it("falls back to the native title, and drops a theme with no song title", async () => {
    answer([anime(521, [1], [theme(9, null, "タンク!"), theme(10, null, null)])]);
    expect((await fetchThemeTitlesByAniListIds([1])).get(1)!.themes).toEqual([{ animethemesThemeId: 9, songTitle: "タンク!" }]);
  });

  it.each([null, -1, 0, 1.5, "1"])("skips an invalid mapping (%s) rather than guessing", async (id) => {
    answer([anime(521, [id], [theme(9, "Tank!")])]);
    expect((await fetchThemeTitlesByAniListIds([1])).size).toBe(0);
  });

  it("ignores an anime mapped to an id that was not asked for", async () => {
    answer([anime(521, [99], [theme(9, "Tank!")])]);
    expect((await fetchThemeTitlesByAniListIds([1])).size).toBe(0);
  });

  it("skips a malformed record but keeps the well-formed ones", async () => {
    answer([{ id: 1 }, anime(521, [1], [theme(9, "Tank!")])]);
    expect([...(await fetchThemeTitlesByAniListIds([1])).keys()]).toEqual([1]);
  });

  it("treats a missing result list as an outage, not as nothing matching", async () => {
    fetch.mockResolvedValue(Response.json({ data: {} }));
    await expect(fetchThemeTitlesByAniListIds([1])).rejects.toMatchObject({ statusCode: 503 });
  });
});
