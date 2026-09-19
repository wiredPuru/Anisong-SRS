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

export function useSongAnswerSearch(search: Search = async (q) => {
  const response = await $fetch<{ results: SongAnswerOption[] }>("/api/lookup/song-answer-search", { query: { q } });
  return response.results;
}) {
  return useAnswerSearch<SongAnswerOption>({
    search,
    key: (option) => option.key || null,
    errorMessage: "Song search is unavailable. Try typing again.",
  });
}
