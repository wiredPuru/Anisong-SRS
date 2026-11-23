import { describe, expect, it } from "vitest";
import { catalogSongFilters, matchesSeasons, withoutLabels } from "./partyCatalogFilters.ts";
import type { StudyFilters } from "./studyFilters.ts";

const EMPTY: StudyFilters = {
  yearMin: null, yearMax: null, seasons: [], scoreMin: null, scoreMax: null, formats: [], studios: [], themeTypes: [], themeMix: null,
  genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
  listAniListIds: null, listSource: null,
};

const filters = (over: Partial<StudyFilters>): StudyFilters => ({ ...EMPTY, ...over });

describe("catalogSongFilters", () => {
  it("sends only OP and ED with no filters, and inserts when the setting is on", () => {
    expect(catalogSongFilters(null, false)).toEqual({ options: { song_types: ["opening", "ending"] }, seasons: null, notApplied: [] });
    expect(catalogSongFilters(EMPTY, true)).toEqual({ options: { song_types: ["opening", "ending", "insert"] }, seasons: null, notApplied: [] });
  });

  it("maps theme types and formats, merging TV and TV short", () => {
    const { options } = catalogSongFilters(filters({ themeTypes: ["OP", "IN"], formats: ["TV", "TV_SHORT", "MOVIE", "MUSIC"] }), false);
    expect(options.song_types).toEqual(["opening", "insert"]);
    expect(options.anime_types).toEqual(["tv", "movie", "other"]);
  });

  it("maps genres and tags to require_all and exclude", () => {
    const { options } = catalogSongFilters(filters({ genresInclude: ["Comedy"], genresExclude: ["Horror"], tagsExclude: ["Gore"] }), false);
    expect(options.genres).toEqual({ require_all: ["Comedy"], exclude: ["Horror"] });
    expect(options.tags).toEqual({ exclude: ["Gore"] });
  });

  it("turns a year range into a season range with open ends", () => {
    expect(catalogSongFilters(filters({ yearMin: 2009, yearMax: 2012 }), false).options.season).toEqual({ start: "Winter 2009", end: "Fall 2012" });
    expect(catalogSongFilters(filters({ yearMin: 2009 }), false).options.season).toEqual({ start: "Winter 2009", end: null });
    expect(catalogSongFilters(filters({ yearMax: 2012 }), false).options.season).toEqual({ start: null, end: "Fall 2012" });
  });

  it("covers one year with an unbroken run of seasons by the range alone", () => {
    const result = catalogSongFilters(filters({ yearMin: 2013, yearMax: 2013, seasons: ["FALL", "SUMMER"] }), false);
    expect(result.options.season).toEqual({ start: "Summer 2013", end: "Fall 2013" });
    expect(result.seasons).toBeNull();
  });

  it("checks seasons after fetching across years, with gaps, or with no year", () => {
    expect(catalogSongFilters(filters({ yearMin: 2009, yearMax: 2012, seasons: ["FALL"] }), false)).toMatchObject({
      options: { season: { start: "Winter 2009", end: "Fall 2012" } },
      seasons: ["FALL"],
    });
    expect(catalogSongFilters(filters({ yearMin: 2013, yearMax: 2013, seasons: ["WINTER", "FALL"] }), false).seasons).toEqual(["WINTER", "FALL"]);
    const noYear = catalogSongFilters(filters({ seasons: ["SPRING"] }), false);
    expect(noYear.options.season).toBeUndefined();
    expect(noYear.seasons).toEqual(["SPRING"]);
  });

  it("names only the set filters AnisongDB cannot apply", () => {
    expect(catalogSongFilters(filters({ genresInclude: ["Comedy"], yearMin: 2000 }), false).notApplied).toEqual([]);
    expect(
      catalogSongFilters(
        filters({ scoreMin: 70, studios: ["Kyoto Animation"], listAniListIds: [1], tagsInclude: ["Iyashikei"], themeMix: { OP: 70, ED: 30, IN: 0 } }),
        false,
      ).notApplied,
    ).toEqual(["AniList score", "Studio", "Anime list", "Tag relevance", "OP/ED mix"]);
  });
});

describe("matchesSeasons", () => {
  it("passes everything when no check is needed", () => {
    expect(matchesSeasons(null, null)).toBe(true);
  });

  it("matches the vintage's season name", () => {
    expect(matchesSeasons("Fall 2013", ["FALL"])).toBe(true);
    expect(matchesSeasons("  fall   2013", ["FALL"])).toBe(true);
    expect(matchesSeasons("Spring 2013", ["FALL", "WINTER"])).toBe(false);
  });

  it("fails a missing or malformed vintage", () => {
    expect(matchesSeasons(null, ["FALL"])).toBe(false);
    expect(matchesSeasons("", ["FALL"])).toBe(false);
    expect(matchesSeasons("2013", ["FALL"])).toBe(false);
  });
});

describe("withoutLabels", () => {
  const options = { song_types: ["opening" as const], genres: { require_all: ["Comedy", "Nope"] }, tags: { exclude: ["Nope"] } };

  it("returns the same options when nothing is unknown", () => {
    expect(withoutLabels(options, [])).toBe(options);
  });

  it("drops unknown names from genres and tags, and empty filters entirely", () => {
    expect(withoutLabels(options, ["Nope"])).toEqual({ song_types: ["opening"], genres: { require_all: ["Comedy"] } });
    expect(withoutLabels(options, ["Nope", "Comedy"])).toEqual({ song_types: ["opening"] });
  });
});
