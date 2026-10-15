import { normalizeSongTitle } from "./songAnswer";

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

interface TitledOption {
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

// Enter without a picked suggestion: a typed title that matches one suggestion
// exactly (by any of its titles, compared like song names) counts as picking
// it, so typing the full title is as good as clicking it. The first match wins,
// in the search's own ranking order.
export function findTypedAnimeMatch<T extends TitledOption>(typed: string, options: readonly T[]): T | null {
  const answer = normalizeSongTitle(typed);
  if (!answer) return null;
  return options.find((option) =>
    [option.titleRomaji, option.titleEnglish, option.titleNative].some((title) => title && normalizeSongTitle(title) === answer),
  ) ?? null;
}
