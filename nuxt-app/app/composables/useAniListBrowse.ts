import { type BrowseAnime, mergePage } from "~/utils/browseSelection";
import { createLatestRequest } from "~/utils/latestRequest";
import type { StudyFilters } from "~/utils/studyFilters";

interface BrowseReply {
  results: BrowseAnime[];
  hasNextPage: boolean;
}

// Pages of AniList's catalog for a filter set (feature 96a's route), with the
// stale-answer guard shared by every window that browses it. Callers own when to
// fetch: their own debounce, selection state, and scroll observer.
export function useAniListBrowse(filters: Ref<StudyFilters>) {
  const results = ref<BrowseAnime[]>([]);
  const page = ref(0);
  const hasNextPage = ref(false);
  const loading = ref(false);
  const loadingMore = ref(false);
  const loadError = ref<string | null>(null);
  const requests = createLatestRequest();

  async function fetchPage(nextPage: number): Promise<BrowseReply | null> {
    const isCurrent = requests.start();
    try {
      const reply = await $fetch<BrowseReply>("/api/lookup/anilist-browse", {
        method: "POST",
        body: { filters: toBrowseFilters(filters.value), page: nextPage },
      });
      return isCurrent() ? reply : null;
    } catch (err) {
      if (isCurrent()) loadError.value = extractErrorMessage(err, "Could not search AniList.");
      return null;
    }
  }

  // A filter change restarts from page 1; an answer that arrives after a newer
  // request was sent is dropped, so a slow response cannot overwrite a fresher list.
  // Resolves true when a fresh first page landed.
  async function loadFirst(): Promise<boolean> {
    loading.value = true;
    loadingMore.value = false;
    loadError.value = null;
    const reply = await fetchPage(1);
    if (reply) {
      results.value = reply.results;
      page.value = 1;
      hasNextPage.value = reply.hasNextPage;
      loading.value = false;
      return true;
    }
    if (loadError.value) loading.value = false;
    return false;
  }

  async function loadMore() {
    if (!hasNextPage.value || loading.value || loadingMore.value) return;
    loadingMore.value = true;
    const reply = await fetchPage(page.value + 1);
    if (reply) {
      results.value = mergePage(results.value, reply.results);
      page.value += 1;
      hasNextPage.value = reply.hasNextPage;
      loadingMore.value = false;
    } else if (loadError.value) {
      loadingMore.value = false;
    }
  }

  // Drops any answer still in flight, for when the window closes.
  function invalidate() {
    requests.invalidate();
  }

  function reset() {
    requests.invalidate();
    results.value = [];
    page.value = 0;
    hasNextPage.value = false;
    loading.value = false;
    loadingMore.value = false;
    loadError.value = null;
  }

  return { results, page, hasNextPage, loading, loadingMore, loadError, loadFirst, loadMore, invalidate, reset };
}
