import { describe, expect, it } from "vitest";
import { difficultyOf, pickEndlessBatch, type EndlessCandidate } from "./partyEndless.ts";

function library(shows: number, songsPerShow: number, score: (show: number) => number | null): EndlessCandidate[] {
  const candidates: EndlessCandidate[] = [];
  for (let show = 1; show <= shows; show++) {
    for (let song = 1; song <= songsPerShow; song++) {
      candidates.push({ cardId: show * 100 + song, animeId: show, score: score(show), downloaded: song === 1 });
    }
  }
  return candidates;
}

describe("difficultyOf", () => {
  it.each([
    [90, "easy"],
    [75, "easy"],
    [74, "medium"],
    [60, "medium"],
    [59, "hard"],
    [0, "hard"],
    [null, "hard"],
  ] as const)("score %s is %s", (score, expected) => {
    expect(difficultyOf(score)).toBe(expected);
  });
});

describe("pickEndlessBatch", () => {
  it("stays within the chosen difficulty", () => {
    const candidates = [...library(10, 2, () => 80), ...library(10, 2, () => 40).map((c) => ({ ...c, cardId: c.cardId + 5000, animeId: c.animeId + 50 }))];
    const picked = pickEndlessBatch({ candidates, difficulty: "easy", queue: [], count: 8 });
    const byId = new Map(candidates.map((c) => [c.cardId, c]));
    expect(picked).toHaveLength(8);
    expect(picked.every((id) => byId.get(id)!.score === 80)).toBe(true);
  });

  it("picks one song per show in a batch", () => {
    const picked = pickEndlessBatch({ candidates: library(20, 3, () => 80), difficulty: "easy", queue: [], count: 10 });
    const shows = picked.map((id) => Math.floor(id / 100));
    expect(new Set(shows).size).toBe(10);
  });

  it("skips songs already queued and shows heard recently", () => {
    const candidates = library(10, 2, () => 80);
    const queue = [101, 201, 301, 401, 501];
    const picked = pickEndlessBatch({ candidates, difficulty: "easy", queue, count: 10 });
    const shows = new Set(picked.map((id) => Math.floor(id / 100)));
    for (const heard of [1, 2, 3, 4, 5]) expect(shows.has(heard)).toBe(false);
  });

  it("lets a show return once it has left the recent window", () => {
    const candidates = library(4, 3, () => 80);
    // 4 shows gives a window of 2: shows 3 and 4 are recent, 1 and 2 are due again.
    const picked = pickEndlessBatch({ candidates, difficulty: "easy", queue: [101, 201, 301, 401], count: 2 });
    expect(picked.map((id) => Math.floor(id / 100)).sort()).toEqual([1, 2]);
    expect(picked).not.toContain(101);
  });

  it("falls back to the whole library when the difficulty has no songs", () => {
    const picked = pickEndlessBatch({ candidates: library(5, 1, () => 90), difficulty: "hard", queue: [], count: 3 });
    expect(picked).toHaveLength(3);
  });

  it("takes any difficulty for random", () => {
    const candidates = [...library(5, 1, () => 90), ...library(5, 1, () => 30).map((c) => ({ ...c, cardId: c.cardId + 5000, animeId: c.animeId + 50 }))];
    const picked = pickEndlessBatch({ candidates, difficulty: "random", queue: [], count: 10 });
    expect(new Set(picked.map((id) => (id > 5000 ? "low" : "high")))).toEqual(new Set(["low", "high"]));
  });

  it("includes streamed songs unless downloaded-only is on", () => {
    const candidates = library(6, 3, () => 80);
    const downloaded = new Set(candidates.filter((c) => c.downloaded).map((c) => c.cardId));
    const only = pickEndlessBatch({ candidates, difficulty: "easy", downloadedOnly: true, queue: [], count: 6 });
    expect(only.every((id) => downloaded.has(id))).toBe(true);
    const all = new Set<number>();
    for (let i = 0; i < 30; i++) pickEndlessBatch({ candidates, difficulty: "easy", queue: [], count: 6 }).forEach((id) => all.add(id));
    expect([...all].some((id) => !downloaded.has(id))).toBe(true);
  });

  it("returns nothing once every song is queued", () => {
    const candidates = library(3, 1, () => 80);
    expect(pickEndlessBatch({ candidates, difficulty: "easy", queue: candidates.map((c) => c.cardId), count: 5 })).toEqual([]);
  });
});
