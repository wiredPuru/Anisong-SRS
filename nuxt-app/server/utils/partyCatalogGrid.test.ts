import { describe, expect, it } from "vitest";
import { bandMalIds, columnRange, drawFromPool, rankBand, rankIndex, TIER_CELLS, type RankedAnime } from "./partyCatalogGrid.ts";

const cells = (tier: keyof typeof TIER_CELLS) => TIER_CELLS[tier].map((cell) => `${cell.band}/${cell.column}`).sort();

describe("TIER_CELLS", () => {
  it("matches the popularity x guess-rate table", () => {
    expect(cells("veryEasy")).toEqual(["top500/high"]);
    expect(cells("easy")).toEqual(["top1000/high", "top500/mid"]);
    expect(cells("medium")).toEqual(["rest/high", "top1000/mid", "top500/low"]);
    expect(cells("hard")).toEqual(["rest/low", "rest/mid", "top1000/low"]);
  });

  it("uses every cell exactly once", () => {
    const all = Object.values(TIER_CELLS).flat().map((cell) => `${cell.band}/${cell.column}`);
    expect(new Set(all).size).toBe(9);
    expect(all).toHaveLength(9);
  });
});

describe("columnRange", () => {
  it("gives non-overlapping ranges, with unrated songs only in the middle", () => {
    expect(columnRange("high")).toEqual({ start: 50, end: 100, includeUnrated: false });
    expect(columnRange("mid")).toEqual({ start: 30, end: 49.9, includeUnrated: true });
    expect(columnRange("low")).toEqual({ start: 0, end: 29.9, includeUnrated: false });
  });
});

const ranking: RankedAnime[] = Array.from({ length: 1001 }, (_, i) => ({
  aniListId: 10_000 + i + 1,
  malId: i === 2 || i === 600 ? null : 20_000 + i + 1,
  rank: i + 1,
}));

describe("rankBand", () => {
  const ranks = rankIndex(ranking);
  it("splits at 500 and 1000", () => {
    expect(rankBand(10_001, ranks)).toBe("top500");
    expect(rankBand(10_500, ranks)).toBe("top500");
    expect(rankBand(10_501, ranks)).toBe("top1000");
    expect(rankBand(11_000, ranks)).toBe("top1000");
    expect(rankBand(11_001, ranks)).toBe("rest");
  });

  it("puts unranked and unknown shows in the rest", () => {
    expect(rankBand(5, ranks)).toBe("rest");
    expect(rankBand(null, ranks)).toBe("rest");
  });
});

describe("bandMalIds", () => {
  it("lists a band's MAL ids, skipping shows with none", () => {
    const top = bandMalIds(ranking, "top500");
    expect(top).toHaveLength(499);
    expect(top[0]).toBe(20_001);
    expect(top).not.toContain(20_003);
    const next = bandMalIds(ranking, "top1000");
    expect(next).toHaveLength(499);
    expect(next[0]).toBe(20_501);
    expect(next.at(-1)).toBe(21_000);
  });
});

describe("drawFromPool", () => {
  const song = (annSongId: number, aniListId: number | null) => ({ annSongId, aniListId });
  const noShuffle = () => 0.999;

  it("takes one song per show and skips queued songs", () => {
    const pool = [song(1, 100), song(2, 100), song(3, 200), song(4, 300)];
    const picked = drawFromPool(pool, { queued: new Set([3]), recentShows: [], count: 5, random: noShuffle });
    expect(picked.map((s) => s.annSongId).sort()).toEqual([1, 4]);
  });

  it("treats songs with no AniList id as their own shows", () => {
    const picked = drawFromPool([song(1, null), song(2, null)], { queued: new Set(), recentShows: [], count: 5 });
    expect(picked).toHaveLength(2);
  });

  it("skips recent shows, then lets them back oldest first", () => {
    const pool = [song(1, 100), song(2, 200), song(3, 300), song(4, 400)];
    const fresh = drawFromPool(pool, { queued: new Set(), recentShows: [300, 100], count: 2, random: noShuffle });
    expect(fresh.map((s) => s.aniListId).sort()).toEqual([200, 400]);
    const more = drawFromPool(pool, { queued: new Set(), recentShows: [300, 100], count: 3, random: noShuffle });
    expect(more.map((s) => s.aniListId)).toContain(300);
    expect(more.map((s) => s.aniListId)).not.toContain(100);
  });

  it("returns what it can from a small pool", () => {
    expect(drawFromPool([song(1, 100)], { queued: new Set(), recentShows: [], count: 5 })).toHaveLength(1);
    expect(drawFromPool([], { queued: new Set(), recentShows: [], count: 5 })).toEqual([]);
  });
});
