import { useAnswerSearch } from "./useAnswerSearch";

export interface AnimeAnswerOption {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

type Search = (query: string) => Promise<AnimeAnswerOption[]>;

export function useAnimeAnswerSearch(search: Search = async (q) => {
  const response = await $fetch<{ results: AnimeAnswerOption[] }>("/api/lookup/anilist-search", { query: { q } });
  return response.results;
}) {
  return useAnswerSearch<AnimeAnswerOption>({
    search,
    key: (option) => (Number.isSafeInteger(option.aniListId) && option.aniListId > 0 ? option.aniListId : null),
    errorMessage: "Anime search is unavailable. Try typing again.",
  });
}
