import { describe, expect, it } from "vitest";
import { chunkIds, rangeIds, selectionState } from "./cardSelection";

describe("selectionState", () => {
  it("is none for an empty list or no overlap", () => {
    expect(selectionState(new Set(), [])).toBe("none");
    expect(selectionState(new Set([9]), [1, 2])).toBe("none");
  });

  it("is some when only part of the loaded rows are selected", () => {
    expect(selectionState(new Set([1]), [1, 2])).toBe("some");
  });

  it("is all when every loaded row is selected, ignoring ids no longer loaded", () => {
    expect(selectionState(new Set([1, 2, 99]), [1, 2])).toBe("all");
  });
});

describe("rangeIds", () => {
  const ids = [10, 20, 30, 40, 50];

  it("selects inclusively downward", () => {
    expect(rangeIds(ids, 20, 40)).toEqual([20, 30, 40]);
  });

  it("selects inclusively upward", () => {
    expect(rangeIds(ids, 40, 20)).toEqual([20, 30, 40]);
  });

  it("falls back to the target when the anchor is missing or unset", () => {
    expect(rangeIds(ids, 999, 30)).toEqual([30]);
    expect(rangeIds(ids, null, 30)).toEqual([30]);
  });

  it("returns nothing when the target is not loaded", () => {
    expect(rangeIds(ids, 20, 999)).toEqual([]);
  });
});

describe("chunkIds", () => {
  it("returns no chunks for no ids", () => {
    expect(chunkIds([], 500)).toEqual([]);
  });

  it("splits evenly", () => {
    expect(chunkIds([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("keeps a short final chunk", () => {
    expect(chunkIds([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
