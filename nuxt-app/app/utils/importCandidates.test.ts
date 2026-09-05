import { describe, expect, it } from "vitest";
import { mergeImportCandidates, type AniListResult } from "./importCandidates.ts";

function candidate(aniListId: number, titleRomaji = `Anime ${aniListId}`): AniListResult {
  return { aniListId, titleRomaji, titleEnglish: null, titleNative: null };
}

describe("mergeImportCandidates", () => {
  it("returns an empty array for no lists", () => {
    expect(mergeImportCandidates([])).toEqual([]);
  });

  it("returns an empty array when every list is empty", () => {
    expect(mergeImportCandidates([[], []])).toEqual([]);
  });

  it("concatenates disjoint lists in order", () => {
    const a = [candidate(1), candidate(2)];
    const b = [candidate(3)];
    expect(mergeImportCandidates([a, b])).toEqual([...a, ...b]);
  });

  it("dedupes a fully overlapping list, keeping the first occurrence", () => {
    const first = candidate(1, "AniList title");
    const second = candidate(1, "MAL title");
    expect(mergeImportCandidates([[first], [second]])).toEqual([first]);
  });

  it("dedupes a partially overlapping list while keeping unique entries from both", () => {
    const a = [candidate(1), candidate(2)];
    const b = [candidate(2, "duplicate"), candidate(3)];
    expect(mergeImportCandidates([a, b])).toEqual([candidate(1), candidate(2), candidate(3)]);
  });
});
