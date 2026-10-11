import { buildCriterion, type GradingCategory, type GradingCriterion } from "./criterionGrading";

export interface TypedAnswerCategories {
  anime: boolean;
  themeSlot: boolean;
  songName: boolean;
  artist: boolean;
}

export const DEFAULT_TYPED_ANSWER_CATEGORIES: TypedAnswerCategories = { anime: true, themeSlot: false, songName: false, artist: false };

export const TYPED_ANSWER_CATEGORIES_STORAGE_KEY = "gaqSrs:typedAnswerCategories";

/** Whether `next` leaves at least one thing to guess, with the OP/ED number only counting beside the anime. */
export function hasAnswerCategory(next: TypedAnswerCategories): boolean {
  return next.anime || next.songName || next.artist;
}

/** The track a session grades on when Anime name is off, or null while it is on (the normal title track). */
export function trackWithoutAnime(categories: TypedAnswerCategories): GradingCriterion | null {
  if (categories.anime) return null;
  const chosen: GradingCategory[] = [];
  if (categories.songName) chosen.push("song");
  if (categories.artist) chosen.push("artist");
  return buildCriterion(chosen);
}
