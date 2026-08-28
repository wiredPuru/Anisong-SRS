export type StudyScope = { type: "all" } | { type: "artist"; id: number } | { type: "anime"; id: number };

export interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
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

  async function fetchNext() {
    if (!scope.value) return;
    loading.value = true;
    error.value = null;
    try {
      const result = await $fetch<{ card: CardWithDetails | null }>("/api/study/next", {
        query: scopeQuery(scope.value),
      });
      currentCard.value = result.card;
      sessionComplete.value = result.card === null;
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

  return { currentCard, loading, error, sessionComplete, reviewing, reviewedCount, submit };
}
