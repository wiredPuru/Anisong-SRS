export const GRADING_CATEGORIES = ["title", "song", "slot", "artist"] as const;

export type GradingCategory = (typeof GRADING_CATEGORIES)[number];

// Every valid criterion, spelled out so the type is an exact union. Each is its
// categories joined by "+" in GRADING_CATEGORIES order; "slot" never appears
// without "title", since an OP/ED number means nothing without the show. The
// order is also the order /stats offers tracks in. Before feature 72,
// "title+song" was stored as "both"; migration 0019 renamed it.
export const GRADING_CRITERIA = [
  "title",
  "song",
  "artist",
  "title+song",
  "title+slot",
  "title+artist",
  "song+artist",
  "title+song+slot",
  "title+song+artist",
  "title+slot+artist",
  "title+song+slot+artist",
] as const;

export type GradingCriterion = (typeof GRADING_CRITERIA)[number];

export const DEFAULT_GRADING_CRITERION: GradingCriterion = "title";

export function isGradingCriterion(value: unknown): value is GradingCriterion {
  return typeof value === "string" && (GRADING_CRITERIA as readonly string[]).includes(value);
}

/** Returns the criterion, or null for anything that is not one. Callers decide whether null is a 400 or a default. */
export function parseGradingCriterion(value: unknown): GradingCriterion | null {
  return isGradingCriterion(value) ? value : null;
}

export function criterionCategories(criterion: GradingCriterion): GradingCategory[] {
  return criterion.split("+") as GradingCategory[];
}

/** The canonical criterion for a set of categories, or null when it is empty or grades "slot" without "title". */
export function buildCriterion(categories: Iterable<GradingCategory>): GradingCriterion | null {
  const chosen = new Set(categories);
  return parseGradingCriterion(GRADING_CATEGORIES.filter((category) => chosen.has(category)).join("+"));
}

// The `card` row holds the title track's box/streak/nextReviewAt, so `card_track`
// only ever stores the others. Everything that reads or writes a track keys
// off this rather than repeating the comparison. It narrows rather than
// returning a plain boolean, so an early return for the title track leaves the
// caller with the exact non-title union card_track's column accepts.
export function isTitleCriterion(criterion: GradingCriterion): criterion is "title" {
  return criterion === "title";
}
