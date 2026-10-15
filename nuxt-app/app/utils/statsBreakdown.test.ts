import { describe, expect, it } from "vitest";
import { filterBreakdownRows, type BreakdownRow } from "./statsBreakdown";

const rows: BreakdownRow[] = [
  { id: 1, label: "Yui Horie", sublabel: null, totalReviews: 40, passRate: 0.9 },
  { id: 2, label: "May'n", sublabel: null, totalReviews: 12, passRate: 0.5 },
  { id: 3, label: "LiSA", sublabel: null, totalReviews: 80, passRate: 0.7 },
  { id: 4, label: "Faylan", sublabel: null, totalReviews: 0, passRate: null },
  { id: 5, label: "The Qwaser of Stigmata", sublabel: "Seikon no Qwaser", totalReviews: 6, passRate: 0.5 },
];
const ids = (list: BreakdownRow[]) => list.map((row) => row.id);

describe("filterBreakdownRows", () => {
  it("searches label and sublabel, ignoring case and full-width characters", () => {
    expect(ids(filterBreakdownRows(rows, "lisa", "reviews"))).toEqual([3]);
    expect(ids(filterBreakdownRows(rows, "seikon", "reviews"))).toEqual([5]);
    expect(ids(filterBreakdownRows(rows, "ＭＡＹ", "reviews"))).toEqual([2]);
  });

  it("returns everything for a blank query, without changing the input", () => {
    const input = [...rows];
    expect(filterBreakdownRows(input, "  ", "reviews")).toHaveLength(5);
    expect(input).toEqual(rows);
  });

  it("sorts by review count, then name", () => {
    expect(ids(filterBreakdownRows(rows, "", "reviews"))).toEqual([3, 1, 2, 5, 4]);
  });

  it("sorts by pass rate either way, ties by reviews, unrated rows last", () => {
    expect(ids(filterBreakdownRows(rows, "", "weakest"))).toEqual([2, 5, 3, 1, 4]);
    expect(ids(filterBreakdownRows(rows, "", "strongest"))).toEqual([1, 3, 2, 5, 4]);
  });

  it("sorts by name", () => {
    expect(ids(filterBreakdownRows(rows, "", "name"))).toEqual([4, 3, 2, 5, 1]);
  });
});
