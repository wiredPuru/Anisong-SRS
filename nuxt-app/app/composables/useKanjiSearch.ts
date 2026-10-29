// Mirrors KanjiSearchResult in server/utils/kanjiData.ts, same field order (F-09).
export interface KanjiSearchResult {
  char: string;
  keyword: string;
  alternates: string[];
  rtk: number | null;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

function isSearchable(query: string): boolean {
  const text = query.trim();
  return text.length >= MIN_QUERY || /[㐀-鿿]/.test(text);
}

export function useKanjiSearch() {
  const query = ref("");
  const results = ref<KanjiSearchResult[]>([]);
  const searching = ref(false);
  const searched = ref(false);
  const error = ref<string | null>(null);
  const requests = createLatestRequest();
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function run(text: string) {
    const isCurrent = requests.start();
    searching.value = true;
    error.value = null;
    try {
      const reply = await $fetch<{ results: KanjiSearchResult[] }>("/api/kanji/search", { query: { q: text } });
      if (!isCurrent()) return;
      results.value = reply.results;
      searched.value = true;
    } catch {
      if (!isCurrent()) return;
      results.value = [];
      searched.value = false;
      error.value = "Search failed. Try again.";
    } finally {
      if (isCurrent()) searching.value = false;
    }
  }

  function clear() {
    if (timer) clearTimeout(timer);
    timer = null;
    requests.invalidate();
    query.value = "";
    results.value = [];
    searching.value = false;
    searched.value = false;
    error.value = null;
  }

  watch(query, (value) => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!isSearchable(value)) {
      requests.invalidate();
      results.value = [];
      searching.value = false;
      searched.value = false;
      error.value = null;
      return;
    }
    timer = setTimeout(() => run(value.trim()), DEBOUNCE_MS);
  });

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
  });

  return { query, results, searching, searched, error, clear };
}
