import { computed, onScopeDispose, ref, shallowRef, watch, type ComputedRef, type Ref } from "vue";
import type { CardWithDetails, StudyScope } from "./useStudySession";
import { extractErrorMessage } from "./useApiError";
import type { ClipSource } from "../utils/clipSource";
import { filtersQueryValue, type StudyFilters } from "../utils/studyFilters";
import { isPlayableCard } from "../utils/listenQueue";
import { resolveRemotePrefetchUrl } from "../utils/mediaSource";
import { libraryListenTrack, listenCard, listenTrackUnavailableReason, type ListenTrack } from "../utils/listenRequests";
import { clearListenRequests, createListenRequestQueue, currentListenEntry, listenDeckProgress,
  moveListenQueue, pendingListenRequests, removeListenRequest, requestListenTrack } from "../utils/listenRequestQueue";

const PREFETCH_AHEAD = 2;
interface ListenQueueResponse {
  cards: CardWithDetails[];
  total: number;
  offlineHidden?: number;
}

export function useListenSession(
  scope: ComputedRef<StudyScope | null>,
  filters: Ref<StudyFilters>,
  shuffle: Ref<boolean>,
  audioOnly: ComputedRef<boolean>,
  clipSource: ComputedRef<ClipSource>,
) {
  const { canUseRemote } = useNetworkMode();
  const queue = shallowRef(createListenRequestQueue());
  const loading = ref(false);
  const error = ref<string | null>(null);
  const skippedCount = ref(0);
  const capped = ref(false);
  const offlineHidden = ref(0);
  const presentationKey = ref(0);
  const queueKey = ref(0);
  const startOnMount = ref(false);
  let loadToken = 0;
  let disposed = false;

  const currentEntry = computed(() => currentListenEntry(queue.value));
  const nextEntry = computed(() => queue.value.finished ? null : (queue.value.entries[queue.value.index + 1] ?? null));
  const currentCard = computed(() => currentEntry.value ? listenCard(currentEntry.value) : null);
  const nextCard = computed(() => nextEntry.value ? listenCard(nextEntry.value) : null);
  const currentLibraryCard = computed(() => currentEntry.value?.track.kind === "library" ? currentEntry.value.track.card : null);
  const pendingRequests = computed(() => pendingListenRequests(queue.value));
  const deckProgress = computed(() => listenDeckProgress(queue.value));
  const total = computed(() => deckProgress.value.total);
  const index = computed(() => Math.max(0, deckProgress.value.played - 1));
  const finished = computed(() => queue.value.finished);
  const canGoPrevious = computed(() => queue.value.finished || queue.value.index > 0);

  async function load() {
    const token = ++loadToken;
    queue.value = createListenRequestQueue();
    queueKey.value += 1;
    presentationKey.value += 1;
    startOnMount.value = false;
    error.value = null;
    skippedCount.value = 0;
    capped.value = false;
    offlineHidden.value = 0;
    if (!scope.value) { loading.value = false; return; }
    loading.value = true;
    try {
      const result = await $fetch<ListenQueueResponse>("/api/listen/queue", {
        method: "POST",
        body: { scope: scope.value, filters: filtersQueryValue(filters.value), shuffle: shuffle.value },
      });
      if (disposed || token !== loadToken) return;
      const playable = result.cards.filter((card) => isPlayableCard(card, clipSource.value));
      queue.value = createListenRequestQueue(playable.map(libraryListenTrack));
      skippedCount.value = result.cards.length - playable.length;
      capped.value = result.total > result.cards.length;
      offlineHidden.value = result.offlineHidden ?? 0;
      presentationKey.value += 1;
    } catch (err) {
      if (disposed || token !== loadToken) return;
      error.value = extractErrorMessage(err, "Failed to load the playlist.");
    } finally {
      if (!disposed && token === loadToken) loading.value = false;
    }
  }

  function move(direction: "next" | "previous", expectedKey?: number) {
    if (disposed || (expectedKey !== undefined && expectedKey !== presentationKey.value)) return;
    const next = moveListenQueue(queue.value, direction);
    if (next === queue.value) return;
    queue.value = next;
    startOnMount.value = false;
    presentationKey.value += 1;
  }
  const next = () => move("next");
  const advance = (expectedKey: number) => move("next", expectedKey);
  const previous = () => move("previous");

  function request(track: ListenTrack, mode: "now" | "next", expectedQueue = queueKey.value) {
    if (disposed || expectedQueue !== queueKey.value) return "stale" as const;
    if (loading.value || !scope.value || (track.kind === "catalog" && !canUseRemote.value)
      || listenTrackUnavailableReason(track, clipSource.value)) return "unavailable" as const;
    const result = requestListenTrack(queue.value, track, mode);
    queue.value = result.queue;
    error.value = null;
    if (result.status === "playing") {
      startOnMount.value = true;
      presentationKey.value += 1;
    }
    return result.status;
  }

  function removeRequest(entryId: number) { queue.value = removeListenRequest(queue.value, entryId); }
  function clearRequests() { queue.value = clearListenRequests(queue.value); }

  function patchCard(id: number, patch: Partial<CardWithDetails>) {
    queue.value = { ...queue.value, entries: queue.value.entries.map((entry) =>
      entry.track.kind === "library" && entry.track.card.id === id
        ? { ...entry, track: { ...entry.track, card: { ...entry.track.card, ...patch } } } : entry) };
  }
  function patchCurrent(patch: Partial<CardWithDetails>) {
    if (currentLibraryCard.value) patchCard(currentLibraryCard.value.id, patch);
  }

  watch([scope, filters, shuffle], load, { immediate: true, deep: true });
  watch(queue, () => {
    if (!canUseRemote.value || queue.value.finished) return;
    const upcoming = queue.value.entries.slice(queue.value.index + 1, queue.value.index + 1 + PREFETCH_AHEAD);
    for (const entry of upcoming) {
      const url = resolveRemotePrefetchUrl(listenCard(entry), audioOnly.value, clipSource.value);
      if (url) $fetch("/api/media/prefetch", { method: "POST", body: { url } }).catch(() => {});
    }
  });
  onScopeDispose(() => { disposed = true; loadToken += 1; });

  return {
    currentEntry, nextEntry, currentCard, nextCard, currentLibraryCard,
    pendingRequests, deckProgress, queueKey, index, total, finished,
    loading, error, skippedCount, capped, offlineHidden, presentationKey,
    startOnMount, canGoPrevious, next, advance, previous, request, removeRequest, clearRequests,
    restart: load, patchCurrent, patchCard,
  };
}
