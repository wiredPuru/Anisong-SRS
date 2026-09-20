import { describe, expect, it } from "vitest";
import { MATURE_BOX, forecastDayKeys, shapeCollectionHealth, shapeForecast } from "./stats.ts";
import type { CollectionHealthInput, ReviewForecastInput } from "./stats.ts";

function input(overrides: Partial<CollectionHealthInput> = {}): CollectionHealthInput {
  return {
    boxCounts: [],
    boxOneStreakCounts: [],
    neverReviewed: 0,
    boxOneStreakRequired: 3,
    ...overrides,
  };
}

describe("shapeCollectionHealth", () => {
  it("reports an empty library without dividing by zero", () => {
    const health = shapeCollectionHealth(input());

    expect(health.totalCards).toBe(0);
    expect(health.matureCards).toBe(0);
    expect(health.maturePercent).toBeNull();
    expect(health.boxes).toEqual([
      { box: 1, count: 0 },
      { box: 2, count: 0 },
      { box: 3, count: 0 },
      { box: 4, count: 0 },
      { box: 5, count: 0 },
    ]);
  });

  it("fills in boxes no card occupies", () => {
    const health = shapeCollectionHealth(input({ boxCounts: [{ box: 3, count: 4 }] }));

    expect(health.boxes).toEqual([
      { box: 1, count: 0 },
      { box: 2, count: 0 },
      { box: 3, count: 4 },
      { box: 4, count: 0 },
      { box: 5, count: 0 },
    ]);
    expect(health.totalCards).toBe(4);
  });

  it("counts a wholly unreviewed library as box 1 and nothing mature", () => {
    const health = shapeCollectionHealth(
      input({
        boxCounts: [{ box: 1, count: 12 }],
        boxOneStreakCounts: [{ streak: 0, count: 12 }],
        neverReviewed: 12,
      }),
    );

    expect(health.totalCards).toBe(12);
    expect(health.neverReviewed).toBe(12);
    expect(health.matureCards).toBe(0);
    expect(health.maturePercent).toBe(0);
  });

  it("treats box 4 and up as mature", () => {
    const health = shapeCollectionHealth(
      input({
        boxCounts: [
          { box: 1, count: 2 },
          { box: 2, count: 2 },
          { box: 3, count: 2 },
          { box: 4, count: 3 },
          { box: 5, count: 1 },
        ],
      }),
    );

    expect(MATURE_BOX).toBe(4);
    expect(health.matureBox).toBe(MATURE_BOX);
    expect(health.totalCards).toBe(10);
    expect(health.matureCards).toBe(4);
    expect(health.maturePercent).toBe(0.4);
  });

  it("buckets box 1 by streak up to the graduation requirement", () => {
    const health = shapeCollectionHealth(
      input({
        boxCounts: [{ box: 1, count: 9 }],
        boxOneStreakCounts: [
          { streak: 0, count: 5 },
          { streak: 2, count: 4 },
        ],
        boxOneStreakRequired: 3,
      }),
    );

    expect(health.boxOneByStreak).toEqual([
      { streak: 0, count: 5 },
      { streak: 1, count: 0 },
      { streak: 2, count: 4 },
    ]);
  });

  it("collapses streaks past the requirement into the last bucket", () => {
    // Only reachable by lowering boxOneStreakRequired after cards have already
    // built up a longer streak.
    const health = shapeCollectionHealth(
      input({
        boxCounts: [{ box: 1, count: 6 }],
        boxOneStreakCounts: [
          { streak: 1, count: 2 },
          { streak: 4, count: 4 },
        ],
        boxOneStreakRequired: 2,
      }),
    );

    expect(health.boxOneByStreak).toEqual([
      { streak: 0, count: 0 },
      { streak: 1, count: 6 },
    ]);
  });

  it("still yields one bucket when a single pass graduates a card", () => {
    const health = shapeCollectionHealth(
      input({
        boxCounts: [{ box: 1, count: 3 }],
        boxOneStreakCounts: [{ streak: 0, count: 3 }],
        boxOneStreakRequired: 1,
      }),
    );

    expect(health.boxOneByStreak).toEqual([{ streak: 0, count: 3 }]);
  });
});

const DAYS = forecastDayKeys(new Date("2026-09-20T12:00:00"), 30);

function forecastInput(overrides: Partial<ReviewForecastInput> = {}): ReviewForecastInput {
  return {
    dueByDate: [],
    dayKeys: DAYS,
    dueNow: 0,
    backlog: 0,
    ...overrides,
  };
}

describe("forecastDayKeys", () => {
  it("starts at the given day and runs forward", () => {
    expect(forecastDayKeys(new Date("2026-09-20T23:30:00"), 3)).toEqual(["2026-09-20", "2026-09-21", "2026-09-22"]);
  });

  it("crosses a month boundary", () => {
    expect(forecastDayKeys(new Date("2026-09-29T08:00:00"), 4)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("crosses a leap day", () => {
    expect(forecastDayKeys(new Date("2028-02-28T08:00:00"), 3)).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });
});

describe("shapeForecast", () => {
  it("returns seven empty days when nothing is scheduled", () => {
    const forecast = shapeForecast(forecastInput());

    expect(forecast.days).toHaveLength(7);
    expect(forecast.days.every((day) => day.count === 0)).toBe(true);
    expect(forecast.next7).toBe(0);
    expect(forecast.next30).toBe(0);
  });

  it("puts today first and keeps the days in order", () => {
    const forecast = shapeForecast(
      forecastInput({ dueByDate: [{ date: "2026-09-22", count: 3 }] }),
    );

    expect(forecast.days[0]).toEqual({ date: "2026-09-20", count: 0 });
    expect(forecast.days[2]).toEqual({ date: "2026-09-22", count: 3 });
  });

  it("sums cards landing on the same day", () => {
    const forecast = shapeForecast(
      forecastInput({
        dueByDate: [
          { date: "2026-09-21", count: 2 },
          { date: "2026-09-21", count: 5 },
        ],
      }),
    );

    expect(forecast.days[1]).toEqual({ date: "2026-09-21", count: 7 });
    expect(forecast.next7).toBe(7);
  });

  it("folds overdue cards into today rather than dropping them", () => {
    const forecast = shapeForecast(
      forecastInput({
        dueByDate: [
          { date: "2026-09-13", count: 4 },
          { date: "2026-09-20", count: 1 },
        ],
      }),
    );

    expect(forecast.days[0]).toEqual({ date: "2026-09-20", count: 5 });
    expect(forecast.next7).toBe(5);
  });

  it("counts the seventh day inside next7 and the thirtieth inside next30", () => {
    const forecast = shapeForecast(
      forecastInput({
        dueByDate: [
          { date: DAYS[6]!, count: 2 },
          { date: DAYS[7]!, count: 4 },
          { date: DAYS[29]!, count: 8 },
        ],
      }),
    );

    expect(forecast.next7).toBe(2);
    expect(forecast.next30).toBe(14);
  });

  it("ignores cards scheduled past the horizon", () => {
    const forecast = shapeForecast(forecastInput({ dueByDate: [{ date: "2027-01-01", count: 9 }] }));

    expect(forecast.next30).toBe(0);
  });

  it("passes dueNow and backlog through untouched", () => {
    const forecast = shapeForecast(forecastInput({ dueNow: 12, backlog: 30 }));

    expect(forecast.dueNow).toBe(12);
    expect(forecast.backlog).toBe(30);
  });
});
