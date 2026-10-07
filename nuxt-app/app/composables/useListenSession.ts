import type { CardWithDetails, StudyScope } from "~/composables/useStudySession";
import type { ClipSource } from "~/utils/clipSource";
import type { StudyFilters } from "~/utils/studyFilters";

const PREFETCH_AHEAD = 2;

interface ListenQueueResponse {
  cards: CardWithDetails[];
  total: number;
}

// A playlist over a scope: no grading and no schedule, so unlike
// useStudySession it never calls a study or review route.
export function useListenSession(
  scope: ComputedRef<StudyScope | null>,
  filters: Ref<StudyFilters>,
  shuffle: Ref<boolean>,
  audioOnly: ComputedRef<boolean>,
  clipSource: ComputedRef<ClipSource>,
) {
  const cards = ref<CardWithDetails[]>([]);
  const index = ref(0);
  const finished = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const skippedCount = ref(0);
  const capped = ref(false);
  // Bumped on every song shown, even a repeat of the same card, so the player
  // always gets a fresh mount.
  const presentationKey = ref(0);
  let loadToken = 0;

  const total = computed(() => cards.value.length);
  const currentCard = computed<CardWithDetails | null>(() => (finished.value ? null : (cards.value[index.value] ?? null)));

  async function load() {
    if (!scope.value) return;
    const token = ++loadToken;
    loading.value = true;
    error.value = null;
    try {
      const result = await $fetch<ListenQueueResponse>("/api/listen/queue", {
        method: "POST",
        body: { scope: scope.value, filters: filtersQueryValue(filters.value), shuffle: shuffle.value },
      });
      if (token !== loadToken) return;
      const playable = result.cards.filter((card) => isPlayableCard(card, clipSource.value));
      cards.value = playable;
      skippedCount.value = result.cards.length - playable.length;
      capped.value = result.total > result.cards.length;
      index.value = 0;
      finished.value = false;
      presentationKey.value += 1;
    } catch (err) {
      if (token !== loadToken) return;
      cards.value = [];
      error.value = extractErrorMessage(err, "Failed to load the playlist.");
    } finally {
      if (token === loadToken) loading.value = false;
    }
  }

  function next() {
    if (finished.value || !cards.value.length) return;
    const step = stepIndex(index.value, total.value, "next");
    if (step === "finished") {
      finished.value = true;
      return;
    }
    index.value = step;
    presentationKey.value += 1;
  }

  function previous() {
    if (!cards.value.length) return;
    if (finished.value) {
      finished.value = false;
    } else {
      const step = stepIndex(index.value, total.value, "previous");
      if (step === "finished" || step === index.value) return;
      index.value = step;
    }
    presentationKey.value += 1;
  }

  // A download or cleared path updates the song in place; an index write does not
  // retrigger the prefetch watch below, which only looks at the array's identity.
  function patchCurrent(patch: Partial<CardWithDetails>) {
    const current = cards.value[index.value];
    if (current) cards.value[index.value] = { ...current, ...patch };
  }

  // Refetches rather than rewinding, so a shuffled playlist comes back reshuffled.
  function restart() {
    return load();
  }

  watch([scope, filters, shuffle], () => {
    cards.value = [];
    finished.value = false;
    load();
  }, { immediate: true, deep: true });

  // Best-effort cache warm-up for the songs coming up; the current song's own
  // warm-up is StudyMediaPlayer's job.
  watch([cards, index], () => {
    for (const upcoming of cards.value.slice(index.value + 1, index.value + 1 + PREFETCH_AHEAD)) {
      const url = resolveRemotePrefetchUrl(upcoming, audioOnly.value, clipSource.value);
      if (url) $fetch("/api/media/prefetch", { method: "POST", body: { url } }).catch(() => {});
    }
  });

  return {
    cards,
    currentCard,
    index,
    total,
    finished,
    loading,
    error,
    skippedCount,
    capped,
    presentationKey,
    next,
    previous,
    restart,
    patchCurrent,
  };
}
