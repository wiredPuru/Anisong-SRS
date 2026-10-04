import { describe, expect, it } from "vitest";
import { type BrowseAnime, mergePage, selectableIds, selectedForRun } from "./browseSelection";

const show = (aniListId: number, inLibrary = false): BrowseAnime => ({
  aniListId, titleRomaji: `Show ${aniListId}`, titleEnglish: null, titleNative: null, coverImageUrl: null,
  year: 2012, season: null, format: "TV", averageScore: 70, inLibrary, cardCount: inLibrary ? 2 : 0,
});

describe("selectableIds", () => {
  it("never offers a show already in the library", () => {
    expect(selectableIds([show(1), show(2, true), show(3)])).toEqual([1, 3]);
  });
});

describe("selectedForRun", () => {
  it("ticks every selectable show by default, in list order", () => {
    expect(selectedForRun([show(3), show(1, true), show(2)], new Set())).toEqual({ ids: [3, 2], truncated: false });
  });

  it("honours unticks, including for a show that is not selectable anyway", () => {
    expect(selectedForRun([show(1), show(2), show(3)], new Set([2, 99])).ids).toEqual([1, 3]);
  });

  it("caps a run and reports that ticked shows were left out", () => {
    const many = Array.from({ length: 5 }, (_, i) => show(i + 1));
    expect(selectedForRun(many, new Set(), 3)).toEqual({ ids: [1, 2, 3], truncated: true });
    expect(selectedForRun(many, new Set(), 5).truncated).toBe(false);
  });

  it("returns nothing for an empty list", () => {
    expect(selectedForRun([], new Set())).toEqual({ ids: [], truncated: false });
  });
});

describe("mergePage", () => {
  it("appends a page and drops an id an earlier page already had", () => {
    expect(mergePage([show(1), show(2)], [show(2), show(3)]).map((a) => a.aniListId)).toEqual([1, 2, 3]);
  });
});
