import type { KanjiEntry } from "~/utils/japaneseBreakdown";

// Mirrors KanjiStudyItem in server/utils/kanjiCards.ts, same field order (F-09).
export interface KanjiStudyItem {
  char: string;
  box: number;
  streak: number;
  nextReviewAt: string;
  createdAt: string;
  entry: KanjiEntry;
}

interface NextReply {
  kanji: KanjiStudyItem | null;
  dueCount: number;
}

export function useKanjiStudy() {
  const current = ref<KanjiStudyItem | null>(null);
  const dueCount = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const revealed = ref(false);
  const story = ref<string | null>(null);
  const grading = ref(false);
  const passed = ref(0);
  const failed = ref(0);
  const requests = createLatestRequest();

  async function loadStory(char: string, isCurrent: () => boolean) {
    try {
      const reply = await $fetch<{ char: string; text: string | null }>("/api/kanji/story", { query: { char } });
      if (isCurrent()) story.value = reply.text;
    } catch {
      // The story is an extra; a missing one never blocks grading.
    }
  }

  async function loadNext() {
    const isCurrent = requests.start();
    loading.value = true;
    error.value = null;
    revealed.value = false;
    story.value = null;
    try {
      const reply = await $fetch<NextReply>("/api/kanji/cards/next");
      if (!isCurrent()) return;
      current.value = reply.kanji;
      dueCount.value = reply.dueCount;
      if (reply.kanji) await loadStory(reply.kanji.char, isCurrent);
    } catch (failure) {
      if (isCurrent()) error.value = extractErrorMessage(failure, "Couldn't load your kanji. Try again.");
    } finally {
      if (isCurrent()) loading.value = false;
    }
  }

  function reveal() {
    if (current.value && !loading.value) revealed.value = true;
  }

  async function grade(result: "pass" | "fail") {
    const item = current.value;
    if (!item || !revealed.value || grading.value) return;
    grading.value = true;
    error.value = null;
    try {
      await $fetch("/api/kanji/cards/review", { method: "POST", body: { char: item.char, result } });
      if (result === "pass") passed.value += 1;
      else failed.value += 1;
      await loadNext();
    } catch (failure) {
      error.value = extractErrorMessage(failure, "Couldn't save that answer. Try again.");
    } finally {
      grading.value = false;
    }
  }

  onScopeDispose(requests.invalidate);

  return { current, dueCount, loading, error, revealed, story, grading, passed, failed, loadNext, reveal, grade };
}
