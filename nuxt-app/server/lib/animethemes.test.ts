import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnimeMetadataFromAnimeThemes, searchAnimeOnAnimeThemes } from "./animethemes.ts";

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
