import { answerSearchRoute } from "../utils/answerSearchRoute";
import { useAnswerSearch } from "./useAnswerSearch";

export interface AnimeAnswerOption {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

type Search = (query: string) => Promise<AnimeAnswerOption[]>;

export function useAnimeAnswerSearch(search?: Search) {
  // Only the default route needs the network mode; an injected search stays free of Nuxt.
  const offlineMode = search ? null : useNetworkMode().offlineMode;
  const run: Search = search ?? (async (q) => {
    const route = answerSearchRoute("anime", offlineMode!.value, "/api/lookup/anilist-search", q);
    const response = await $fetch<{ results: AnimeAnswerOption[] }>(route.path, { query: route.query });
    return response.results;
  });
  return useAnswerSearch<AnimeAnswerOption>({
    search: run,
    key: (option) => (Number.isSafeInteger(option.aniListId) && option.aniListId > 0 ? option.aniListId : null),
    errorMessage: "Anime search is unavailable. Try typing again.",
  });
}
