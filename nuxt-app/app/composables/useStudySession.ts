import type { GradingCriterion } from "~/utils/criterionGrading";
import type { StudyFilters } from "~/utils/studyFilters";

export type StudyScope =
  | { type: "all" }
  | { type: "artist"; id: number }
  | { type: "anime"; id: number }
  | { type: "created"; id: number };

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
  notes: string | null;
  box: number;
  streak: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  songTitleNative: string;
  themeSlot: string;
  artistId: number;
  artistName: string;
  animeId: number;
  animeAniListId: number;
  animeAnimethemesSlug: string | null;
  animethemesVideoSlug: string | null;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

function scopeQuery(scope: StudyScope): Record<string, string | number> {
  return scope.type === "all" ? { type: "all" } : { type: scope.type, id: scope.id };
}

export function useStudySession(
  scope: ComputedRef<StudyScope | null>,
  audioOnly: ComputedRef<boolean>,
  clipSource: ComputedRef<"anisongdb" | "both" | "animethemes">,
  filters: Ref<StudyFilters>,
) {
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
  // How many never-reviewed cards the daily cap is holding back right now.
  // Drives whether Study offers "Study new cards" at all.
  const withheldNewCount = ref(0);
  // Session-only, like every other study toggle: released by studyNewCards()
  // and reset on scope change below, never persisted. The daily limit setting
  // itself is never written to - this only widens what this session asks for.
  const includeNewBeyondLimit = ref(false);
  // Echoed back to /api/study/review so a review advances the same track the
  // card was served from, rather than the server re-resolving the deck.
  const criterion = ref<GradingCriterion>("title");

  async function fetchNext(): Promise<boolean> {
    if (!scope.value) return false;
    loading.value = true;
    error.value = null;
    try {
      const result = await $fetch<{
        card: CardWithDetails | null;
        criterion: GradingCriterion;
        newCardsToday: NewCardsToday;
        dueCount: number;
        withheldNewCount: number;
        upcoming: CardWithDetails[];
      }>("/api/study/next", {
        query: {
          ...scopeQuery(scope.value),
          ...(includeNewBeyondLimit.value ? { includeNew: "true" } : {}),
          filters: filtersQueryValue(filters.value),
        },
      });
      currentCard.value = result.card;
      criterion.value = result.criterion;
      sessionComplete.value = result.card === null;
      newCardsToday.value = result.newCardsToday;
      dueCount.value = result.dueCount;
      withheldNewCount.value = result.withheldNewCount;
      if (result.card) presentationKey.value += 1;

      // Best-effort: warm the cache for the next couple of due cards before
      // the queue actually reaches them (current card's own warm-up is
      // StudyMediaPlayer's job, triggered separately on mount).
      for (const upcomingCard of result.upcoming) {
        const url = resolveRemotePrefetchUrl(upcomingCard, audioOnly.value, clipSource.value);
        if (url) $fetch("/api/media/prefetch", { method: "POST", body: { url } }).catch(() => {});
      }
      return true;
    } catch (err) {
      error.value = extractErrorMessage(err, "Failed to load the next card.");
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function submit(result: "pass" | "fail") {
    if (reviewing.value || !currentCard.value) return false;
    reviewing.value = true;
    error.value = null;
    try {
      await $fetch("/api/study/review", {
        method: "POST",
        body: { cardId: currentCard.value.id, result, criterion: criterion.value },
      });
      reviewedCount.value += 1;
      return true;
    } catch (err) {
      error.value = extractErrorMessage(err, "Failed to submit review.");
      return false;
    } finally {
      reviewing.value = false;
    }
  }

  // Releases the daily new-card cap for the rest of this session and pulls the
  // first previously-withheld card straight away.
  async function studyNewCards() {
    includeNewBeyondLimit.value = true;
    await fetchNext();
  }

  watch(
    scope,
    (value) => {
      reviewedCount.value = 0;
      sessionComplete.value = false;
      error.value = null;
      currentCard.value = null;
      includeNewBeyondLimit.value = false;
      if (value) fetchNext();
    },
    { immediate: true },
  );

  // Unlike a scope change, the session itself carries on: only the queue it
  // draws from narrows or widens, so the card on screen is replaced.
  watch(filters, () => {
    if (scope.value) fetchNext();
  });

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
    withheldNewCount,
    criterion,
    submit,
    studyNewCards,
    refresh: fetchNext,
  };
}
