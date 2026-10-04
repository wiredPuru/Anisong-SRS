import { describe, expect, it } from "vitest";
import {
  catalogFilterOptions,
  countActiveFilters,
  countTags,
  EMPTY_STUDY_FILTERS,
  filtersQueryValue,
  readStoredFilters,
  parseThemesParam,
  studyFiltersProblem,
  toBrowseFilters,
  tagBreakdown,
  clearThemeTypes,
  onlyThemeType,
  toggleThemeType,
  type StudyFilters,
} from "./studyFilters.ts";

const withFilters = (patch: Partial<StudyFilters>): StudyFilters => ({ ...EMPTY_STUDY_FILTERS, ...patch });

describe("countActiveFilters", () => {
  it("is zero for no filters, whatever the tag relevance", () => {
    expect(countActiveFilters(withFilters({ tagMinRank: 90 }))).toBe(0);
  });

  it("counts bound pairs and list choices once, and each genre and tag", () => {
    expect(countActiveFilters(withFilters({
      yearMin: 2000, yearMax: 2009, scoreMax: 80, formats: ["TV", "OVA"], themeTypes: ["OP"],
      genresInclude: ["Comedy"], genresExclude: ["Horror", "Drama"], tagsInclude: ["Moe"], tagsExclude: [],
    }))).toBe(8);
  });

  it("counts any number of seasons as one filter", () => {
    expect(countActiveFilters(withFilters({ seasons: ["SPRING", "FALL"] }))).toBe(1);
  });
});

describe("list filter fields", () => {
  const source = { site: "mal" as const, username: "Xinil", fetchedAt: "2026-09-25T00:00:00.000Z" };

  it("counts a list, even one that matched nothing, as one filter", () => {
    expect(countActiveFilters(withFilters({ listAniListIds: [1, 2], listSource: source }))).toBe(1);
    expect(countActiveFilters(withFilters({ listAniListIds: [], listSource: source }))).toBe(1);
  });

  it("restores a stored list with its source", () => {
    expect(readStoredFilters(JSON.stringify({ listAniListIds: [7], listSource: source }))).toEqual(
      withFilters({ listAniListIds: [7], listSource: source }),
    );
  });

  it.each([
    { listAniListIds: [7] },
    { listSource: source },
    { listAniListIds: [0], listSource: source },
    { listAniListIds: [7], listSource: { ...source, site: "kitsu" } },
    { listAniListIds: [7], listSource: { ...source, username: " " } },
  ])("falls back to no filters for a broken list %o", (stored) => {
    expect(readStoredFilters(JSON.stringify(stored))).toEqual(EMPTY_STUDY_FILTERS);
  });
});

describe("filtersQueryValue", () => {
  it("omits the param when nothing is active", () => {
    expect(filtersQueryValue(EMPTY_STUDY_FILTERS)).toBeUndefined();
  });

  it("serialises an active filter set", () => {
    expect(JSON.parse(filtersQueryValue(withFilters({ yearMin: 2000 }))!)).toMatchObject({ yearMin: 2000 });
  });
});

describe("studyFiltersProblem", () => {
  it.each([
    [{ yearMin: 1800 }, "1900"],
    [{ scoreMax: 100.5 }, "0 to 100"],
    [{ tagMinRank: -5 }, "0 to 100"],
    [{ yearMin: 2010, yearMax: 2000 }, "start year"],
    [{ scoreMin: 90, scoreMax: 10 }, "minimum score"],
  ] as const)("names the problem with %o", (patch, message) => {
    expect(studyFiltersProblem(withFilters(patch))).toContain(message);
  });

  it("accepts a valid set", () => {
    expect(studyFiltersProblem(withFilters({ yearMin: 2000, yearMax: 2000, scoreMin: 0, scoreMax: 100 }))).toBeNull();
  });
});

describe("readStoredFilters", () => {
  it.each([null, "", "{", "[]", "3", JSON.stringify({ genresInclude: "Comedy" }), JSON.stringify({ themeTypes: ["XX"] }),
    JSON.stringify({ seasons: ["AUTUMN"] }), JSON.stringify({ seasons: "SPRING" }),
    JSON.stringify({ yearMin: 2010, yearMax: 2000 }), JSON.stringify({ tagMinRank: "60" })])(
    "falls back to no filters for %j",
    (raw) => {
      expect(readStoredFilters(raw)).toEqual(EMPTY_STUDY_FILTERS);
    },
  );

  it("reads a set saved before seasons existed as having no season filter", () => {
    const beforeSeasons = { ...EMPTY_STUDY_FILTERS, yearMin: 2009 } as Partial<StudyFilters>;
    delete beforeSeasons.seasons;
    expect(readStoredFilters(JSON.stringify(beforeSeasons))).toEqual(withFilters({ yearMin: 2009 }));
    expect(readStoredFilters(JSON.stringify({ seasons: ["WINTER"] }))).toEqual(withFilters({ seasons: ["WINTER"] }));
  });

  it("fills missing fields and drops unknown ones", () => {
    expect(readStoredFilters(JSON.stringify({ yearMin: 2000, tagsInclude: ["Moe"], extra: true }))).toEqual(
      withFilters({ yearMin: 2000, tagsInclude: ["Moe"] }),
    );
  });
});

