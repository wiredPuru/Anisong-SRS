import { describe, expect, it } from "vitest";
import { catalogDifficultyRange, inBand, pickEndlessBatch, type EndlessCandidate, type PopularityCutoffs } from "./partyEndless.ts";

const CUTOFFS: PopularityCutoffs = { top500: 100, top1000: 50 };

function library(shows: number, songsPerShow: number, popularity: (show: number) => number | null, offset = 0): EndlessCandidate[] {
  const candidates: EndlessCandidate[] = [];
  for (let show = 1; show <= shows; show++) {
    for (let song = 1; song <= songsPerShow; song++) {
      candidates.push({ cardId: offset + show * 100 + song, animeId: offset + show, popularity: popularity(show), downloaded: song === 1 });
    }
  }
  return candidates;
}

const showOf = (cardId: number) => Math.floor(cardId / 100);

describe("inBand", () => {
  it.each([
    ["easy", 150, true],
    ["easy", 100, true],
    ["easy", 99, false],
    ["easy", null, false],
    ["medium", 60, true],
    ["medium", 49, false],
    ["hard", 99, true],
    ["hard", null, true],
    ["hard", 100, false],
    ["random", null, true],
    ["random", 1000, true],
  ] as const)("%s with popularity %s is %s", (difficulty, popularity, expected) => {
    expect(inBand(difficulty, popularity, CUTOFFS)).toBe(expected);
  });
});

describe("pickEndlessBatch", () => {
  const popular = library(60, 1, () => 500);
  const obscure = library(60, 1, () => 10, 10_000);

  function share(difficulty: "easy" | "medium" | "hard" | "random", candidates: EndlessCandidate[], test: (c: EndlessCandidate) => boolean): number {
    const byId = new Map(candidates.map((c) => [c.cardId, c]));
    let hits = 0;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      for (const id of pickEndlessBatch({ candidates, difficulty, queue: [], count: 10, cutoffs: CUTOFFS })) {
        total++;
        if (test(byId.get(id)!)) hits++;
      }
    }
    return hits / total;
  }

  it("easy is mostly popular shows with a little spice", () => {
    const fraction = share("easy", [...popular, ...obscure], (c) => (c.popularity ?? 0) >= 100);
    expect(fraction).toBeGreaterThan(0.85);
    expect(fraction).toBeLessThan(1);
  });

  it("hard leans on shows outside the top 500", () => {
    const fraction = share("hard", [...popular, ...obscure], (c) => (c.popularity ?? 0) < 100);
    expect(fraction).toBeGreaterThan(0.7);
    expect(fraction).toBeLessThan(0.95);
  });

  it("random does not weight by popularity", () => {
    const fraction = share("random", [...popular, ...obscure], (c) => (c.popularity ?? 0) >= 100);
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThan(0.6);
  });

  it("picks one song per show in a batch", () => {
    const picked = pickEndlessBatch({ candidates: library(20, 3, () => 500), difficulty: "easy", queue: [], count: 10, cutoffs: CUTOFFS });
    expect(new Set(picked.map(showOf)).size).toBe(10);
  });

  it("skips songs already queued and shows heard recently", () => {
    const candidates = library(10, 2, () => 500);
    const picked = pickEndlessBatch({ candidates, difficulty: "easy", queue: [101, 201, 301, 401, 501], count: 10, cutoffs: CUTOFFS });
    const shows = new Set(picked.map(showOf));
    for (const heard of [1, 2, 3, 4, 5]) expect(shows.has(heard)).toBe(false);
  });

  it("lets a show return once it has left the recent window", () => {
    const candidates = library(4, 3, () => 500);
    const picked = pickEndlessBatch({ candidates, difficulty: "easy", queue: [101, 201, 301, 401], count: 2, cutoffs: CUTOFFS });
    expect(picked.map(showOf).sort()).toEqual([1, 2]);
    expect(picked).not.toContain(101);
  });

  it("falls back to the whole pool when the difficulty has no songs", () => {
    const picked = pickEndlessBatch({ candidates: library(5, 1, () => 500), difficulty: "hard", queue: [], count: 3, cutoffs: CUTOFFS });
    expect(picked).toHaveLength(3);
  });

  it("includes streamed songs unless downloaded-only is on", () => {
    const candidates = library(6, 3, () => 500);
    const downloaded = new Set(candidates.filter((c) => c.downloaded).map((c) => c.cardId));
    const only = pickEndlessBatch({ candidates, difficulty: "easy", downloadedOnly: true, queue: [], count: 6, cutoffs: CUTOFFS });
    expect(only.every((id) => downloaded.has(id))).toBe(true);
    const all = new Set<number>();
    for (let i = 0; i < 30; i++) pickEndlessBatch({ candidates, difficulty: "easy", queue: [], count: 6, cutoffs: CUTOFFS }).forEach((id) => all.add(id));
    expect([...all].some((id) => !downloaded.has(id))).toBe(true);
  });

  it("returns nothing once every song is queued", () => {
    const candidates = library(3, 1, () => 500);
    expect(pickEndlessBatch({ candidates, difficulty: "easy", queue: candidates.map((c) => c.cardId), count: 5, cutoffs: CUTOFFS })).toEqual([]);
  });
});

describe("catalogDifficultyRange", () => {
  it.each([
    ["easy", { start: 50, end: 100 }],
    ["medium", { start: 30, end: 50 }],
    ["hard", { start: 0, end: 30 }],
    ["random", null],
  ] as const)("%s", (difficulty, range) => {
    expect(catalogDifficultyRange(difficulty)).toEqual(range);
  });
});
