export interface BreakdownRow {
  id: number;
  label: string;
  sublabel: string | null;
  totalReviews: number;
  passRate: number | null;
}

export type BreakdownSort = "reviews" | "weakest" | "strongest" | "name";

export const BREAKDOWN_SORTS: { key: BreakdownSort; label: string }[] = [
  { key: "reviews", label: "Most reviews" },
  { key: "weakest", label: "Lowest pass rate" },
  { key: "strongest", label: "Highest pass rate" },
  { key: "name", label: "Name" },
];

function searchable(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

/**
 * Rows whose label or sublabel contains the query, in the chosen order. Rows
 * with no pass rate yet sink below rated ones in either pass-rate order.
 */
export function filterBreakdownRows<T extends BreakdownRow>(rows: readonly T[], query: string, sort: BreakdownSort): T[] {
  const needle = searchable(query.trim());
  const matched = needle
    ? rows.filter((row) => searchable(row.label).includes(needle) || (row.sublabel !== null && searchable(row.sublabel).includes(needle)))
    : [...rows];
  const byName = (a: T, b: T) => a.label.localeCompare(b.label);
  return matched.sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "reviews") return b.totalReviews - a.totalReviews || byName(a, b);
    if (a.passRate === null || b.passRate === null) {
      return (a.passRate === null ? 1 : 0) - (b.passRate === null ? 1 : 0) || byName(a, b);
    }
    const diff = sort === "weakest" ? a.passRate - b.passRate : b.passRate - a.passRate;
    return diff || b.totalReviews - a.totalReviews || byName(a, b);
  });
}
