import { DEFAULT_GRADING_CRITERION, parseGradingCriterion, type GradingCriterion } from "./gradingCriterion.ts";

export interface ReviewBody {
  cardId: number;
  result: "pass" | "fail";
  criterion: GradingCriterion;
}

/** Validates a POST /api/study/review body, returning an error message when it is unusable. */
export function parseReviewBody(body: unknown): ReviewBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "cardId is required and must be a number" };
  }
  const { cardId, result, criterion: criterionRaw } = body as {
    cardId?: unknown;
    result?: unknown;
    criterion?: unknown;
  };

  if (typeof cardId !== "number") return { error: "cardId is required and must be a number" };
  if (result !== "pass" && result !== "fail") return { error: "result must be 'pass' or 'fail'" };

  if (criterionRaw === undefined) return { cardId, result, criterion: DEFAULT_GRADING_CRITERION };
  const criterion = parseGradingCriterion(criterionRaw);
  if (!criterion) return { error: "criterion must be a valid grading criterion, such as 'title' or 'title+song'" };
  return { cardId, result, criterion };
}
