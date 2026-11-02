import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import type { CardWithDetails } from "./useStudySession";
import { extractErrorMessage } from "./useApiError";
import { catalogListenTrack, libraryListenTrack, type ListenCatalogSong, type ListenTrack } from "../utils/listenRequests";
import { isOfflineModeError, type NetworkMode } from "../utils/networkMode";

interface LibraryReply {
  cards: CardWithDetails[];
  page: number;
  totalPages: number;
  total: number;
}
interface SearchRequests {
  library: (query: string, page: number) => Promise<LibraryReply>;
  catalog: (query: string) => Promise<{ results: ListenCatalogSong[] }>;
}

export function useListenSongSearch(offlineMode: Ref<NetworkMode>, requests?: SearchRequests) {
  const run = requests ?? {
    library: (q: string, page: number) => $fetch<LibraryReply>("/api/cards", { query: { q, page } }),
    catalog: (q: string) => $fetch<{ results: ListenCatalogSong[] }>("/api/lookup/song-search", { query: { q } }),
  };
  const query = ref("");
  const library = shallowRef<ListenTrack[]>([]);
  const catalog = shallowRef<ListenTrack[]>([]);
  const libraryLoading = ref(false);
  const catalogLoading = ref(false);
  const libraryError = ref<string | null>(null);
  const catalogError = ref<string | null>(null);
  const catalogNeedsOnline = ref(false);
  const page = ref(0);
  const totalPages = ref(1);
  const total = ref(0);
  let failedPage = 1;
  let epoch = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const hasQuery = computed(() => query.value.trim().length >= 2);
  const hasMore = computed(() => page.value > 0 && page.value < totalPages.value);
  const onlineOnly = computed(() => offlineMode.value === true || catalogNeedsOnline.value);
  const isCurrent = (token: number) => !disposed && token === epoch;

  async function loadLibrary(number: number, token: number, text: string) {
    libraryLoading.value = true;
    libraryError.value = null;
    try {
      const reply = await run.library(text, number);
      if (!isCurrent(token)) return;
      const tracks = reply.cards.map(libraryListenTrack);
      library.value = [...new Map([...(number === 1 ? [] : library.value), ...tracks].map((track) => [track.key, track])).values()];
      page.value = reply.page;
      totalPages.value = reply.totalPages;
      total.value = reply.total;
    } catch (error) {
      if (!isCurrent(token)) return;
      failedPage = number;
      libraryError.value = extractErrorMessage(error, "Couldn't search your library. Try again.");
    } finally {
      if (isCurrent(token)) libraryLoading.value = false;
    }
  }

  async function loadCatalog(token: number, text: string) {
    if (offlineMode.value !== false || !isCurrent(token)) return;
    catalogLoading.value = true;
    catalogError.value = null;
    catalogNeedsOnline.value = false;
    try {
      const reply = await run.catalog(text);
      if (!isCurrent(token)) return;
      const tracks = reply.results.map(catalogListenTrack);
      catalog.value = [...new Map(tracks.map((track) => [track.key, track])).values()];
    } catch (error) {
      if (!isCurrent(token)) return;
      catalogNeedsOnline.value = isOfflineModeError(error);
      if (!catalogNeedsOnline.value) catalogError.value = extractErrorMessage(error, "Couldn't search the online catalog. Try again.");
    } finally {
      if (isCurrent(token)) catalogLoading.value = false;
    }
  }

  function schedule() {
    const token = ++epoch;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    library.value = [];
    catalog.value = [];
    libraryError.value = null;
    catalogError.value = null;
    catalogNeedsOnline.value = false;
    page.value = 0;
    totalPages.value = 1;
    total.value = 0;
    failedPage = 1;
    libraryLoading.value = hasQuery.value;
    catalogLoading.value = hasQuery.value && offlineMode.value === false;
    if (!hasQuery.value) return;
    const text = query.value.trim();
    timer = setTimeout(() => {
      timer = null;
      void loadLibrary(1, token, text);
      void loadCatalog(token, text);
    }, 250);
  }

  function loadMore() {
    if (!libraryLoading.value && hasMore.value) return loadLibrary(page.value + 1, epoch, query.value.trim());
  }
  function retryLibrary() {
    if (hasQuery.value && !libraryLoading.value) return loadLibrary(failedPage, epoch, query.value.trim());
  }
  function retryCatalog() {
    if (hasQuery.value && !catalogLoading.value) return loadCatalog(epoch, query.value.trim());
  }
  watch([query, offlineMode], schedule, { flush: "sync" });
  onScopeDispose(() => { disposed = true; epoch += 1; if (timer !== null) clearTimeout(timer); });

  return { query, library, catalog, libraryLoading, catalogLoading, libraryError, catalogError,
    hasQuery, hasMore, total, onlineOnly, loadMore, retryLibrary, retryCatalog };
}
