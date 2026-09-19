export interface TypedAnswerCategories {
  themeSlot: boolean;
  songName: boolean;
}

export const DEFAULT_TYPED_ANSWER_CATEGORIES: TypedAnswerCategories = { themeSlot: false, songName: false };

export const TYPED_ANSWER_CATEGORIES_STORAGE_KEY = "gaqSrs:typedAnswerCategories";
