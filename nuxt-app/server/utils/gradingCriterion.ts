export const GRADING_CRITERIA = ["title", "song", "both"] as const;

export type GradingCriterion = (typeof GRADING_CRITERIA)[number];

export const DEFAULT_GRADING_CRITERION: GradingCriterion = "title";

export function isGradingCriterion(value: unknown): value is GradingCriterion {
  return typeof value === "string" && (GRADING_CRITERIA as readonly string[]).includes(value);
}

/** Returns the criterion, or null for anything that is not one. Callers decide whether null is a 400 or a default. */
export function parseGradingCriterion(value: unknown): GradingCriterion | null {
  return isGradingCriterion(value) ? value : null;
}

// The `card` row holds the title track's box/streak/nextReviewAt, so `card_track`
// only ever stores the other two. Everything that reads or writes a track keys
// off this rather than repeating the comparison. It narrows rather than
// returning a plain boolean, so an early return for the title track leaves the
// caller with the exact `"song" | "both"` union card_track's column accepts.
export function isTitleCriterion(criterion: GradingCriterion): criterion is "title" {
  return criterion === "title";
}
