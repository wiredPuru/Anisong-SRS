import { DEFAULT_GRADING_CRITERION, parseGradingCriterion, type GradingCriterion } from "./gradingCriterion.ts";

/** The `track` query param of GET /api/stats: absent means the anime-title track, anything unrecognised is an error. */
export function parseStatsTrack(value: unknown): GradingCriterion | { error: string } {
  if (value === undefined) return DEFAULT_GRADING_CRITERION;
  return parseGradingCriterion(value) ?? { error: "track must be a valid grading criterion, such as 'title' or 'title+song'" };
}
