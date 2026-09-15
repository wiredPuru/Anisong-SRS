export type AnimeAnswerResult = "pass" | "fail" | "unavailable";

export function evaluateAnimeAnswer(expectedAniListId: unknown, selectedAniListId: unknown): AnimeAnswerResult {
  if (!isAnimeId(expectedAniListId) || !isAnimeId(selectedAniListId)) return "unavailable";
  return expectedAniListId === selectedAniListId ? "pass" : "fail";
}

export function shouldIgnoreAnswerKey(
  disabled: boolean,
  eventIsComposing: boolean,
  compositionActive: boolean,
  repeated: boolean,
): boolean {
  return disabled || eventIsComposing || compositionActive || repeated;
}

function isAnimeId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
