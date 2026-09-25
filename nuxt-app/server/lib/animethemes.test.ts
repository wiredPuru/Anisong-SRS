import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAnimeMetadataFromAnimeThemes,
  fetchAnimeThemesByAniListId,
  fetchThemeTitlesByAniListIds,
  searchAnimeOnAnimeThemes,
} from "./animethemes.ts";

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
      [1, { animethemesId: 521, animethemesSlug: null, themes: [{ animethemesThemeId: 9, songTitle: "Tank!", animethemesVideoSlug: null }] }],
      [2, { animethemesId: 522, animethemesSlug: null, themes: [{ animethemesThemeId: 10, songTitle: "Blue", animethemesVideoSlug: null }] }],
    ]));
  });

  it("omits an id AnimeThemes has no entry for", async () => {
    answer([anime(521, [1], [theme(9, "Tank!")])]);
    expect((await fetchThemeTitlesByAniListIds([1, 2])).has(2)).toBe(false);
  });

  it("falls back to the native title, and drops a theme with no song title", async () => {
    answer([anime(521, [1], [theme(9, null, "タンク!"), theme(10, null, null)])]);
    expect((await fetchThemeTitlesByAniListIds([1])).get(1)!.themes).toEqual([{ animethemesThemeId: 9, songTitle: "タンク!", animethemesVideoSlug: null }]);
  });

  it.each([null, -1, 0, 1.5, "1"])("skips an invalid mapping (%s) rather than guessing", async (id) => {
    answer([anime(521, [id], [theme(9, "Tank!")])]);
    expect((await fetchThemeTitlesByAniListIds([1])).size).toBe(0);
  });

  it("ignores an anime mapped to an id that was not asked for", async () => {
    answer([anime(521, [99], [theme(9, "Tank!")])]);
    expect((await fetchThemeTitlesByAniListIds([1])).size).toBe(0);
  });

  it("carries the anime slug and each theme's video slug for linking", async () => {
    answer([{
      ...anime(521, [1], [{
        ...theme(9, "Tank!"),
        type: "OP",
        sequence: 1,
        group: null,
        animethemeentries: [{ version: 1, videos: { nodes: [{ tags: "NCBD1080" }] } }],
      }]),
      slug: "cowboy_bebop",
    }]);
    expect((await fetchThemeTitlesByAniListIds([1])).get(1)).toEqual({
      animethemesId: 521,
      animethemesSlug: "cowboy_bebop",
      themes: [{ animethemesThemeId: 9, songTitle: "Tank!", animethemesVideoSlug: "OP1-NCBD1080" }],
    });
    const { query } = JSON.parse(fetch.mock.calls[0]![1].body);
    for (const field of ["slug", "type", "sequence", "group { slug }", "version", "tags"]) expect(query).toContain(field);
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

describe("AnimeThemes link slugs on anime import", () => {
  const video = (tags: unknown = null) => ({ link: "https://v.animethemes.moe/Bocchi-OP1.webm", tags, audio: null });
  const theme = (overrides: Record<string, unknown> = {}) => ({
    id: 9,
    slug: "OP1",
    type: "OP",
    sequence: 1,
    group: null,
    song: { title: { romaji: "Seishun Complex", native: null }, performances: [] },
    animethemeentries: [{ version: 1, videos: { nodes: [video("NCBD1080")] } }],
    ...overrides,
  });
  const answer = (record: Record<string, unknown>) =>
    fetch.mockResolvedValue(Response.json({ data: { findAnimeByExternalSite: [{ id: 521, slug: "bocchi_the_rock", animethemes: [theme()], ...record }] } }));

  it("asks for every part of the page slug", async () => {
    answer({});
    await fetchAnimeThemesByAniListId(1);
    const { query } = JSON.parse(fetch.mock.calls[0]![1].body);
    for (const field of ["slug", "type", "sequence", "group { slug }", "version", "tags"]) expect(query).toContain(field);
  });

  it("returns the anime slug and each theme's video slug", async () => {
    answer({ animethemes: [theme(), theme({ id: 10, type: "ED", sequence: 2, group: { slug: "dub" }, animethemeentries: [{ version: 2, videos: { nodes: [video()] } }] })] });
    const result = await fetchAnimeThemesByAniListId(1);
    expect(result!.animethemesSlug).toBe("bocchi_the_rock");
    expect(result!.themes.map((t) => t.animethemesVideoSlug)).toEqual(["OP1-NCBD1080", "ED2v2-dub"]);
  });

  it("leaves slugs null when fields are missing or malformed, without failing the import", async () => {
    answer({
      slug: 42,
      animethemes: [
        theme({ type: null }),
        theme({ id: 10, animethemeentries: [] }),
        theme({ id: 11, type: "OP", sequence: "2", group: "dub", animethemeentries: [{ version: "3", videos: { nodes: [video(7)] } }] }),
      ],
    });
    const result = await fetchAnimeThemesByAniListId(1);
    expect(result!.animethemesSlug).toBeNull();
    expect(result!.themes.map((t) => t.animethemesVideoSlug)).toEqual([null, null, "OP1"]);
  });
});
