import { onScopeDispose, ref, type Ref } from "vue";
import { createLatestRequest } from "../utils/latestRequest";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const MAX_RESULTS = 10;
const MAX_CACHED_QUERIES = 50;

export interface AnswerSearchOptions<T> {
  search: (query: string) => Promise<T[]>;
  // Returning null drops the option, so a provider row with an unusable
  // identity never reaches the suggestion list.
  key: (option: T) => string | number | null;
  errorMessage: string;
}

export function useAnswerSearch<T>({ search, key, errorMessage }: AnswerSearchOptions<T>) {
  const results = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);
  const error = ref<string | null>(null);
  const requests = createLatestRequest();
  const cache = new Map<string, T[]>();
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
    if (Array.from(query).length < MIN_QUERY_LENGTH) return;
    const cached = cache.get(query);
    if (cached) { results.value = cached; return; }
    const isCurrent = requests.start();
    loading.value = true;
    timer = setTimeout(async () => {
      try {
        const response = await search(query);
        if (!isCurrent()) return;
        const unique = new Map<string | number, T>();
        for (const option of response) {
          const identity = key(option);
          if (identity !== null) unique.set(identity, option);
        }
        results.value = [...unique.values()].slice(0, MAX_RESULTS);
        if (cache.size >= MAX_CACHED_QUERIES) cache.delete(cache.keys().next().value!);
        cache.set(query, results.value);
      } catch {
        if (isCurrent()) error.value = errorMessage;
      } finally {
        if (isCurrent()) loading.value = false;
      }
    }, DEBOUNCE_MS);
  }

  onScopeDispose(reset);
  return { results, loading, error, update, reset };
}
