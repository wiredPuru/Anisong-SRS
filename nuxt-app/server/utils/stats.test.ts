import { describe, expect, it } from "vitest";
import {
  MATURE_BOX,
  forecastDayKeys,
  heatmapDayKeys,
  shapeCollectionHealth,
  shapeForecast,
  shapeReviewHeatmap,
} from "./stats.ts";
import type { CollectionHealthInput, ReviewForecastInput, ReviewHeatmapInput } from "./stats.ts";

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

describe("heatmapDayKeys", () => {
  it("returns the current week's Sunday through Saturday for a single week", () => {
    // 2026-09-20 is a Sunday.
    expect(heatmapDayKeys(new Date("2026-09-20T12:00:00"), 1)).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
    ]);
  });

  it("aligns a mid-week today back to that week's own Sunday-Saturday span", () => {
    // 2026-09-23 is a Wednesday in the same week as the test above.
    const keys = heatmapDayKeys(new Date("2026-09-23T08:00:00"), 1);
    expect(keys[0]).toBe("2026-09-20");
    expect(keys.at(-1)).toBe("2026-09-26");
  });

  it("walks back full weeks while still ending on today's own Saturday", () => {
    const keys = heatmapDayKeys(new Date("2026-09-20T12:00:00"), 2);
    expect(keys[0]).toBe("2026-09-13");
    expect(keys.at(-1)).toBe("2026-09-26");
  });

  it("always returns a multiple of 7 day keys", () => {
    expect(heatmapDayKeys(new Date("2026-09-23T08:00:00"), 4).length).toBe(28);
    expect(heatmapDayKeys(new Date("2026-01-01T08:00:00"), 53).length).toBe(371);
  });
});

const HEATMAP_DAYS = heatmapDayKeys(new Date("2026-09-20T12:00:00"), 2);

function heatmapInput(overrides: Partial<ReviewHeatmapInput> = {}): ReviewHeatmapInput {
  return { countsByDate: [], dayKeys: HEATMAP_DAYS, todayKey: "2026-09-20", ...overrides };
}

describe("shapeReviewHeatmap", () => {
  it("carries a recorded count through and zero-fills days with none", () => {
    const heatmap = shapeReviewHeatmap(heatmapInput({ countsByDate: [{ date: "2026-09-20", count: 5 }] }));
    const allDays = heatmap.weeks.flatMap((week) => week.days);

    expect(allDays.find((day) => day.date === "2026-09-20")).toEqual({
      date: "2026-09-20",
      count: 5,
      future: false,
    });
    expect(allDays.find((day) => day.date === "2026-09-14")).toEqual({
      date: "2026-09-14",
      count: 0,
      future: false,
    });
  });

  it("blanks days after today in the trailing week", () => {
    const heatmap = shapeReviewHeatmap(heatmapInput());
    const allDays = heatmap.weeks.flatMap((week) => week.days);

    // 2026-09-24 is a Thursday later in the same week as today (a Sunday).
    expect(allDays.find((day) => day.date === "2026-09-24")).toEqual({
      date: "2026-09-24",
      count: 0,
      future: true,
    });
  });

  it("excludes future days from maxCount and totalReviews", () => {
    const heatmap = shapeReviewHeatmap(
      heatmapInput({
        countsByDate: [
          { date: "2026-09-20", count: 3 },
          { date: "2026-09-24", count: 100 },
        ],
      }),
    );

    expect(heatmap.maxCount).toBe(3);
    expect(heatmap.totalReviews).toBe(3);
  });

  it("returns maxCount 0 for an all-zero window without dividing by zero", () => {
    const heatmap = shapeReviewHeatmap(heatmapInput());

    expect(heatmap.maxCount).toBe(0);
    expect(heatmap.totalReviews).toBe(0);
  });

  it("chunks days into 7-day weeks in order", () => {
    const heatmap = shapeReviewHeatmap(heatmapInput());

    expect(heatmap.weeks).toHaveLength(2);
    expect(heatmap.weeks[0]!.days).toHaveLength(7);
    expect(heatmap.weeks[0]!.days[0]!.date).toBe("2026-09-13");
    expect(heatmap.weeks[1]!.days[6]!.date).toBe("2026-09-26");
  });

  it("labels only the week containing a month's 1st", () => {
    const dayKeys = [
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ];
    const heatmap = shapeReviewHeatmap({ countsByDate: [], dayKeys, todayKey: "2026-10-10" });

    expect(heatmap.weeks[0]!.monthLabel).toBe("Oct");
    expect(heatmap.weeks[1]!.monthLabel).toBeNull();
  });
});
