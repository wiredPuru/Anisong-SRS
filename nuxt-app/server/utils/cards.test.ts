import { describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { baseDueCondition, pathsToRemove, pickRandomDueOrder } from "./cards.ts";

const themesOnly = vi.hoisted(() => ({ value: false }));
vi.mock("./mediaLibrary.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./mediaLibrary.ts")>()),
  getThemesOnly: () => themesOnly.value,
  getDailyNewCardLimit: () => null,
}));

describe("baseDueCondition themes-only filter", () => {
  const dueSql = () => db.select().from(card).where(baseDueCondition()).toSQL().sql;

  it("adds no song filter by default", () => {
    themesOnly.value = false;
    expect(dueSql()).not.toContain("animethemes_theme_id");
  });

  it("restricts to songs with an AnimeThemes theme id when on", () => {
    themesOnly.value = true;
    expect(dueSql()).toMatch(/animethemes_theme_id" is not null/i);
  });
});

describe("pathsToRemove", () => {
  it("returns nothing for empty input", () => {
    expect(pathsToRemove([], [])).toEqual([]);
  });

  it("drops nulls and collapses duplicates", () => {
    expect(pathsToRemove(["/a.webm", null, "/a.webm", "/b.mp3"], [])).toEqual(["/a.webm", "/b.mp3"]);
  });

  it("keeps a path a remaining card still references", () => {
    expect(pathsToRemove(["/a.webm", "/b.mp3"], [null, "/b.mp3"])).toEqual(["/a.webm"]);
  });
});

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

// The tie-break is a deterministic hash of (id, calendar day), not
// Math.random() - these seed dates were picked because they're known to
// order the tied ids differently, proving the tie-break isn't secretly just
// insertion order in disguise.
const seedDay = new Date("2026-09-05T12:00:00.000Z");
const nextSeedDay = new Date("2026-09-06T12:00:00.000Z");

describe("pickRandomDueOrder", () => {
  it("returns undefined-safe empty array for an empty pool", () => {
    expect(pickRandomDueOrder([], 1)).toEqual([]);
  });

  it("always picks the earlier-day card first over same-day ties", () => {
    expect(pickRandomDueOrder(tiedPool(), 1, seedDay)[0].id).toBe(1);
    expect(pickRandomDueOrder(tiedPool(), 1, nextSeedDay)[0].id).toBe(1);
  });

  it("gives the same order across repeated calls on the same day", () => {
    const first = pickRandomDueOrder(tiedPool(), 4, seedDay).map((c) => c.id);
    const second = pickRandomDueOrder(tiedPool(), 4, seedDay).map((c) => c.id);
    expect(first).toEqual(second);
  });

  it("changes the same-day tie-break order once the day rolls over", () => {
    const pool: Pooled[] = [
      { id: 2, nextReviewAt: today },
      { id: 3, nextReviewAt: today },
      { id: 4, nextReviewAt: today },
    ];
    const orderToday = pickRandomDueOrder(pool, 1, seedDay)[0].id;
    const orderNextDay = pickRandomDueOrder(pool, 1, nextSeedDay)[0].id;
    expect(orderToday).not.toBe(orderNextDay);
  });

  it("never repeats a card and stops once the pool is exhausted", () => {
    const picks = pickRandomDueOrder(tiedPool(), 10, seedDay);
    expect(picks).toHaveLength(4);
    expect(new Set(picks.map((c) => c.id)).size).toBe(4);
  });

  it("treats two timestamps just minutes apart but on different calendar days as different buckets", () => {
    const pool: Pooled[] = [
      { id: 1, nextReviewAt: new Date("2026-09-04T23:59:00.000Z") },
      { id: 2, nextReviewAt: new Date("2026-09-05T00:01:00.000Z") },
    ];
    const [first] = pickRandomDueOrder(pool, 1, seedDay);
    expect(first.id).toBe(1);
  });

  it("treats two timestamps far apart but on the same calendar day as tied", () => {
    const pool: Pooled[] = [
      { id: 1, nextReviewAt: new Date("2026-09-05T00:01:00.000Z") },
      { id: 2, nextReviewAt: new Date("2026-09-05T23:59:00.000Z") },
    ];
    const pickedOnSeedDay = pickRandomDueOrder(pool, 1, seedDay)[0].id;
    const pickedOnNextSeedDay = pickRandomDueOrder(pool, 1, nextSeedDay)[0].id;
    expect(pickedOnSeedDay).not.toBe(pickedOnNextSeedDay);
  });
});
