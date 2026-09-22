import { describe, expect, it } from "vitest";
import {
  MATURE_BOX,
  RHYTHM_MIN_REVIEWS,
  TREND_LIMIT,
  TREND_MIN_REVIEWS,
  TROUBLE_LIMIT,
  classifyThemeSlot,
  currentStreakFromDates,
  dateKeyToDayNumber,
  failStreakFromResults,
  forecastDayKeys,
  heatmapDayKeys,
  listAvailableTracks,
  longestStreakFromDates,
  rollingPassRates,
  shapeCollectionHealth,
  shapeDeckTrends,
  shapeForecast,
  shapeRetention,
  shapeReviewHeatmap,
  shapeStudyRecords,
  shapeStudyRhythm,
  shapeTroubleCards,
  shapeWeekOverWeek,
} from "./stats.ts";
import type { CardWithDetails } from "./cards.ts";
import type {
  CollectionHealthInput,
  DeckTrendInput,
  ReviewForecastInput,
  ReviewHeatmapInput,
  TroubleReviewRow,
} from "./stats.ts";

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

describe("classifyThemeSlot", () => {
  it("reads opening and ending slots with and without a number", () => {
    expect(classifyThemeSlot("OP1")).toBe("OP");
    expect(classifyThemeSlot("OP")).toBe("OP");
    expect(classifyThemeSlot("ED2")).toBe("ED");
  });

  it("tolerates casing and stray whitespace", () => {
    expect(classifyThemeSlot(" op3 ")).toBe("OP");
    expect(classifyThemeSlot("ed")).toBe("ED");
  });

  it("keeps an unrecognised slot in its own bucket", () => {
    expect(classifyThemeSlot("IN1")).toBe("other");
    expect(classifyThemeSlot("")).toBe("other");
  });
});

describe("shapeRetention", () => {
  it("returns a full ladder with no rates when nothing has been reviewed", () => {
    const retention = shapeRetention({ byBox: [], byThemeSlot: [] });

    expect(retention.byBox).toHaveLength(5);
    expect(retention.byBox.every((entry) => entry.passRate === null)).toBe(true);
    expect(retention.byThemeKind.map((entry) => entry.kind)).toEqual(["OP", "ED", "other"]);
    expect(retention.byThemeKind.every((entry) => entry.totalReviews === 0)).toBe(true);
  });

  it("keeps a box with no reviews as a row rather than omitting it", () => {
    const retention = shapeRetention({
      byBox: [
        { box: 1, totalReviews: 10, passCount: 6 },
        { box: 5, totalReviews: 4, passCount: 3 },
      ],
      byThemeSlot: [],
    });

    expect(retention.byBox.map((entry) => entry.box)).toEqual([1, 2, 3, 4, 5]);
    expect(retention.byBox[0]).toEqual({ box: 1, totalReviews: 10, passCount: 6, failCount: 4, passRate: 0.6 });
    expect(retention.byBox[1]).toEqual({ box: 2, totalReviews: 0, passCount: 0, failCount: 0, passRate: null });
    expect(retention.byBox[4]!.passRate).toBe(0.75);
  });

  it("pools every slot of one kind into a single volume-weighted rate", () => {
    const retention = shapeRetention({
      byBox: [],
      byThemeSlot: [
        { themeSlot: "OP1", totalReviews: 10, passCount: 9 },
        { themeSlot: "OP2", totalReviews: 90, passCount: 45 },
        { themeSlot: "ED1", totalReviews: 4, passCount: 1 },
      ],
    });

    const [op, ed] = retention.byThemeKind;
    // Weighted by volume, not the mean of 90% and 50%.
    expect(op).toEqual({ kind: "OP", totalReviews: 100, passCount: 54, failCount: 46, passRate: 0.54 });
    expect(ed!.passRate).toBe(0.25);
  });

  it("counts an unrecognised slot without letting it disappear", () => {
    const retention = shapeRetention({
      byBox: [],
      byThemeSlot: [{ themeSlot: "IN1", totalReviews: 3, passCount: 2 }],
    });

    const other = retention.byThemeKind.find((entry) => entry.kind === "other")!;
    expect(other.totalReviews).toBe(3);
    expect(other.passRate).toBeCloseTo(2 / 3);
  });
});

function day(date: string, totalReviews: number, passCount: number) {
  return { date, totalReviews, passCount, passRate: totalReviews > 0 ? passCount / totalReviews : null };
}

