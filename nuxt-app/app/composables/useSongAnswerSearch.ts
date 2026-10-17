import { answerSearchRoute } from "../utils/answerSearchRoute";
import { useAnswerSearch } from "./useAnswerSearch";

// Hand-mirrors SongAnswerOption in server/utils/songAnswerOptions.ts, per the
// project's two-copy convention for route response shapes. Keep the fields in
// the same order, and keep this one just as redacted.
export interface SongAnswerOption {
  key: string;
  songTitle: string;
  artistName: string | null;
}

type Search = (query: string) => Promise<SongAnswerOption[]>;

export function useSongAnswerSearch(search?: Search) {
  // Only the default route needs the network mode; an injected search stays free of Nuxt.
  const offlineMode = search ? null : useNetworkMode().offlineMode;
  const run: Search = search ?? (async (q) => {
    const route = answerSearchRoute("song", offlineMode!.value, "/api/lookup/song-answer-search", q);
    const response = await $fetch<{ results: SongAnswerOption[] }>(route.path, { query: route.query });
    return response.results;
  });
  return useAnswerSearch<SongAnswerOption>({
    search: run,
    key: (option) => option.key || null,
    errorMessage: "Song search is unavailable. Try typing again.",
  });
}
