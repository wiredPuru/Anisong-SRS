export type StudyScope = { type: "all" } | { type: "artist"; id: number } | { type: "anime"; id: number };

export interface NewCardsToday {
  introduced: number;
  limit: number | null;
}

export interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  streak: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  songTitleNative: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

function scopeQuery(scope: StudyScope): Record<string, string | number> {
  return scope.type === "all" ? { type: "all" } : { type: scope.type, id: scope.id };
}

export function useStudySession(scope: ComputedRef<StudyScope | null>) {
  const currentCard = ref<CardWithDetails | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sessionComplete = ref(false);
  const reviewing = ref(false);
  const reviewedCount = ref(0);
  // Bumped on every fetched card, even a repeat of the same id (e.g. a failed
  // card coming right back up) - lets the player key off "this presentation"
  // rather than "this card id" so it always gets a fresh mount.
  const presentationKey = ref(0);
  const newCardsToday = ref<NewCardsToday | null>(null);
  const dueCount = ref(0);

  async function fetchNext() {
    if (!scope.value) return;
    loading.value = true;
    error.value = null;
    try {
      const result = await $fetch<{
        card: CardWithDetails | null;
        newCardsToday: NewCardsToday;
        dueCount: number;
        upcoming: CardWithDetails[];
      }>("/api/study/next", { query: scopeQuery(scope.value) });
      currentCard.value = result.card;
      sessionComplete.value = result.card === null;
      newCardsToday.value = result.newCardsToday;
      dueCount.value = result.dueCount;
      if (result.card) presentationKey.value += 1;

      // Best-effort: warm the cache for the next couple of due cards before
      // the queue actually reaches them (current card's own warm-up is
      // StudyMediaPlayer's job, triggered separately on mount).
      for (const upcomingCard of result.upcoming) {
        const url = resolveRemotePrefetchUrl(upcomingCard);
        if (url) $fetch("/api/media/prefetch", { method: "POST", body: { url } }).catch(() => {});
      }
    } catch (err) {
      error.value = extractErrorMessage(err, "Failed to load the next card.");
    } finally {
      loading.value = false;
    }
  }

  async function submit(result: "pass" | "fail") {
    if (reviewing.value || !currentCard.value) return;
    reviewing.value = true;
    error.value = null;
    try {
      await $fetch("/api/study/review", {
        method: "POST",
        body: { cardId: currentCard.value.id, result },
      });
      reviewedCount.value += 1;
      await fetchNext();
    } catch (err) {
      error.value = extractErrorMessage(err, "Failed to submit review.");
    } finally {
      reviewing.value = false;
    }
  }

  watch(
    scope,
    (value) => {
      reviewedCount.value = 0;
      sessionComplete.value = false;
      error.value = null;
      currentCard.value = null;
      if (value) fetchNext();
    },
    { immediate: true },
  );

  return {
    currentCard,
    loading,
    error,
    sessionComplete,
    reviewing,
    reviewedCount,
    presentationKey,
    newCardsToday,
    dueCount,
    submit,
    refresh: fetchNext,
  };
}
