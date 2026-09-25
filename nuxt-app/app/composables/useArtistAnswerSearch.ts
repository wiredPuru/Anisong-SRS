import { useAnswerSearch } from "./useAnswerSearch";

// Hand-mirrors ArtistAnswerOption in server/utils/artistAnswerOptions.ts. Keep
// the fields in the same order, and keep this one just as redacted.
export interface ArtistAnswerOption {
  key: string;
  artistName: string;
}

type Search = (query: string) => Promise<ArtistAnswerOption[]>;

export function useArtistAnswerSearch(search: Search = async (q) => {
  const response = await $fetch<{ results: ArtistAnswerOption[] }>("/api/lookup/artist-answer-search", { query: { q } });
  return response.results;
}) {
  return useAnswerSearch<ArtistAnswerOption>({
    search,
    key: (option) => option.key || null,
    errorMessage: "Artist search is unavailable. Try typing again.",
  });
}