describe("rollingPassRates", () => {
  it("returns nothing for an empty timeline", () => {
    expect(rollingPassRates([], 7)).toEqual([]);
  });

  it("returns the day's own rate when it is the only one", () => {
    expect(rollingPassRates([day("2026-09-20", 4, 3)], 7)).toEqual([{ date: "2026-09-20", passRate: 0.75 }]);
  });

  it("accumulates across consecutive days", () => {
    const rolling = rollingPassRates([day("2026-09-18", 10, 5), day("2026-09-19", 10, 9)], 7);

    expect(rolling[0]!.passRate).toBe(0.5);
    expect(rolling[1]!.passRate).toBe(0.7);
  });

  it("weights by review volume rather than averaging the two days' rates", () => {
    // The mean of 100% and 50% would be 75%; the heavy day has to dominate.
    const rolling = rollingPassRates([day("2026-09-18", 2, 2), day("2026-09-19", 98, 49)], 7);

    expect(rolling[1]!.passRate).toBeCloseTo(51 / 100);
  });

  it("drops a day that falls out of the calendar window", () => {
    const rolling = rollingPassRates([day("2026-09-10", 10, 10), day("2026-09-17", 10, 0)], 7);

    // Sep 10 is 7 days before Sep 17, so it is outside a 7-day trailing window
    // that starts on Sep 11.
    expect(rolling[1]!.passRate).toBe(0);
  });

  it("keeps the boundary day inside the window", () => {
    const rolling = rollingPassRates([day("2026-09-11", 10, 10), day("2026-09-17", 10, 0)], 7);

    expect(rolling[1]!.passRate).toBe(0.5);
  });

  it("counts calendar days, not entries, across a gap in studying", () => {
    // Eight entries that a 7-entry window would pool together, but they span
    // months, so each day only ever sees itself.
    const entries = [
      day("2026-01-01", 10, 10),
      day("2026-02-01", 10, 10),
      day("2026-03-01", 10, 10),
      day("2026-04-01", 10, 10),
      day("2026-05-01", 10, 10),
      day("2026-06-01", 10, 10),
      day("2026-07-01", 10, 10),
      day("2026-08-01", 10, 0),
    ];

    expect(rollingPassRates(entries, 7).at(-1)!.passRate).toBe(0);
  });

  it("crosses a month boundary when the window spans one", () => {
    const rolling = rollingPassRates([day("2026-09-29", 10, 10), day("2026-10-02", 10, 0)], 7);

    expect(rolling[1]!.passRate).toBe(0.5);
  });
});

function week(totalReviews: number, passCount: number) {
  return { totalReviews, passCount };
}

describe("shapeWeekOverWeek", () => {
  it("has no rates and no delta before anything is reviewed", () => {
    const wow = shapeWeekOverWeek({ current: week(0, 0), previous: week(0, 0) });

    expect(wow.current.passRate).toBeNull();
    expect(wow.previous.passRate).toBeNull();
    expect(wow.delta).toBeNull();
  });

  it("withholds the delta when the previous week has no reviews", () => {
    // A first week of study is not a jump up from zero, it is an unknown.
    const wow = shapeWeekOverWeek({ current: week(20, 15), previous: week(0, 0) });

    expect(wow.current.passRate).toBe(0.75);
    expect(wow.delta).toBeNull();
  });

  it("withholds the delta when the current week has no reviews", () => {
    const wow = shapeWeekOverWeek({ current: week(0, 0), previous: week(20, 15) });

    expect(wow.delta).toBeNull();
  });

  it("reports an improvement as a positive delta", () => {
    const wow = shapeWeekOverWeek({ current: week(10, 8), previous: week(10, 5) });

    expect(wow.delta).toBeCloseTo(0.3);
  });

  it("reports a decline as a negative delta", () => {
    const wow = shapeWeekOverWeek({ current: week(10, 4), previous: week(20, 18) });

    expect(wow.delta).toBeCloseTo(-0.5);
  });

  it("keeps both sample sizes so an unequal comparison stays visible", () => {
    const wow = shapeWeekOverWeek({ current: week(3, 3), previous: week(120, 60) });

    expect(wow.current.totalReviews).toBe(3);
    expect(wow.previous.totalReviews).toBe(120);
    expect(wow.delta).toBeCloseTo(0.5);
  });
});

