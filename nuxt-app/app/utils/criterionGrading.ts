export type GradingCriterion = "title" | "song" | "both";

export interface RequiredCategories {
  anime: boolean;
  songName: boolean;
}

export function requiredCategories(criterion: GradingCriterion): RequiredCategories {
  return { anime: criterion !== "song", songName: criterion !== "title" };
}

/**
 * Pass/Fail for a typed round. `anime` is null when the anime was not asked or
 * was given up; `song` is null when the song box was left blank. A required
 * category must be answered and correct, and one that is not required never
 * affects the result.
 */
export function gradeTypedRound(
  criterion: GradingCriterion,
  answers: { anime: "pass" | "fail" | null; song: boolean | null },
): "pass" | "fail" {
  const required = requiredCategories(criterion);
  if (required.anime && answers.anime !== "pass") return "fail";
  if (required.songName && answers.song !== true) return "fail";
  return "pass";
}
