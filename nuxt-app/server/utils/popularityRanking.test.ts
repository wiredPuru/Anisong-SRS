import { describe, expect, it } from "vitest";
import { parseRankingPage } from "./popularityRanking.ts";

describe("parseRankingPage", () => {
  it("ranks entries from the page's first slot", () => {
    const data = { Page: { media: [{ id: 16498, idMal: 16498 }, { id: 21, idMal: 21 }] } };
    expect(parseRankingPage(data, 3, 50)).toEqual([
      { aniListId: 16498, malId: 16498, rank: 101 },
      { aniListId: 21, malId: 21, rank: 102 },
    ]);
  });

  it("keeps a show with no MAL id", () => {
    expect(parseRankingPage({ Page: { media: [{ id: 5, idMal: null }] } }, 1)).toEqual([{ aniListId: 5, malId: null, rank: 1 }]);
  });

  it("skips malformed entries without shifting the others' rank", () => {
    const data = { Page: { media: [null, { idMal: 3 }, { id: "x" }, { id: 9, idMal: 9 }] } };
    expect(parseRankingPage(data, 1)).toEqual([{ aniListId: 9, malId: 9, rank: 4 }]);
  });

  it("returns nothing for an empty or missing page", () => {
    expect(parseRankingPage({ Page: { media: [] } }, 1)).toEqual([]);
    expect(parseRankingPage(null, 1)).toEqual([]);
    expect(parseRankingPage({ Page: {} }, 1)).toEqual([]);
  });
});
