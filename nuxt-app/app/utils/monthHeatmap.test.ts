import { describe, expect, it } from "vitest";
import { buildMonthHeatmap, currentMonthKey } from "./monthHeatmap.ts";
import type { ReviewHeatmapDay } from "./monthHeatmap.ts";

describe("currentMonthKey", () => {
  it("formats year and month with a zero-padded month", () => {
    expect(currentMonthKey(new Date(2026, 8, 20))).toBe("2026-09");
    expect(currentMonthKey(new Date(2026, 0, 5))).toBe("2026-01");
  });
});

function day(date: string, count = 0, future = false): ReviewHeatmapDay {
  return { date, count, future };
}

describe("buildMonthHeatmap", () => {
  it("pads leading blanks so the 1st lands on its real weekday", () => {
    // September 1 2026 is a Tuesday.
    const month = buildMonthHeatmap([], "2026-09");

    expect(month.weeks[0]![0]).toEqual({ date: null, day: null, count: 0, future: false });
    expect(month.weeks[0]![1]).toEqual({ date: null, day: null, count: 0, future: false });
    expect(month.weeks[0]![2]).toEqual({ date: "2026-09-01", day: 1, count: 0, future: false });
  });

  it("pads trailing blanks to complete the last week", () => {
    const month = buildMonthHeatmap([], "2026-09");
    const lastWeek = month.weeks.at(-1)!;

    expect(month.weeks).toHaveLength(5);
    expect(lastWeek.at(-1)).toEqual({ date: null, day: null, count: 0, future: false });
  });

  it("needs no padding when the 1st falls on a Sunday and the month is exactly 4 weeks", () => {
    const month = buildMonthHeatmap([], "2026-02");

    expect(month.weeks).toHaveLength(4);
    expect(month.weeks[0]![0]!.date).toBe("2026-02-01");
    expect(month.weeks[3]!.at(-1)!.date).toBe("2026-02-28");
  });

  it("carries counts through for days present in the input", () => {
    const month = buildMonthHeatmap([day("2026-09-15", 7)], "2026-09");
    const cell = month.weeks.flatMap((w) => w).find((c) => c.date === "2026-09-15");

    expect(cell).toEqual({ date: "2026-09-15", day: 15, count: 7, future: false });
  });

  it("scales maxCount and totalReviews to this month alone", () => {
    const month = buildMonthHeatmap(
      [day("2026-08-31", 999), day("2026-09-05", 3), day("2026-09-10", 8)],
      "2026-09",
    );

    expect(month.maxCount).toBe(8);
    expect(month.totalReviews).toBe(11);
  });

  it("zero-fills a day with no recorded reviews and excludes future days from totals", () => {
    const month = buildMonthHeatmap([day("2026-09-24", 50, true)], "2026-09");
    const cells = month.weeks.flatMap((w) => w);
    const future = cells.find((c) => c.date === "2026-09-24")!;
    const untouched = cells.find((c) => c.date === "2026-09-01")!;

    expect(future).toEqual({ date: "2026-09-24", day: 24, count: 0, future: true });
    expect(untouched.count).toBe(0);
    expect(month.maxCount).toBe(0);
    expect(month.totalReviews).toBe(0);
  });

  it("labels the month with its full name and year", () => {
    expect(buildMonthHeatmap([], "2026-09").label).toBe("September 2026");
    expect(buildMonthHeatmap([], "2026-01").label).toBe("January 2026");
  });
});