function deck(id: number, overrides: Partial<DeckTrendInput> = {}): DeckTrendInput {
  return {
    type: "artist",
    id,
    label: `Deck ${id}`,
    coverImageUrl: null,
    recentReviews: 10,
    recentPasses: 5,
    olderReviews: 10,
    olderPasses: 5,
    ...overrides,
  };
}

const RANK = { minReviews: TREND_MIN_REVIEWS, limit: TREND_LIMIT };

describe("shapeDeckTrends", () => {
  it("returns empty lists for no decks", () => {
    expect(shapeDeckTrends([], RANK)).toEqual({ improved: [], declined: [] });
  });

  it("excludes a deck with no older baseline rather than ranking it as improved", () => {
    const trends = shapeDeckTrends([deck(1, { olderReviews: 0, olderPasses: 0, recentPasses: 10 })], RANK);

    expect(trends.improved).toEqual([]);
    expect(trends.declined).toEqual([]);
  });

  it("excludes a deck under the threshold in either window alone", () => {
    const thin = deck(1, { recentReviews: 2, recentPasses: 2 });
    const thinOlder = deck(2, { olderReviews: 2, olderPasses: 0, recentPasses: 10 });

    expect(shapeDeckTrends([thin, thinOlder], RANK).improved).toEqual([]);
  });

  it("admits a deck sitting exactly on the threshold", () => {
    const trends = shapeDeckTrends(
      [deck(1, { recentReviews: 3, recentPasses: 3, olderReviews: 3, olderPasses: 0 })],
      RANK,
    );

    expect(trends.improved).toHaveLength(1);
    expect(trends.improved[0]!.delta).toBe(1);
  });

  it("drops an exact tie from both lists", () => {
    const trends = shapeDeckTrends([deck(1, { recentPasses: 5, olderPasses: 5 })], RANK);

    expect(trends.improved).toEqual([]);
    expect(trends.declined).toEqual([]);
  });

  it("never puts the same deck in both lists", () => {
    const trends = shapeDeckTrends(
      [deck(1, { recentPasses: 9 }), deck(2, { recentPasses: 1 })],
      RANK,
    );

    const improvedIds = trends.improved.map((entry) => entry.id);
    const declinedIds = trends.declined.map((entry) => entry.id);
    expect(improvedIds).toEqual([1]);
    expect(declinedIds).toEqual([2]);
    expect(improvedIds.filter((id) => declinedIds.includes(id))).toEqual([]);
  });

  it("ranks the biggest movers first and truncates at the limit", () => {
    const rows = [
      deck(1, { recentPasses: 6 }),
      deck(2, { recentPasses: 10 }),
      deck(3, { recentPasses: 8 }),
      deck(4, { recentPasses: 7 }),
      deck(5, { recentPasses: 0 }),
      deck(6, { recentPasses: 2 }),
      deck(7, { recentPasses: 1 }),
      deck(8, { recentPasses: 3 }),
    ];

    const trends = shapeDeckTrends(rows, RANK);

    expect(trends.improved.map((entry) => entry.id)).toEqual([2, 3, 4]);
    expect(trends.declined.map((entry) => entry.id)).toEqual([5, 7, 6]);
  });

  it("carries the deck's identity and both windows' rates through", () => {
    const trends = shapeDeckTrends(
      [
        deck(9, {
          type: "anime",
          label: "Bocchi the Rock!",
          coverImageUrl: "https://example.test/cover.jpg",
          recentReviews: 8,
          recentPasses: 6,
          olderReviews: 4,
          olderPasses: 1,
        }),
      ],
      RANK,
    );

    expect(trends.improved[0]).toEqual({
      type: "anime",
      id: 9,
      label: "Bocchi the Rock!",
      coverImageUrl: "https://example.test/cover.jpg",
      recentRate: 0.75,
      recentReviews: 8,
      olderRate: 0.25,
      olderReviews: 4,
      delta: 0.5,
    });
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

describe("dateKeyToDayNumber", () => {
  it("makes consecutive dates exactly one apart across daylight-saving changes", () => {
    expect(dateKeyToDayNumber("2026-03-09") - dateKeyToDayNumber("2026-03-08")).toBe(1);
    expect(dateKeyToDayNumber("2026-11-02") - dateKeyToDayNumber("2026-11-01")).toBe(1);
  });

  it("crosses a month end and a leap day", () => {
    expect(dateKeyToDayNumber("2026-10-01") - dateKeyToDayNumber("2026-09-30")).toBe(1);
    expect(dateKeyToDayNumber("2028-02-29") - dateKeyToDayNumber("2028-02-28")).toBe(1);
    expect(dateKeyToDayNumber("2028-03-01") - dateKeyToDayNumber("2028-02-29")).toBe(1);
  });
});

describe("currentStreakFromDates", () => {
  it("is zero with no reviews", () => {
    expect(currentStreakFromDates([], "2026-09-20")).toBe(0);
  });

  it("counts back from today when today has a review", () => {
    expect(currentStreakFromDates(["2026-09-18", "2026-09-19", "2026-09-20"], "2026-09-20")).toBe(3);
  });

  it("stays alive when the last review was yesterday", () => {
    expect(currentStreakFromDates(["2026-09-18", "2026-09-19"], "2026-09-20")).toBe(2);
  });

  it("is dead after a two-day gap", () => {
    expect(currentStreakFromDates(["2026-09-17", "2026-09-18"], "2026-09-20")).toBe(0);
  });

  it("stops at the first missing day", () => {
    expect(currentStreakFromDates(["2026-09-15", "2026-09-19", "2026-09-20"], "2026-09-20")).toBe(2);
  });

  it("ignores order and duplicates", () => {
    expect(currentStreakFromDates(["2026-09-20", "2026-09-19", "2026-09-20"], "2026-09-20")).toBe(2);
  });
});

describe("longestStreakFromDates", () => {
  it("is null with no reviews", () => {
    expect(longestStreakFromDates([])).toBeNull();
  });

  it("reports a single day as a run of one", () => {
    expect(longestStreakFromDates(["2026-09-10"])).toEqual({ days: 1, start: "2026-09-10", end: "2026-09-10" });
  });

  it("picks the longer of two runs", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-10", "2026-09-11", "2026-09-12"];
    expect(longestStreakFromDates(dates)).toEqual({ days: 3, start: "2026-09-10", end: "2026-09-12" });
  });

  it("prefers the most recent run on a tie", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-10", "2026-09-11"];
    expect(longestStreakFromDates(dates)).toEqual({ days: 2, start: "2026-09-10", end: "2026-09-11" });
  });

  it("runs across a month end and a leap day", () => {
    expect(longestStreakFromDates(["2028-02-28", "2028-02-29", "2028-03-01"])).toEqual({
      days: 3,
      start: "2028-02-28",
      end: "2028-03-01",
    });
  });

  it("breaks a run on exactly one missing day", () => {
    expect(longestStreakFromDates(["2026-09-01", "2026-09-02", "2026-09-04", "2026-09-05"])?.days).toBe(2);
  });

  it("ignores order and duplicates", () => {
    expect(longestStreakFromDates(["2026-09-03", "2026-09-01", "2026-09-02", "2026-09-02"])).toEqual({
      days: 3,
      start: "2026-09-01",
      end: "2026-09-03",
    });
  });
});

describe("shapeStudyRecords", () => {
  it("reports an empty log as nulls and zeros", () => {
    expect(shapeStudyRecords({ dayCounts: [], todayKey: "2026-09-20" })).toEqual({
      totalDaysStudied: 0,
      currentStreak: 0,
      longestStreak: null,
      bestDay: null,
    });
  });

  it("finds the busiest day and counts distinct days", () => {
    const records = shapeStudyRecords({
      dayCounts: [
        { date: "2026-09-18", count: 12 },
        { date: "2026-09-19", count: 40 },
        { date: "2026-09-20", count: 7 },
      ],
      todayKey: "2026-09-20",
    });

    expect(records.bestDay).toEqual({ date: "2026-09-19", count: 40 });
    expect(records.totalDaysStudied).toBe(3);
    expect(records.currentStreak).toBe(3);
    expect(records.longestStreak).toEqual({ days: 3, start: "2026-09-18", end: "2026-09-20" });
  });

  it("gives the best day to the most recent one on a tie", () => {
    const records = shapeStudyRecords({
      dayCounts: [
        { date: "2026-09-10", count: 30 },
        { date: "2026-09-15", count: 30 },
        { date: "2026-09-12", count: 5 },
      ],
      todayKey: "2026-09-20",
    });

    expect(records.bestDay).toEqual({ date: "2026-09-15", count: 30 });
  });

  it("keeps the current streak below the record after a gap", () => {
    const records = shapeStudyRecords({
      dayCounts: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-19", "2026-09-20"].map((date) => ({
        date,
        count: 1,
      })),
      todayKey: "2026-09-20",
    });

    expect(records.currentStreak).toBe(2);
    expect(records.longestStreak?.days).toBe(3);
  });
});

