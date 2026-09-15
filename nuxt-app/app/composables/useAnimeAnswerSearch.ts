import { onScopeDispose, ref } from "vue";
import { createLatestRequest } from "../utils/latestRequest";

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
  const results = ref<AnimeAnswerOption[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const requests = createLatestRequest();
  const cache = new Map<string, AnimeAnswerOption[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    requests.invalidate();
    clearTimeout(timer);
    results.value = [];
    loading.value = false;
    error.value = null;
  }

  function update(value: string) {
    reset();
    const query = value.trim();
    if (Array.from(query).length < 2) return;
    const cached = cache.get(query);
    if (cached) { results.value = cached; return; }
    const isCurrent = requests.start();
    loading.value = true;
    timer = setTimeout(async () => {
      try {
        const response = await search(query);
        if (!isCurrent()) return;
        const unique = new Map<number, AnimeAnswerOption>();
        for (const option of response) {
          if (Number.isSafeInteger(option.aniListId) && option.aniListId > 0) unique.set(option.aniListId, option);
        }
        results.value = [...unique.values()].slice(0, 10);
        if (cache.size >= 50) cache.delete(cache.keys().next().value!);
        cache.set(query, results.value);
      } catch {
        if (isCurrent()) error.value = "Anime search is unavailable. Try typing again.";
      } finally {
        if (isCurrent()) loading.value = false;
      }
    }, 250);
  }

  onScopeDispose(reset);
  return { results, loading, error, update, reset };
}
