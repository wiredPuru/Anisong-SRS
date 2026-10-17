import { answerSearchRoute } from "../utils/answerSearchRoute";
import { useAnswerSearch } from "./useAnswerSearch";

// Hand-mirrors ArtistAnswerOption in server/utils/artistAnswerOptions.ts. Keep
// the fields in the same order, and keep this one just as redacted.
export interface ArtistAnswerOption {
  key: string;
  artistName: string;
}

type Search = (query: string) => Promise<ArtistAnswerOption[]>;

export function useArtistAnswerSearch(search?: Search) {
  // Only the default route needs the network mode; an injected search stays free of Nuxt.
  const offlineMode = search ? null : useNetworkMode().offlineMode;
  const run: Search = search ?? (async (q) => {
    const route = answerSearchRoute("artist", offlineMode!.value, "/api/lookup/artist-answer-search", q);
    const response = await $fetch<{ results: ArtistAnswerOption[] }>(route.path, { query: route.query });
    return response.results;
  });
  return useAnswerSearch<ArtistAnswerOption>({
    search: run,
    key: (option) => option.key || null,
    errorMessage: "Artist search is unavailable. Try typing again.",
  });
}
