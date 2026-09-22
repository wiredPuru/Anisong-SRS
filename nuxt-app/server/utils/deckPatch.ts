import { parseGradingCriterion, type GradingCriterion } from "./gradingCriterion.ts";

export interface DeckPatchBody {
  id: number;
  name?: string;
  gradingCriterion?: GradingCriterion;
}

/** Validates a PATCH /api/decks body, returning an error message when it is unusable. */
export function parseDeckPatchBody(body: unknown): DeckPatchBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "id is required and must be a number" };
  }
  const { id, name, gradingCriterion: criterionRaw } = body as {
    id?: unknown;
    name?: unknown;
    gradingCriterion?: unknown;
  };

  if (typeof id !== "number") return { error: "id is required and must be a number" };
  if (name === undefined && criterionRaw === undefined) return { error: "name or gradingCriterion is required" };
  if (name !== undefined && typeof name !== "string") return { error: "name must be a string" };

  const parsed: DeckPatchBody = { id };
  if (name !== undefined) parsed.name = name;
  if (criterionRaw !== undefined) {
    const criterion = parseGradingCriterion(criterionRaw);
    if (!criterion) return { error: "gradingCriterion must be 'title', 'song', or 'both'" };
    parsed.gradingCriterion = criterion;
  }
  return parsed;
}
