import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseBrowseBody } from "../utils/anilistBrowseBody.ts";

const fetchMock = vi.fn();
let browse: typeof import("./anilistBrowse.ts");

const noFilters = () => {
  const parsed = parseBrowseBody({});
  if ("error" in parsed) throw new Error("unexpected");
  return parsed.filters;
};
const withFilters = (filters: Record<string, unknown>) => {
  const parsed = parseBrowseBody({ filters });
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.filters;
};

function media(id: number, popularity: number, extra: Record<string, unknown> = {}) {
  return { id, title: { romaji: `Show ${id}`, english: null, native: null }, coverImage: { large: "c.jpg" }, season: "SPRING", seasonYear: 2012, startDate: { year: 2012 }, format: "TV", averageScore: 75, popularity, ...extra };
}
const pageReply = (items: unknown[], hasNextPage = false) => Response.json({ data: { Page: { pageInfo: { hasNextPage }, media: items } } });

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  browse = await import("./anilistBrowse.ts");
});
afterEach(() => vi.unstubAllGlobals());

describe("buildBrowseVariables", () => {
  it("only asks for popularity, 50 per page, and no adult titles with no filters", () => {
    expect(browse.buildBrowseVariables(noFilters(), 2)).toEqual({ page: 2, perPage: 50, sort: ["POPULARITY_DESC"], isAdult: false });
  });

  it("widens exclusive year and score bounds so the filter's own bounds are inclusive", () => {
    const variables = browse.buildBrowseVariables(withFilters({ yearMin: 2010, yearMax: 2019, scoreMin: 70, scoreMax: 90 }), 1);
    expect(variables).toMatchObject({ startDateGreater: 20091231, startDateLesser: 20191232, scoreGreater: 69, scoreLesser: 91 });
  });

  it("maps genres, tags, formats, and passes the tag rank only when tags are used", () => {
    const withTags = browse.buildBrowseVariables(withFilters({ genresInclude: ["Ecchi"], genresExclude: ["Horror"], tagsInclude: ["Cute Girls Doing Cute Things"], tagsExclude: ["Gore"], formats: ["TV", "ONA"], tagMinRank: 70 }), 1);
    expect(withTags).toMatchObject({ genreIn: ["Ecchi"], genreNotIn: ["Horror"], tagIn: ["Cute Girls Doing Cute Things"], tagNotIn: ["Gore"], formatIn: ["TV", "ONA"], minimumTagRank: 70 });
    expect(browse.buildBrowseVariables(withFilters({ genresInclude: ["Ecchi"] }), 1)).not.toHaveProperty("minimumTagRank");
  });

  it("adds a single season when one is given", () => {
    expect(browse.buildBrowseVariables(noFilters(), 1, "FALL")).toMatchObject({ season: "FALL" });
  });
});

describe("browseAniList", () => {
  it("returns one page mapped and reports whether more exist", async () => {
    fetchMock.mockResolvedValueOnce(pageReply([media(1, 500), media(2, 900, { seasonYear: null, startDate: { year: 2009 } })], true));
    const result = await browse.browseAniList(noFilters(), 1);
    expect(result.hasNextPage).toBe(true);
    expect(result.items.map((item) => item.aniListId)).toEqual([2, 1]);
    expect(result.items[0]).toMatchObject({ year: 2009, season: "SPRING", format: "TV", coverImageUrl: "c.jpg" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("queries each selected season, merges by popularity, and drops a duplicate id", async () => {
    fetchMock
      .mockResolvedValueOnce(pageReply([media(1, 100), media(2, 300)]))
      .mockResolvedValueOnce(pageReply([media(2, 300), media(3, 200)], true));
    const result = await browse.browseAniList(withFilters({ seasons: ["SPRING", "FALL"] }), 1);
    expect(result.items.map((item) => item.aniListId)).toEqual([2, 3, 1]);
    expect(result.hasNextPage).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats an empty page as no results", async () => {
    fetchMock.mockResolvedValueOnce(pageReply([]));
    expect(await browse.browseAniList(noFilters(), 1)).toEqual({ items: [], hasNextPage: false });
  });

  it("raises ProviderUnavailableError for a malformed media entry", async () => {
    fetchMock.mockResolvedValueOnce(pageReply([{ id: 1 }]));
    await expect(browse.browseAniList(noFilters(), 1)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("fetchBrowseOptions", () => {
  it("drops adult tags and the Hentai genre", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: {
      GenreCollection: ["Action", "Ecchi", "Hentai"],
      MediaTagCollection: [
        { name: "Cute Girls Doing Cute Things", category: "Theme-Slice of Life", isAdult: false },
        { name: "Bondage", category: "Sexual Content", isAdult: true },
      ],
    } }));
    expect(await browse.fetchBrowseOptions()).toEqual({
      genres: ["Action", "Ecchi"],
      tags: [{ name: "Cute Girls Doing Cute Things", category: "Theme-Slice of Life" }],
    });
  });

  it("raises ProviderUnavailableError for an unusable reply", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { GenreCollection: [1], MediaTagCollection: [] } }));
    await expect(browse.fetchBrowseOptions()).rejects.toMatchObject({ statusCode: 503 });
  });
});
