import { describe, expect, it } from "vitest";
import { describeLibraryFilter, EMPTY_LIBRARY_FILTER, libraryFilterActive, libraryQuery, type LibraryFilter } from "./libraryFilter";
import { EMPTY_STUDY_FILTERS } from "./studyFilters";

const withFilters = (filters: Partial<LibraryFilter["filters"]>, downloadedOnly = false): LibraryFilter => ({
  filters: { ...EMPTY_STUDY_FILTERS, ...filters },
  downloadedOnly,
});

describe("libraryFilterActive", () => {
  it("is off for the empty filter", () => {
    expect(libraryFilterActive(EMPTY_LIBRARY_FILTER)).toBe(false);
  });

  it("is on for Downloaded alone or any anime filter alone", () => {
    expect(libraryFilterActive(withFilters({}, true))).toBe(true);
    expect(libraryFilterActive(withFilters({ themeTypes: ["IN"] }))).toBe(true);
    expect(libraryFilterActive(withFilters({ genresInclude: ["Comedy"] }))).toBe(true);
  });

  it("ignores a tag rank that narrows nothing by itself", () => {
    expect(libraryFilterActive(withFilters({ tagMinRank: 80 }))).toBe(false);
  });
});

describe("libraryQuery", () => {
  it("sends nothing for the empty filter", () => {
    expect(libraryQuery(EMPTY_LIBRARY_FILTER)).toEqual({ filters: undefined, downloaded: undefined });
  });

  it("sends only Downloaded when no anime filter is set", () => {
    expect(libraryQuery(withFilters({}, true))).toEqual({ filters: undefined, downloaded: "1" });
  });

  it("sends the filters as JSON the server can parse", () => {
    const query = libraryQuery(withFilters({ themeTypes: ["IN"] }, true));
    expect(query.downloaded).toBe("1");
    expect(JSON.parse(query.filters ?? "{}").themeTypes).toEqual(["IN"]);
  });
});

describe("describeLibraryFilter", () => {
  it("is empty when nothing is set", () => {
    expect(describeLibraryFilter(EMPTY_LIBRARY_FILTER)).toBe("");
  });

  it("names Downloaded alone", () => {
    expect(describeLibraryFilter(withFilters({}, true))).toBe("Downloaded");
  });

  it("names insert songs alone", () => {
    expect(describeLibraryFilter(withFilters({ themeTypes: ["IN"] }))).toBe("Insert songs");
  });

  it("joins the song kinds and Downloaded", () => {
    expect(describeLibraryFilter(withFilters({ themeTypes: ["OP", "ED"] }, true))).toBe("Openings + endings, downloaded");
    expect(describeLibraryFilter(withFilters({ themeTypes: ["IN"] }, true))).toBe("Insert songs, downloaded");
  });

  it("counts every other anime filter instead of listing them", () => {
    expect(describeLibraryFilter(withFilters({ yearMin: 2010, genresInclude: ["Comedy", "Drama"] }))).toBe("3 other filters");
    expect(describeLibraryFilter(withFilters({ themeTypes: ["IN"], seasons: ["FALL"] }, true))).toBe("Insert songs, downloaded, 1 other filter");
  });
});