describe("tag counts", () => {
  const tags = [
    { name: "Moe", ranks: [60, 80, 40] },
    { name: "Band", ranks: [90, 95] },
    { name: "Idol", ranks: [70, 75] },
    { name: "Tragedy", ranks: [99] },
  ];

  it("counts only shows at or above the relevance cutoff", () => {
    expect(countTags(tags, 60, new Set())).toEqual([
      { name: "Band", count: 2 },
      { name: "Idol", count: 2 },
      { name: "Moe", count: 2 },
      { name: "Tragedy", count: 1 },
    ]);
    expect(countTags(tags, 0, new Set())[0]).toEqual({ name: "Moe", count: 3 });
  });

  it("breaks down only tags shared by two or more shows, minus chosen ones", () => {
    expect(tagBreakdown(tags, 60, new Set(["Idol"]))).toEqual([
      { name: "Band", count: 2 },
      { name: "Moe", count: 2 },
    ]);
    expect(tagBreakdown(tags, 75, new Set())).toEqual([{ name: "Band", count: 2 }]);
    expect(tagBreakdown([], 60, new Set())).toEqual([]);
  });
});

describe("readStoredFilters insert theme type", () => {
  it("keeps a saved Inserts theme filter", () => {
    expect(readStoredFilters(JSON.stringify({ themeTypes: ["IN"] })).themeTypes).toEqual(["IN"]);
  });
});

describe("theme chips", () => {
  const base = { ...EMPTY_STUDY_FILTERS };

  it("toggles a type on and off", () => {
    const on = toggleThemeType(base, "OP");
    expect(on.themeTypes).toEqual(["OP"]);
    expect(toggleThemeType(on, "OP").themeTypes).toEqual([]);
  });

  it("allows any combination", () => {
    const mix = toggleThemeType(toggleThemeType(base, "OP"), "IN");
    expect(mix.themeTypes).toEqual(["OP", "IN"]);
    expect(toggleThemeType(mix, "OP").themeTypes).toEqual(["IN"]);
  });

  it("collapses all three types to no filter", () => {
    const two = { ...base, themeTypes: ["OP" as const, "ED" as const] };
    expect(toggleThemeType(two, "IN").themeTypes).toEqual([]);
  });

  it("clears a mix and leaves other filters alone", () => {
    const filters = { ...base, yearMin: 2010, themeTypes: ["OP" as const, "IN" as const] };
    expect(clearThemeTypes(filters)).toMatchObject({ yearMin: 2010, themeTypes: [] });
    expect(filters.themeTypes).toEqual(["OP", "IN"]);
  });

  it("sets exactly one type for the /decks shortcuts", () => {
    expect(onlyThemeType({ ...base, themeTypes: ["OP", "ED"] }, "ED").themeTypes).toEqual(["ED"]);
  });

  it("accepts only the three theme types from the themes param", () => {
    expect(parseThemesParam("ED")).toBe("ED");
    expect(parseThemesParam("op")).toBeNull();
    expect(parseThemesParam(["OP"])).toBeNull();
    expect(parseThemesParam(undefined)).toBeNull();
  });
});

describe("catalog browse helpers", () => {
  it("adapts AniList's option lists to the form's shape", () => {
    const options = catalogFilterOptions({ genres: ["Ecchi"], tags: [{ name: "Cute Girls Doing Cute Things", category: "Theme" }] });
    expect(options).toMatchObject({ yearRange: null, genres: ["Ecchi"], missingDetailsCount: 0 });
    expect(options.tags).toEqual([{ name: "Cute Girls Doing Cute Things", ranks: [] }]);
    expect(options.formats).toContain("TV");
  });

  it("picks only the catalog fields and copies the lists", () => {
    const filters = { ...EMPTY_STUDY_FILTERS, yearMin: 2010, themeTypes: ["OP" as const], genresInclude: ["Ecchi"], listAniListIds: [1] };
    const picked = toBrowseFilters(filters);
    expect(picked).toEqual({
      yearMin: 2010, yearMax: null, seasons: [], scoreMin: null, scoreMax: null, formats: [],
      genresInclude: ["Ecchi"], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
    });
    picked.genresInclude.push("Horror");
    expect(filters.genresInclude).toEqual(["Ecchi"]);
  });
});
