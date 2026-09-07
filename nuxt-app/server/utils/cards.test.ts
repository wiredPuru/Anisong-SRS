import { afterEach, describe, expect, it, vi } from "vitest";
import { pickRandomDueOrder } from "./cards.ts";

interface Pooled {
  id: number;
  nextReviewAt: Date;
}

const earlier = new Date("2026-09-01T00:00:00.000Z");
const today = new Date("2026-09-05T00:00:00.000Z");

function tiedPool(): Pooled[] {
  // Sorted ascending by nextReviewAt, as getNextDueCard/getUpcomingDueCards
  // always pass it in - one clearly overdue card from an earlier day, then
  // several cards tied on today's date (e.g. a bulk import).
  return [
    { id: 1, nextReviewAt: earlier },
    { id: 2, nextReviewAt: today },
    { id: 3, nextReviewAt: today },
    { id: 4, nextReviewAt: today },
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pickRandomDueOrder", () => {
  it("returns undefined-safe empty array for an empty pool", () => {
    expect(pickRandomDueOrder([], 1)).toEqual([]);
  });

  it("always picks the earlier-day card first over same-day ties", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const [first] = pickRandomDueOrder(tiedPool(), 1);
    expect(first.id).toBe(1);
  });

  it("shuffles which same-day card comes next as the mocked random value changes", () => {
    const pool = tiedPool();

    vi.spyOn(Math, "random").mockReturnValue(0);
    const pickedFirst = pickRandomDueOrder(pool, 2)[1];

    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const pickedSecond = pickRandomDueOrder(pool, 2)[1];

    expect(pickedFirst.id).not.toBe(pickedSecond.id);
  });

  it("never repeats a card and stops once the pool is exhausted", () => {
    const picks = pickRandomDueOrder(tiedPool(), 10);
    expect(picks).toHaveLength(4);
    expect(new Set(picks.map((c) => c.id)).size).toBe(4);
  });

  it("treats two timestamps just minutes apart but on different calendar days as different buckets", () => {
    const pool: Pooled[] = [
      { id: 1, nextReviewAt: new Date("2026-09-04T23:59:00.000Z") },
      { id: 2, nextReviewAt: new Date("2026-09-05T00:01:00.000Z") },
    ];
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const [first] = pickRandomDueOrder(pool, 1);
    expect(first.id).toBe(1);
  });

  it("treats two timestamps far apart but on the same calendar day as tied", () => {
    const pool: Pooled[] = [
      { id: 1, nextReviewAt: new Date("2026-09-05T00:01:00.000Z") },
      { id: 2, nextReviewAt: new Date("2026-09-05T23:59:00.000Z") },
    ];
    vi.spyOn(Math, "random").mockReturnValue(0);
    const pickedLow = pickRandomDueOrder(pool, 1)[0];
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const pickedHigh = pickRandomDueOrder(pool, 1)[0];
    expect(pickedLow.id).not.toBe(pickedHigh.id);
  });
});
