import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  EMPTY_STUDY_FILTERS,
  filtersQueryValue,
  readStoredFilters,
  studyFiltersProblem,
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
  it.each([null, "", "{", "[]", "3", JSON.stringify({ genresInclude: "Comedy" }), JSON.stringify({ themeTypes: ["IN"] }),
    JSON.stringify({ yearMin: 2010, yearMax: 2000 }), JSON.stringify({ tagMinRank: "60" })])(
    "falls back to no filters for %j",
    (raw) => {
      expect(readStoredFilters(raw)).toEqual(EMPTY_STUDY_FILTERS);
    },
  );

  it("fills missing fields and drops unknown ones", () => {
    expect(readStoredFilters(JSON.stringify({ yearMin: 2000, tagsInclude: ["Moe"], extra: true }))).toEqual(
      withFilters({ yearMin: 2000, tagsInclude: ["Moe"] }),
    );
  });
});
