import { describe, expect, it } from "vitest";
import { describeFilters, formatClock } from "./partyLiteFilters";
import { EMPTY_STUDY_FILTERS } from "./studyFilters";

describe("describeFilters", () => {
  it("is empty with no filters", () => {
    expect(describeFilters(EMPTY_STUDY_FILTERS)).toEqual([]);
  });

  it("names each active filter and marks exclusions", () => {
    const chips = describeFilters({
      ...EMPTY_STUDY_FILTERS,
      themeTypes: ["OP"],
      yearMin: 2000,
      yearMax: 2015,
      seasons: ["FALL"],
      scoreMin: 70,
      formats: ["TV_SHORT"],
      studios: ["Madhouse"],
      genresInclude: ["Horror"],
      genresExclude: ["Comedy"],
      tagsExclude: ["Gore"],
      listAniListIds: [1, 2],
      listSource: { site: "anilist", username: "kai", fetchedAt: "2026-01-01" },
    });
    expect(chips).toEqual([
      { label: "Openings" },
      { label: "2000 to 2015" },
      { label: "Fall" },
      { label: "Score 70 or more" },
      { label: "TV short" },
      { label: "Madhouse" },
      { label: "Horror" },
      { label: "Comedy", exclude: true },
      { label: "Gore", exclude: true },
      { label: "kai's list" },
    ]);
  });

  it("words one-sided and single-value ranges", () => {
    expect(describeFilters({ ...EMPTY_STUDY_FILTERS, yearMax: 1999 })).toEqual([{ label: "Up to 1999" }]);
    expect(describeFilters({ ...EMPTY_STUDY_FILTERS, yearMin: 2009, yearMax: 2009 })).toEqual([{ label: "2009" }]);
    expect(describeFilters({ ...EMPTY_STUDY_FILTERS, scoreMax: 80 })).toEqual([{ label: "Score up to 80" }]);
  });
});

describe("formatClock", () => {
  it("formats seconds as m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(89.9)).toBe("1:29");
    expect(formatClock(null)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});