describe("shapeStudyRhythm", () => {
  it("returns 24 empty hours and 7 empty weekdays for an empty log", () => {
    const rhythm = shapeStudyRhythm({ hourRows: [], weekdayRows: [] });

    expect(rhythm.hours).toHaveLength(24);
    expect(rhythm.weekdays).toHaveLength(7);
    expect(rhythm.hours.every((h) => h.totalReviews === 0 && h.passRate === null)).toBe(true);
    expect(rhythm.weekdays.every((d) => d.totalReviews === 0 && d.passRate === null)).toBe(true);
  });

  it("numbers hours 0-23 and weekdays Sunday-first from 0", () => {
    const rhythm = shapeStudyRhythm({ hourRows: [], weekdayRows: [] });

    expect(rhythm.hours.map((h) => h.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(rhythm.weekdays.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("fills in the hours and weekdays nothing was reviewed in", () => {
    const rhythm = shapeStudyRhythm({
      hourRows: [{ hour: 21, totalReviews: 10, passCount: 7 }],
      weekdayRows: [{ weekday: 5, totalReviews: 10, passCount: 7 }],
    });

    expect(rhythm.hours[21]).toEqual({ hour: 21, totalReviews: 10, passCount: 7, passRate: 0.7 });
    expect(rhythm.hours[20]).toEqual({ hour: 20, totalReviews: 0, passCount: 0, passRate: null });
    expect(rhythm.weekdays[5]).toEqual({ weekday: 5, totalReviews: 10, passCount: 7, passRate: 0.7 });
    expect(rhythm.weekdays[0]!.passRate).toBeNull();
  });

  it("derives one rate from pooled counts rather than averaging rates", () => {
    const rhythm = shapeStudyRhythm({
      hourRows: [
        { hour: 9, totalReviews: 3, passCount: 3 },
        { hour: 9, totalReviews: 7, passCount: 1 },
      ],
      weekdayRows: [],
    });

    expect(rhythm.hours[9]).toMatchObject({ totalReviews: 10, passCount: 4, passRate: 0.4 });
  });

  it("ignores rows outside 0-23 hours and 0-6 weekdays", () => {
    const rhythm = shapeStudyRhythm({
      hourRows: [
        { hour: 24, totalReviews: 5, passCount: 5 },
        { hour: -1, totalReviews: 5, passCount: 5 },
        { hour: 1.5, totalReviews: 5, passCount: 5 },
      ],
      weekdayRows: [{ weekday: 7, totalReviews: 5, passCount: 5 }],
    });

    expect(rhythm.hours.reduce((sum, h) => sum + h.totalReviews, 0)).toBe(0);
    expect(rhythm.weekdays.reduce((sum, d) => sum + d.totalReviews, 0)).toBe(0);
  });

  it("passes the small-sample threshold through", () => {
    expect(shapeStudyRhythm({ hourRows: [], weekdayRows: [] }).minReviews).toBe(RHYTHM_MIN_REVIEWS);
    expect(RHYTHM_MIN_REVIEWS).toBe(5);
  });
});

describe("failStreakFromResults", () => {
  it("counts leading fails, newest first", () => {
    expect(failStreakFromResults([])).toBe(0);
    expect(failStreakFromResults(["fail"])).toBe(1);
    expect(failStreakFromResults(["fail", "fail", "fail"])).toBe(3);
    expect(failStreakFromResults(["fail", "fail", "pass", "fail"])).toBe(2);
    expect(failStreakFromResults(["pass", "fail", "fail"])).toBe(0);
  });
});

describe("shapeTroubleCards", () => {
  let nextRowId = 1000;
  // Rows are given newest first, the order the query returns them.
  function reviews(cardId: number, results: ("pass" | "fail")[], newestAt = 1_000_000): TroubleReviewRow[] {
    return results.map((result, i) => ({
      id: nextRowId--,
      cardId,
      result,
      reviewedAt: new Date((newestAt - i * 60) * 1000),
    }));
  }
  const load = (ids: number[]) => ids.map((id) => ({ id }) as CardWithDetails);
  const ids = (list: { card: CardWithDetails }[]) => list.map((e) => e.card.id);

  it("returns three empty lists for an empty log", () => {
    expect(shapeTroubleCards([], load)).toEqual({ mostFailed: [], onFailStreak: [], neverPassed: [] });
  });

  it("includes a card exactly at the fail threshold and excludes one under it", () => {
    const rows = [...reviews(1, ["fail", "pass", "fail"]), ...reviews(2, ["fail", "pass", "pass"])];
    const result = shapeTroubleCards(rows, load);
    expect(ids(result.mostFailed)).toEqual([1]);
    expect(result.mostFailed[0]).toMatchObject({ failCount: 2, totalReviews: 3, currentFailStreak: 1 });
  });

  it("puts only cards whose newest reviews are consecutive fails on the streak list", () => {
    const rows = [
      ...reviews(1, ["fail", "fail", "fail", "pass"]),
      ...reviews(2, ["pass", "fail", "fail"]),
      ...reviews(3, ["fail", "fail", "pass"]),
    ];
    const result = shapeTroubleCards(rows, load);
    expect(ids(result.onFailStreak)).toEqual([1, 3]);
    expect(result.onFailStreak.map((e) => e.currentFailStreak)).toEqual([3, 2]);
  });

  it("never-passed needs two reviews and zero passes", () => {
    const rows = [
      ...reviews(1, ["fail", "fail"]),
      ...reviews(2, ["fail"]),
      ...reviews(3, ["fail", "pass"]),
      ...reviews(4, ["fail", "fail", "fail"]),
    ];
    expect(ids(shapeTroubleCards(rows, load).neverPassed)).toEqual([4, 1]);
  });

  it("lets a card appear in more than one list", () => {
    const result = shapeTroubleCards(reviews(1, ["fail", "fail"]), load);
    expect(ids(result.mostFailed)).toEqual([1]);
    expect(ids(result.onFailStreak)).toEqual([1]);
    expect(ids(result.neverPassed)).toEqual([1]);
  });

  it("caps each list at the limit", () => {
    const rows = Array.from({ length: TROUBLE_LIMIT + 5 }, (_, i) => reviews(i + 1, ["fail", "fail"])).flat();
    const result = shapeTroubleCards(rows, load);
    expect(result.mostFailed).toHaveLength(TROUBLE_LIMIT);
    expect(result.neverPassed).toHaveLength(TROUBLE_LIMIT);
  });

  it("breaks ties by most recent review, then card id", () => {
    const rows = [
      ...reviews(5, ["fail", "fail"], 2_000_000),
      ...reviews(3, ["fail", "fail"], 3_000_000),
      ...reviews(2, ["fail", "fail"], 2_000_000),
    ];
    expect(ids(shapeTroubleCards(rows, load).mostFailed)).toEqual([3, 2, 5]);
  });

  it("drops a card that no longer exists instead of crashing", () => {
    const rows = [...reviews(1, ["fail", "fail"]), ...reviews(2, ["fail", "fail"])];
    const result = shapeTroubleCards(rows, (want) => load(want.filter((id) => id !== 1)));
    expect(ids(result.mostFailed)).toEqual([2]);
  });
});

describe("listAvailableTracks", () => {
  it("always lists the title track, even with nothing used", () => {
    expect(listAvailableTracks([])).toEqual(["title"]);
  });

  it("lists title once and first whether or not it was used", () => {
    expect(listAvailableTracks(["song", "title"])).toEqual(["title", "song"]);
    expect(listAvailableTracks(["song"])).toEqual(["title", "song"]);
  });

  it("orders combinations as GRADING_CRITERIA does, not as they were found", () => {
    expect(listAvailableTracks(["title+song+slot+artist", "artist", "title+slot", "song"])).toEqual([
      "title",
      "song",
      "artist",
      "title+slot",
      "title+song+slot+artist",
    ]);
  });

  it("de-duplicates", () => {
    expect(listAvailableTracks(["artist", "artist", "title", "title"])).toEqual(["title", "artist"]);
  });

  it("ignores unknown values, non-canonical orders and the retired both", () => {
    expect(listAvailableTracks(["nope", "song+title", "both", "slot"])).toEqual(["title"]);
  });
});
