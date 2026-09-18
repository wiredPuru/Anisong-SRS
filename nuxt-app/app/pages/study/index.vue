<script setup lang="ts">
import type { CardWithDetails, StudyScope } from "~/composables/useStudySession";
import type { AnimeAnswerOption } from "~/composables/useAnimeAnswerSearch";
import type { TypedAnswerCategories } from "~/utils/typedAnswerCategories";
import type { ThemeSlotSelection } from "~/utils/themeSlotAnswer";
import type { BonusCategoryResult } from "~/utils/quizScore";

const route = useRoute();
const typedAnswers = ref(false);
const TYPED_ANSWERS_STORAGE_KEY = "gaqSrs:typedAnswers";
const typedAnswerCategories = ref<TypedAnswerCategories>({ ...DEFAULT_TYPED_ANSWER_CATEGORIES });

onMounted(() => {
  try {
    typedAnswers.value = localStorage.getItem(TYPED_ANSWERS_STORAGE_KEY) === "1";
  } catch {
    // Storage can be unavailable; the toggle still works for this visit.
  }
  try {
    const stored = localStorage.getItem(TYPED_ANSWER_CATEGORIES_STORAGE_KEY);
    if (stored) typedAnswerCategories.value = { ...DEFAULT_TYPED_ANSWER_CATEGORIES, ...JSON.parse(stored) };
  } catch {
    // Storage can be unavailable or hold invalid JSON; the defaults still work for this visit.
  }
});

watch(typedAnswers, (value) => {
  try {
    localStorage.setItem(TYPED_ANSWERS_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Keep the current session usable when persistence is blocked.
  }
});

watch(typedAnswerCategories, (value) => {
  try {
    localStorage.setItem(TYPED_ANSWER_CATEGORIES_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Keep the current session usable when persistence is blocked.
  }
}, { deep: true });

type ScopeResult = { valid: true; scope: StudyScope } | { valid: false };

const scopeResult = computed<ScopeResult>(() => {
  const type = route.query.type;

  if (type === undefined || type === "all") {
    return { valid: true, scope: { type: "all" } };
  }

  if (type === "artist" || type === "anime" || type === "created") {
    const idRaw = route.query.id;
    const id = Number(idRaw);
    if (typeof idRaw === "string" && idRaw.trim() !== "" && Number.isFinite(id)) {
      return { valid: true, scope: { type, id } };
    }
  }

  return { valid: false };
});

const scope = computed<StudyScope | null>(() => (scopeResult.value.valid ? scopeResult.value.scope : null));

// Fetched and resolved before useStudySession is called below, since its
// internal immediate watch fires the first fetchNext() (and thus the first
// lookahead prefetch) synchronously during setup - audioOnly must already
// hold its real value by then, not resolve asynchronously afterward.
const { data: studySettings, refresh: refreshStudySettings } = await useFetch<{
  dailyNewCardLimit: number | null;
  boxOneStreakRequired: number;
  defaultDownloadFolder: string | null;
  playbackMode: "auto" | "audioOnly";
  autoDownload: boolean;
  clipSource: "anisongdb" | "both" | "animethemes";
}>("/api/media-library");

const hasDefaultDownloadFolder = computed(() => Boolean(studySettings.value?.defaultDownloadFolder));
const persistedAudioOnly = computed(() => studySettings.value?.playbackMode === "audioOnly");
const autoDownload = computed(() => studySettings.value?.autoDownload ?? false);
const clipSource = computed(() => studySettings.value?.clipSource ?? "anisongdb");

// A session-only override of the persisted Playback mode setting, toggled
// from the display-toggles row below. `null` means "follow /settings".
// Deliberately never changes the currently-mounted player's media type live
// - see playerAudioOnly below - since a reactive mid-playback swap is
// exactly what caused features 18 and 32 to be abandoned (overlapping
// audio streams). Resets every visit, like Hide Video/Hide Info/Random
// start already do; never persisted to localStorage.
const sessionAudioOnlyOverride = ref<boolean | null>(null);
const effectiveAudioOnly = computed(() => sessionAudioOnlyOverride.value ?? persistedAudioOnly.value);

const {
  currentCard,
  loading,
  error,
  sessionComplete,
  reviewedCount,
  presentationKey,
  newCardsToday,
  dueCount,
  withheldNewCount,
  submit,
  studyNewCards,
  refresh: refreshStudySession,
} = useStudySession(scope, effectiveAudioOnly, clipSource);

// Snapshotted only when a new presentation begins (StudyMediaPlayer fully
// remounts on presentationKey), so toggling "Audio only" mid-card never
// changes the prop on an already-mounted player instance - it only ever
// takes effect starting with the next card.
const playerAudioOnly = ref(effectiveAudioOnly.value);
watch(presentationKey, () => {
  playerAudioOnly.value = effectiveAudioOnly.value;
});

function onLocalPathUpdated({ kind, localPath }: { kind: "video" | "audio"; localPath: string }) {
  if (!currentCard.value) return;
  currentCard.value = {
    ...currentCard.value,
    ...(kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath }),
  };
}

function onLocalPathCleared({ kind }: { kind: "video" | "audio" }) {
  if (!currentCard.value) return;
  currentCard.value = {
    ...currentCard.value,
    ...(kind === "video" ? { localVideoPath: null } : { localAudioPath: null }),
  };
}

interface SessionHistoryEntry {
  card: CardWithDetails;
  result: "pass" | "fail";
}

interface QuizResultPhase {
  presentationKey: number;
  result: "pass" | "fail";
  selectedTitle: string | null;
  correctTitle: string;
  pointsAwarded: number;
  bonusResults: BonusCategoryResult[];
}

// Every card actually reviewed this session, in order - load-bearing for a
// future study-session-log feature, which should read this directly rather
// than re-deriving it. Session-only, like Hide Video/Hide Info/Random
// start/Ambient mode; resets on scope change below.
const sessionHistory = ref<SessionHistoryEntry[]>([]);
const quizScore = ref(createQuizScore());
const quizResult = ref<QuizResultPhase | null>(null);
// Whatever the Opening/Ending picker currently holds when the anime answer
// is submitted or given up - null means the bonus category was skipped for
// this question, not graded as wrong. Reset per card below.
const themeSlotSelection = ref<ThemeSlotSelection | null>(null);

watch(scope, () => {
  sessionHistory.value = [];
  quizScore.value = createQuizScore();
  quizResult.value = null;
});

// Session-only visual feedback for the moment a grade lands - never persisted,
// cleared on its own after the CSS animation finishes.
const gradeFlash = ref<"pass" | "fail" | null>(null);
let gradeFlashTimeout: ReturnType<typeof setTimeout> | null = null;

function flashGrade(result: "pass" | "fail") {
  if (gradeFlashTimeout) clearTimeout(gradeFlashTimeout);
  gradeFlash.value = null;
  // Restart the CSS animation even on the same result back-to-back (e.g. two
  // quick fails): re-add the class on the next tick rather than relying on
  // the class staying set, which wouldn't retrigger the animation at all.
  nextTick(() => {
    gradeFlash.value = result;
    gradeFlashTimeout = setTimeout(() => {
      gradeFlash.value = null;
    }, 500);
  });
}

onUnmounted(() => {
  if (gradeFlashTimeout) clearTimeout(gradeFlashTimeout);
});

const cardEditing = ref(false);
const submissionBusy = ref(false);
const awaitingNextCard = ref(false);
let reviewSubmission = createReviewSubmission();
watch([presentationKey, scope], () => {
  reviewSubmission = createReviewSubmission();
  awaitingNextCard.value = false;
  quizResult.value = null;
  cardEditing.value = false;
  themeSlotSelection.value = null;
});

async function submitReview(result: "pass" | "fail") {
  if (submissionBusy.value || loading.value || cardEditing.value || viewedHistoryEntry.value || showSessionLog.value || !currentCard.value) return;
  const reviewedCard = currentCard.value;
  const presentation = presentationKey.value;
  const scopeKey = JSON.stringify(scope.value);
  const stillCurrent = () => presentationKey.value === presentation && JSON.stringify(scope.value) === scopeKey;
  submissionBusy.value = true;
  try {
    await reviewSubmission.run(async () => {
      const saved = await submit(result);
      if (saved && stillCurrent()) {
        awaitingNextCard.value = true;
        flashGrade(result);
        sessionHistory.value.push({ card: reviewedCard, result });
      }
      return saved;
    }, async () => {
      return stillCurrent() ? await refreshStudySession() : false;
    });
  } finally {
    submissionBusy.value = false;
  }
}

function correctAnimeTitle(card: CardWithDetails): string {
  return card.animeTitleEnglish || card.animeTitleRomaji || card.animeTitleNative;
}

// Grades whatever each enabled bonus category currently holds and folds any
// bonus points into quizScore. A category left blank at submit time is
// skipped entirely - omitted from the result, not graded as wrong.
function gradeBonusCategories(reviewedCard: CardWithDetails): BonusCategoryResult[] {
  const results: BonusCategoryResult[] = [];
  const themeSlotPick = themeSlotSelection.value;
  if (themeSlotPick) {
    const correct = evaluateThemeSlotAnswer(reviewedCard.themeSlot, themeSlotPick);
    const transition = applyBonusCategory(quizScore.value, correct);
    quizScore.value = transition.score;
    const normalizedExpected = normalizeThemeSlot(reviewedCard.themeSlot);
    results.push({
      category: "themeSlot",
      correct,
      pointsAwarded: transition.pointsAwarded,
      selectedLabel: formatThemeSlot(themeSlotPick),
      correctLabel: normalizedExpected ? formatThemeSlot(normalizedExpected) : reviewedCard.themeSlot,
    });
  }
  return results;
}

async function saveTypedAnswer(result: "pass" | "fail", selectedTitle: string | null) {
  if (submissionBusy.value || quizResult.value || loading.value || cardEditing.value || viewedHistoryEntry.value || showSessionLog.value || !currentCard.value) return;
  const reviewedCard = currentCard.value;
  const presentation = presentationKey.value;
  const scopeKey = JSON.stringify(scope.value);
  const stillCurrent = () => presentationKey.value === presentation && JSON.stringify(scope.value) === scopeKey;
  submissionBusy.value = true;
  try {
    const saveState = await reviewSubmission.saveOnce(() => submit(result));
    if (saveState !== "saved" || !stillCurrent()) return;
    const transition = applyQuizResult(quizScore.value, result);
    quizScore.value = transition.score;
    const bonusResults = gradeBonusCategories(reviewedCard);
    flashGrade(result);
    sessionHistory.value.push({ card: reviewedCard, result });
    quizResult.value = {
      presentationKey: presentation,
      result,
      selectedTitle,
      correctTitle: correctAnimeTitle(reviewedCard),
      pointsAwarded: transition.pointsAwarded,
      bonusResults,
    };
  } finally {
    submissionBusy.value = false;
  }
}

function submitTypedAnswer(selection: AnimeAnswerOption) {
  if (!typedAnswers.value || viewedHistoryEntry.value || showSessionLog.value) return;
  const result = evaluateAnimeAnswer(currentCard.value?.animeAniListId, selection.aniListId);
  if (result !== "unavailable") void saveTypedAnswer(result, selection.titleEnglish || selection.titleRomaji || selection.titleNative);
}

async function continueTypedAnswer() {
  if (!quizResult.value || submissionBusy.value || loading.value) return;
  awaitingNextCard.value = true;
  submissionBusy.value = true;
  try {
    const advanced = await reviewSubmission.advanceOnce(refreshStudySession);
    if (advanced) {
      quizResult.value = null;
      awaitingNextCard.value = false;
    }
  } finally {
    submissionBusy.value = false;
  }
}

// Reveals the current card only (Hide Info stays on for the next one) without
// grading or advancing - same finalize-reveal path the `i` hotkey / Auto
// Reveal already use (onHideToggleChanged below). Fail/Pass only render once
// this (or one of those other paths) has already run, so submitReview() above
// never has to reveal-then-grade in one step anymore.
function revealCurrentCard() {
  if (typedAnswers.value) return;
  autoRevealedThisCard.value = true;
  stopAutoRevealTimeout();
  autoRevealRemainingMs = null;
}

const mediaPlayerRef = ref<{ pause: () => void; playIfPaused: () => void } | null>(null);
const viewedHistoryEntry = ref<SessionHistoryEntry | null>(null);
const showSessionLog = ref(false);

function openHistoryCard(entry: SessionHistoryEntry) {
  mediaPlayerRef.value?.pause();
  viewedHistoryEntry.value = entry;
  showSessionLog.value = false;
}

function openPreviousCard() {
  const entry = sessionHistory.value.at(-1);
  if (entry) openHistoryCard(entry);
}

function onHistoryCardUpdated(updated: CardWithDetails) {
  // A card can appear more than once in sessionHistory (failed, then
  // resurfaced and answered again), so every matching entry is kept in
  // sync, not just the one currently being viewed.
  for (const entry of sessionHistory.value) {
    if (entry.card.id === updated.id) entry.card = updated;
  }
  // A failed card can also resurface immediately (box 1, 0-day interval) as
  // the very next due card, so the just-reviewed card and the live one can
  // be the same id - keep both in sync when that happens.
  if (currentCard.value && currentCard.value.id === updated.id) {
    currentCard.value = { ...currentCard.value, ...updated };
  }
}

interface ManualDeck {
  id: number;
  name: string;
}

const { data: manualDecksData } = await useFetch<{ decks: ManualDeck[] }>("/api/decks", {
  query: { type: "created" },
});
const manualDecks = computed(() => manualDecksData.value?.decks ?? []);

const { data: membershipsData, refresh: refreshMemberships } = await useFetch<{
  memberships: Record<number, number[]>;
}>("/api/decks/memberships");

const togglingMembership = reactive<Record<string, boolean>>({});
const deckToggleError = ref<string | null>(null);

async function toggleDeckMembership(cardId: number, deckId: number, checked: boolean) {
  const key = `${cardId}-${deckId}`;
  deckToggleError.value = null;
  togglingMembership[key] = true;
  try {
    await $fetch("/api/decks/cards", {
      method: checked ? "POST" : "DELETE",
      body: { deckId, cardId },
    });
  } catch (err) {
    deckToggleError.value = extractErrorMessage(err, "Failed to update deck membership.");
  } finally {
    await refreshMemberships();
    togglingMembership[key] = false;
  }
}

// StudyCardEditPanel declares a narrow card shape but emits the whole card the
// PATCH returned, so every edited field is applied rather than a named few -
// listing them by hand silently dropped notes when that field was added.
function onCardEdited(updated: { id: number } & Partial<CardWithDetails>) {
  if (!currentCard.value || currentCard.value.id !== updated.id) return;
  currentCard.value = { ...currentCard.value, ...updated };
}

const showNewCardLimitPopover = ref(false);
const newCardLimitPopoverRef = ref<HTMLElement | null>(null);

async function onSettingsSaved() {
  await Promise.all([refreshStudySettings(), refreshStudySession()]);
}

function onClickOutsideNewCardLimitPopover(event: MouseEvent) {
  if (newCardLimitPopoverRef.value && !newCardLimitPopoverRef.value.contains(event.target as Node)) {
    showNewCardLimitPopover.value = false;
  }
}

function onKeydownNewCardLimitPopover(event: KeyboardEvent) {
  if (event.key === "Escape") showNewCardLimitPopover.value = false;
}

onMounted(() => {
  window.addEventListener("mousedown", onClickOutsideNewCardLimitPopover);
  window.addEventListener("keydown", onKeydownNewCardLimitPopover);
});
onUnmounted(() => {
  window.removeEventListener("mousedown", onClickOutsideNewCardLimitPopover);
  window.removeEventListener("keydown", onKeydownNewCardLimitPopover);
});

const deckLabel = ref<string | null>(null);

async function fetchDeckLabel() {
  const result = scopeResult.value;
  if (!result.valid || result.scope.type === "all") {
    deckLabel.value = null;
    return;
  }
  try {
    const response = await $fetch<{ deckLabel: string }>("/api/decks/cards", {
      query: { type: result.scope.type, id: result.scope.id },
    });
    deckLabel.value = response.deckLabel;
  } catch {
    deckLabel.value = null;
  }
}

watch(scopeResult, fetchDeckLabel, { immediate: true });

// Reviews done out of everything this session will cover. dueCount excludes
// what's already been passed, so the two sum to the session total and the bar
// grows as the queue drains. A failed card stays due, so the bar holds rather
// than advancing - the same deliberate behaviour as the "cards left" count.
const sessionProgress = computed(() => {
  const done = reviewedCount.value;
  const total = done + dueCount.value;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
});

const scopeChipLabel = computed(() => {
  const result = scopeResult.value;
  if (!result.valid) return "";
  return result.scope.type === "all" ? "All decks" : (deckLabel.value ?? "...");
});

const hideVideo = ref(false);
const hideInfo = ref(true);
const hideCover = ref(false);
// Set by StudyMediaPlayer's immediate `update:media-kind` emit as soon as it
// mounts (before paint), so this default is only ever visible for the first
// synchronous render tick.
const currentMediaKind = ref<"video" | "audio">("video");
const randomStart = ref(false);
const ambientMode = ref(false);
type AutoRevealMode = "off" | "video" | "info" | "both";
const AUTO_REVEAL_MODES: readonly AutoRevealMode[] = ["off", "video", "info", "both"];
function isAutoRevealMode(value: string | null): value is AutoRevealMode {
  return value !== null && (AUTO_REVEAL_MODES as readonly string[]).includes(value);
}

const autoRevealMode = ref<AutoRevealMode>("off");
// "Visual" covers both Hide Video and Hide Cover - feature 44/45 already
// treats them as the same slot (whichever applies to the current card's
// type), so "Auto Reveal Video" targets whichever one is actually relevant
// rather than being restricted to literally video-capable cards.
const autoRevealTargetsVisual = computed(() => autoRevealMode.value === "video" || autoRevealMode.value === "both");
const autoRevealTargetsInfo = computed(() => autoRevealMode.value === "info" || autoRevealMode.value === "both");

const AUTO_REVEAL_SECONDS_DEFAULT = 5;
const AUTO_REVEAL_SECONDS_MIN = 1;
const AUTO_REVEAL_SECONDS_MAX = 30;

function clampAutoRevealSeconds(value: number): number {
  if (!Number.isFinite(value)) return AUTO_REVEAL_SECONDS_DEFAULT;
  return Math.min(AUTO_REVEAL_SECONDS_MAX, Math.max(AUTO_REVEAL_SECONDS_MIN, Math.round(value)));
}

const autoRevealSeconds = ref(AUTO_REVEAL_SECONDS_DEFAULT);

function onUpdateAutoRevealSeconds(value: number) {
  autoRevealSeconds.value = clampAutoRevealSeconds(value);
}

const AMBIENT_STORAGE_KEY = "gaqSrs:studyAmbientMode";
// Replaces the old boolean gaqSrs:autoReveal key - abandoned outright, no
// migration, matching this app's existing no-migration convention for
// session/preference keys.
const AUTO_REVEAL_MODE_STORAGE_KEY = "gaqSrs:autoRevealMode";
const AUTO_REVEAL_SECONDS_STORAGE_KEY = "gaqSrs:autoRevealSeconds";

onMounted(() => {
  try {
    const stored = localStorage.getItem(AMBIENT_STORAGE_KEY);
    ambientMode.value = stored !== null ? stored === "1" : window.innerWidth > 820;
  } catch {
    ambientMode.value = window.innerWidth > 820;
  }

  try {
    const stored = localStorage.getItem(AUTO_REVEAL_MODE_STORAGE_KEY);
    autoRevealMode.value = isAutoRevealMode(stored) ? stored : "off";
  } catch {
    autoRevealMode.value = "off";
  }

  try {
    const stored = localStorage.getItem(AUTO_REVEAL_SECONDS_STORAGE_KEY);
    autoRevealSeconds.value = stored !== null ? clampAutoRevealSeconds(Number(stored)) : AUTO_REVEAL_SECONDS_DEFAULT;
  } catch {
    autoRevealSeconds.value = AUTO_REVEAL_SECONDS_DEFAULT;
  }
});

watch(autoRevealMode, (value) => {
  try {
    localStorage.setItem(AUTO_REVEAL_MODE_STORAGE_KEY, value);
  } catch {
    // localStorage unavailable (private browsing, locked-down environment) -
    // the mode still works for this session, it just won't persist.
  }
});

watch(autoRevealSeconds, (value) => {
  try {
    localStorage.setItem(AUTO_REVEAL_SECONDS_STORAGE_KEY, String(value));
  } catch {
    // localStorage unavailable (private browsing, locked-down environment) -
    // the preference still works for this session, it just won't persist.
  }
});

const autoRevealedThisCard = ref(false);
const hasStartedPlaybackThisCard = ref(false);
const autoRevealCountdownActive = computed(
  () => canAutoReveal(typedAnswers.value, autoRevealMode.value, hasStartedPlaybackThisCard.value, autoRevealedThisCard.value),
);
// Mirrors the media player's actual play/pause state (see onPlaybackStarted/
// onPlaybackPaused below) - distinct from hasStartedPlaybackThisCard, which
// is a one-way "has this card ever played" latch that a later pause doesn't
// clear.
const isPlaybackActive = ref(false);
let autoRevealTimeout: ReturnType<typeof setTimeout> | null = null;
let autoRevealArmedAt = 0;
let autoRevealArmedDurationMs = 0;
// Set when a running countdown is paused (see onPlaybackPaused); consumed by
// the next resume so it continues from where it left off instead of
// restarting the full duration. Null means "not paused mid-countdown."
let autoRevealRemainingMs: number | null = null;
// The countdown pill renders this rather than keeping its own clock, so it
// freezes on pause exactly when the reveal timeout does.
const autoRevealDisplaySeconds = ref(AUTO_REVEAL_SECONDS_DEFAULT);
let autoRevealDisplayTick: ReturnType<typeof setInterval> | null = null;
// Well under a second so a resume never shows a stale number for long.
const AUTO_REVEAL_DISPLAY_TICK_MS = 250;

function stopAutoRevealTimeout() {
  if (autoRevealTimeout !== null) {
    clearTimeout(autoRevealTimeout);
    autoRevealTimeout = null;
  }
  if (autoRevealDisplayTick !== null) {
    clearInterval(autoRevealDisplayTick);
    autoRevealDisplayTick = null;
  }
}

function startAutoRevealTimeout(durationMs: number) {
  stopAutoRevealTimeout();
  autoRevealArmedAt = Date.now();
  autoRevealArmedDurationMs = durationMs;
  autoRevealTimeout = setTimeout(() => {
    autoRevealedThisCard.value = true;
    stopAutoRevealTimeout();
    autoRevealRemainingMs = null;
  }, durationMs);
  autoRevealDisplayTick = setInterval(syncAutoRevealDisplay, AUTO_REVEAL_DISPLAY_TICK_MS);
  syncAutoRevealDisplay();
}

// Covers the three states onPlaybackPaused/maybeStartOrResumeAutoReveal
// track: actively counting down, paused mid-countdown
// (autoRevealRemainingMs), or not started yet.
function syncAutoRevealDisplay() {
  if (autoRevealTimeout !== null) {
    autoRevealDisplaySeconds.value = remainingRevealSeconds(autoRevealArmedDurationMs, Date.now() - autoRevealArmedAt);
  } else if (autoRevealRemainingMs !== null) {
    autoRevealDisplaySeconds.value = remainingRevealSeconds(autoRevealRemainingMs);
  } else {
    autoRevealDisplaySeconds.value = autoRevealSeconds.value;
  }
}

// Arms (or resumes, with whatever time was left at the last pause) the
// countdown. Called both from the reactive reset below and from every
// playback resume. No-ops harmlessly when Auto Reveal is off, nothing has
// played yet, or this card already revealed.
function maybeStartOrResumeAutoReveal() {
  if (!canAutoReveal(typedAnswers.value, autoRevealMode.value, hasStartedPlaybackThisCard.value, autoRevealedThisCard.value)) return;
  startAutoRevealTimeout(autoRevealRemainingMs ?? autoRevealSeconds.value * 1000);
}

function onPlaybackStarted() {
  hasStartedPlaybackThisCard.value = true;
  isPlaybackActive.value = true;
  maybeStartOrResumeAutoReveal();
}

// Pausing playback pauses the countdown too, rather than letting it keep
// ticking toward a reveal while nothing is actually playing to guess from.
// Records the remaining time so the next resume (onPlaybackStarted, which
// fires on every resume via the "playing" event, not just a card's first
// start) can pick up where this left off.
function onPlaybackPaused() {
  isPlaybackActive.value = false;
  if (autoRevealTimeout === null) return;
  const elapsed = Date.now() - autoRevealArmedAt;
  autoRevealRemainingMs = Math.max(0, autoRevealArmedDurationMs - elapsed);
  stopAutoRevealTimeout();
  syncAutoRevealDisplay();
}

// Forces the newly-targeted Hide toggle(s) on, and reverts whichever
// toggle(s) the *previous* mode had targeted but the new one doesn't -
// covers both "turn Auto Reveal off" and "switch mode" (e.g. Video ->
// Info) in one rule. A toggle untouched by both the old and new mode is
// left completely alone - the user's own manual state for it persists.
const AUTO_REVEAL_MODE_TARGETS: Record<AutoRevealMode, { visual: boolean; info: boolean }> = {
  off: { visual: false, info: false },
  video: { visual: true, info: false },
  info: { visual: false, info: true },
  both: { visual: true, info: true },
};

watch(
  autoRevealMode,
  (mode, previousMode) => {
    if (typedAnswers.value) return;
    const targets = AUTO_REVEAL_MODE_TARGETS[mode];
    const previousTargets = previousMode ? AUTO_REVEAL_MODE_TARGETS[previousMode] : { visual: false, info: false };
    if (targets.visual) {
      hideVideo.value = true;
      hideCover.value = true;
    } else if (previousTargets.visual) {
      hideVideo.value = false;
      hideCover.value = false;
    }
    if (targets.info) {
      hideInfo.value = true;
    } else if (previousTargets.info) {
      hideInfo.value = false;
    }
  },
  { immediate: true },
);

// A manual reveal (button or hotkey) of a still-targeted, still-hidden
// toggle means the answer is already showing - finalize the reveal for
// this card immediately instead of leaving the timer/countdown ticking
// toward a state that's already true. Checking isTargeted at the moment of
// the transition (rather than unconditionally) is what keeps this from
// misfiring when the mode-change watcher above sets a *no-longer-targeted*
// toggle to false (e.g. Video -> Info): by the time that assignment lands,
// the target computeds already reflect the new mode, so isTargeted is
// already false there and this no-ops correctly.
function onHideToggleChanged(isTargeted: boolean, isNowHidden: boolean) {
  if (typedAnswers.value || isNowHidden || !isTargeted || autoRevealedThisCard.value) return;
  autoRevealedThisCard.value = true;
  stopAutoRevealTimeout();
  autoRevealRemainingMs = null;
}

watch(hideVideo, (isHidden) => onHideToggleChanged(autoRevealTargetsVisual.value, isHidden));
watch(hideCover, (isHidden) => onHideToggleChanged(autoRevealTargetsVisual.value, isHidden));
watch(hideInfo, (isHidden) => onHideToggleChanged(autoRevealTargetsInfo.value, isHidden));

watch(
  [presentationKey, autoRevealMode, autoRevealSeconds],
  (newValues, oldValues) => {
    const newKey = newValues[0];
    const oldKey = oldValues?.[0];
    // A new card hasn't been played yet, regardless of what
    // hasStartedPlaybackThisCard's own stale value (from the previous card)
    // still says at this point in the callback. oldValues is undefined on
    // the immediate first run, which also counts as "new" (nothing played
    // for the very first card yet either).
    const isNewCard = oldKey === undefined || newKey !== oldKey;

    // A mode/seconds change after this card already revealed (naturally, or
    // via an early manual reveal - see the hide-toggle watchers above) takes
    // effect starting the next card only; it must never re-hide or restart a
    // countdown on an already-answered card.
    if (!isNewCard && autoRevealedThisCard.value) return;

    if (isNewCard) {
      hasStartedPlaybackThisCard.value = false;
      isPlaybackActive.value = false;
      // Re-forces whichever toggle(s) the active mode targets, overriding
      // any manual Hide Video/Hide Info/Hide Cover change made mid-card on
      // the previous card. Only ever forces on, never off - reverting an
      // untargeted toggle is the mode-change watcher's job above, not this.
      if (!typedAnswers.value && autoRevealTargetsVisual.value) {
        hideVideo.value = true;
        hideCover.value = true;
      }
      if (!typedAnswers.value && autoRevealTargetsInfo.value) {
        hideInfo.value = true;
      }
    }

    stopAutoRevealTimeout();
    autoRevealRemainingMs = null;
    autoRevealedThisCard.value = false;
    syncAutoRevealDisplay();

    // Turning Auto Reveal on, switching mode, or changing the seconds value
    // while a card is actively playing starts counting immediately with the
    // fresh duration above; otherwise this waits for the next real resume.
    if (!isNewCard && isPlaybackActive.value) {
      maybeStartOrResumeAutoReveal();
    }
  },
  { immediate: true },
);

watch(typedAnswers, () => {
  stopAutoRevealTimeout();
  autoRevealRemainingMs = null;
  autoRevealedThisCard.value = false;
  syncAutoRevealDisplay();
  if (!typedAnswers.value && isPlaybackActive.value) maybeStartOrResumeAutoReveal();
});

let hideVideoBeforeTypedAnswers: boolean | null = null;
watch(typedAnswers, (enabled) => {
  const state = transitionTypedAnswerVideo(
    enabled,
    autoRevealTargetsVisual.value,
    hideVideo.value,
    hideVideoBeforeTypedAnswers,
  );
  hideVideo.value = state.hideVideo;
  hideVideoBeforeTypedAnswers = state.hiddenBeforeTypedAnswers;
});

onUnmounted(stopAutoRevealTimeout);

const { setAmbientGlass } = useAmbientGlass();
watch(ambientMode, (value) => {
  setAmbientGlass(value);
  try {
    localStorage.setItem(AMBIENT_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorage unavailable (private browsing, locked-down environment) -
    // the toggle still works for this session, it just won't persist.
  }
});
onUnmounted(() => setAmbientGlass(false));

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (quizResult.value) {
    if (event.key === "Enter" && !shouldIgnoreAnswerKey(false, event.isComposing, false, event.repeat)) {
      event.preventDefault();
      void continueTypedAnswer();
    }
    // Playback's S hotkey is handled independently by StudyMediaPlayer. Keep
    // the result stable by suppressing page-level navigation and reveal keys.
    return;
  }
  if (typedAnswers.value && ["i", "c"].includes(event.key.toLowerCase())) return;
  const key = event.key.toLowerCase();
  if (key === "i") {
    hideInfo.value = !hideInfo.value;
  } else if (key === "v") {
    hideVideo.value = !hideVideo.value;
  } else if (key === "c") {
    hideCover.value = !hideCover.value;
  } else if (key === "a") {
    ambientMode.value = !ambientMode.value;
  } else if (key === "p") {
    openPreviousCard();
  } else if (key === "l") {
    showSessionLog.value = !showSessionLog.value;
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="study">
    <h1 class="sr-only">Study</h1>

    <div v-if="!scopeResult.valid" class="state state-error">
      This study link isn't valid. Go back to <NuxtLink to="/decks">Decks</NuxtLink> and pick a deck.
    </div>
    <div v-else-if="loading && !currentCard" class="state">
      <ActivityStatus label="Loading your study queue" />
    </div>
    <div v-else-if="error && !currentCard" class="state state-error">{{ error }}</div>
    <div v-else-if="sessionComplete" class="state">
      <MascotTemi size="companion" class="state-mascot" />
      <strong class="completion-title">All caught up!</strong>
      <span>Nothing due right now.</span>
      <div v-if="quizScore.answered > 0" class="quiz-summary" aria-label="Typed answer session summary">
        <p class="summary-kicker">Quiz complete</p>
        <div class="summary-score">{{ quizScore.score.toLocaleString() }} <small>points</small></div>
        <div class="summary-stats">
          <span><strong>{{ quizScore.correct }}/{{ quizScore.answered }}</strong> correct</span>
          <span><strong>{{ quizAccuracy(quizScore) }}%</strong> accuracy</span>
          <span><strong>{{ quizScore.bestCombo }}x</strong> best combo</span>
        </div>
      </div>
      <button
        v-if="withheldNewCount > 0"
        type="button"
        class="study-new-btn"
        @click="studyNewCards"
      >
        Study new cards ({{ withheldNewCount }})
        <span class="tooltip">Go past today's new-card limit for the rest of this session</span>
      </button>
      <button
        v-if="sessionHistory.length > 0"
        type="button"
        class="previous-card-btn"
        :disabled="Boolean(quizResult)"
        @click="openPreviousCard"
      >
        &#8617; Previous card
        <span class="tooltip">View the last card you reviewed &middot; Hotkey: P</span>
      </button>
    </div>
    <template v-else-if="currentCard">
      <header class="study-header">
        <div class="header-left">
          <span class="chip">{{ scopeChipLabel }}</span>
          <span class="counts">
            Card {{ reviewedCount + (quizResult ? 0 : 1) }}
            <span class="sep" aria-hidden="true">&middot;</span>
            {{ dueCount }} left
          </span>
          <div v-if="newCardsToday" ref="newCardLimitPopoverRef" class="new-card-chip-wrap">
            <span class="sep" aria-hidden="true">&middot;</span>
            <button
              type="button"
              class="new-card-chip"
              :class="{ 'new-card-chip-reached': newCardsToday.limit !== null && newCardsToday.introduced >= newCardsToday.limit }"
              @click="showNewCardLimitPopover = !showNewCardLimitPopover"
            >
              new {{ newCardsToday.introduced
              }}<template v-if="newCardsToday.limit !== null">/{{ newCardsToday.limit }}</template>
            </button>
            <div v-if="showNewCardLimitPopover" class="new-card-limit-popover">
              <SettingsNewCardLimitControl :limit="studySettings?.dailyNewCardLimit ?? null" @saved="onSettingsSaved" />
            </div>
          </div>
          <div
            class="progress"
            role="progressbar"
            aria-label="Session progress"
            :aria-valuenow="sessionProgress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="progress-fill" :style="{ width: `${sessionProgress}%` }" />
          </div>
          <StudyQuizScore
            v-if="typedAnswers"
            :score="quizScore.score"
            :combo="quizScore.combo"
            :correct="quizScore.correct"
            :answered="quizScore.answered"
          />
        </div>
        <div class="header-right">
          <StudyDisplayToggles
            :hide-video="hideVideo"
            :hide-info="hideInfo"
            :hide-cover="hideCover"
            :media-kind="currentMediaKind"
            :random-start="randomStart"
            :ambient-mode="ambientMode"
            :audio-only="effectiveAudioOnly"
            :typed-answers="typedAnswers"
            :typed-answers-locked="Boolean(quizResult)"
            :typed-answer-categories="typedAnswerCategories"
            @toggle-typed-answers="!submissionBusy && !quizResult && (typedAnswers = !typedAnswers)"
            @update:typed-answer-categories="typedAnswerCategories = $event"
            v-model:auto-reveal-mode="autoRevealMode"
            :auto-reveal-seconds="autoRevealSeconds"
            @toggle-hide-video="hideVideo = !hideVideo"
            @toggle-hide-info="!typedAnswers && (hideInfo = !hideInfo)"
            @toggle-hide-cover="!typedAnswers && (hideCover = !hideCover)"
            @toggle-random-start="randomStart = !randomStart"
            @toggle-ambient-mode="ambientMode = !ambientMode"
            @toggle-audio-only="sessionAudioOnlyOverride = !effectiveAudioOnly"
            @update:auto-reveal-seconds="onUpdateAutoRevealSeconds"
          />
          <StudyThemeSlotAnswer
            v-if="typedAnswers && !quizResult && typedAnswerCategories.themeSlot"
            :key="presentationKey"
            :disabled="cardEditing || submissionBusy || awaitingNextCard || loading || viewedHistoryEntry !== null || showSessionLog"
            @update:selection="themeSlotSelection = $event"
          />
          <button
            type="button"
            class="controls-toggle-btn"
            aria-label="Session log"
            :disabled="Boolean(quizResult)"
            @click="!quizResult && (showSessionLog = !showSessionLog)"
          >
            <span aria-hidden="true">📋</span>
            <span class="tooltip">Session log &middot; Hotkey: L</span>
          </button>
        </div>
      </header>
      <div class="study-grid">
        <div class="player-pane">
          <StudyMediaPlayer
            ref="mediaPlayerRef"
            :key="presentationKey"
            :card="currentCard"
            :hide-video="typedAnswers ? (hideVideo && !quizResult) : (hideVideo || autoRevealTargetsVisual) && !autoRevealedThisCard"
            :random-start="randomStart"
            :ambient="ambientMode"
            :hide-theme-badge="(typedAnswers && !quizResult) || (hideInfo && !autoRevealedThisCard && !quizResult)"
            :has-default-download-folder="hasDefaultDownloadFolder"
            :audio-only="playerAudioOnly"
            :auto-download="autoDownload"
            :clip-source="clipSource"
            :hide-cover="(typedAnswers && !quizResult) || ((hideCover || autoRevealTargetsVisual) && !autoRevealedThisCard && !quizResult)"
            @playback-started="onPlaybackStarted"
            @playback-paused="onPlaybackPaused"
            @local-path-updated="onLocalPathUpdated"
            @local-path-cleared="onLocalPathCleared"
            @update:media-kind="currentMediaKind = $event"
          >
            <template #overlay>
              <StudyTypedAnswer
                v-if="typedAnswers && !quizResult"
                :key="JSON.stringify(scope)"
                overlay
                :presentation-key="presentationKey"
                :context-key="`${viewedHistoryEntry?.card.id ?? ''}:${showSessionLog}:${cardEditing}`"
                :available="evaluateAnimeAnswer(currentCard.animeAniListId, currentCard.animeAniListId) !== 'unavailable'"
                :disabled="cardEditing || submissionBusy || awaitingNextCard || loading || viewedHistoryEntry !== null || showSessionLog"
                @answer="submitTypedAnswer"
                @give-up="saveTypedAnswer('fail', null)"
                @typing-started="mediaPlayerRef?.playIfPaused()"
              />
            </template>
          </StudyMediaPlayer>
        <div v-if="gradeFlash" class="grade-flash" :class="gradeFlash" aria-hidden="true" />
        </div>
        <div class="side">
          <StudyQuizResult
            v-if="typedAnswers && quizResult"
            :result="quizResult.result"
            :selected-title="quizResult.selectedTitle"
            :correct-title="quizResult.correctTitle"
            :points-awarded="quizResult.pointsAwarded"
            :bonus-results="quizResult.bonusResults"
            :score="quizScore.score"
            :combo="quizScore.combo"
            :busy="submissionBusy || loading"
            :retry="Boolean(error && awaitingNextCard)"
            @continue="continueTypedAnswer"
          />
          <div>
            <div class="info-panel-wrap">
              <StudyAutoRevealCountdown
                v-if="autoRevealCountdownActive"
                :seconds="autoRevealDisplaySeconds"
                :ambient="ambientMode"
              />
              <StudyInfoPanel
                :blurred="(typedAnswers && !quizResult) || (hideInfo && !autoRevealedThisCard && !quizResult)"
                :inert="(typedAnswers && !quizResult) || (hideInfo && !autoRevealedThisCard && !quizResult)"
                :presentation-key="presentationKey"
                :ambient="ambientMode"
                :immersive="false"
                :song-title="currentCard.songTitle"
                :song-title-native="currentCard.songTitleNative"
                :artist-name="currentCard.artistName"
                :anime-title-english="currentCard.animeTitleEnglish"
                :anime-title-romaji="currentCard.animeTitleRomaji"
                :anime-title-native="currentCard.animeTitleNative"
                :theme-slot="currentCard.themeSlot"
                :notes="currentCard.notes"
                :box="currentCard.box"
                :streak="currentCard.streak"
                :streak-required="studySettings?.boxOneStreakRequired"
                @streak-required-saved="onSettingsSaved"
              />
              <button
                v-if="!typedAnswers && hideInfo && !autoRevealedThisCard"
                type="button"
                class="info-reveal-target"
                aria-label="Reveal card information"
                :disabled="cardEditing || submissionBusy || awaitingNextCard || loading || viewedHistoryEntry !== null || showSessionLog"
                @click="revealCurrentCard"
                @keydown.enter.stop
                @keydown.space.stop
              />
            </div>
            <StudyCardEditPanel
              :key="presentationKey"
              :card="currentCard"
              :manual-decks="manualDecks"
              :memberships="membershipsData?.memberships ?? {}"
              :toggling-membership="togglingMembership"
              :deck-toggle-error="deckToggleError"
              :has-default-download-folder="hasDefaultDownloadFolder"
              :disabled="Boolean(quizResult)"
              @updated="onCardEdited"
              @editing-change="cardEditing = $event"
              @toggle-membership="(deckId, checked) => toggleDeckMembership(currentCard!.id, deckId, checked)"
            />
          </div>
          <button
            v-if="sessionHistory.length > 0"
            type="button"
            class="previous-card-btn"
            :disabled="Boolean(quizResult)"
            @click="openPreviousCard"
          >
            &#8617; Previous card
            <span class="tooltip">View the last card you reviewed &middot; Hotkey: P</span>
          </button>
          <p v-if="error" role="alert">{{ error }}</p>
          <button v-if="error && awaitingNextCard && !quizResult" type="button" :disabled="submissionBusy" @click="submitReview('fail')">Retry loading next card</button>
          <StudyAnswerControls
            v-if="!typedAnswers"
            :disabled="cardEditing || submissionBusy || awaitingNextCard || loading || viewedHistoryEntry !== null || showSessionLog"
            :awaiting-reveal="hideInfo && !autoRevealedThisCard"
            @pass="submitReview('pass')"
            @fail="submitReview('fail')"
            @reveal="revealCurrentCard"
          />
          <!-- Every key here is checked against a real handler: S in
               StudyMediaPlayer's onKeydown, I in this page's own. The
               artboard's legend reads "SPACE play/pause / R replay / H hide
               info" - all three wrong, and there is no replay binding at
               all, so it is deliberately not copied. -->
          <p class="hotkey-legend">
            <template v-if="typedAnswers">
              <template v-if="quizResult">
                <span><kbd>Enter</kbd> continue</span>
                <span><kbd>S</kbd> play/pause</span>
              </template>
              <template v-else>
                <span><kbd>&uarr;&darr;</kbd> choose</span>
                <span><kbd>Enter</kbd> select / submit</span>
                <span><kbd>Esc</kbd> close suggestions</span>
              </template>
            </template>
            <template v-else>
              <span><kbd>S</kbd> play/pause</span>
              <span><kbd>I</kbd> hide info</span>
              <span><kbd>P</kbd> previous card</span>
              <span><kbd>L</kbd> session log</span>
            </template>
          </p>
        </div>
      </div>
    </template>
    <div class="study-overlay-anchor">
      <CardPreviewModal
        :card="viewedHistoryEntry?.card ?? null"
        :open="viewedHistoryEntry !== null"
        :has-default-download-folder="hasDefaultDownloadFolder"
        :audio-only="effectiveAudioOnly"
        :clip-source="clipSource"
        @close="viewedHistoryEntry = null"
        @updated="onHistoryCardUpdated"
      />
      <StudySessionLogModal
        :entries="sessionHistory"
        :open="showSessionLog"
        @close="showSessionLog = false"
        @select="openHistoryCard"
      />
    </div>
  </main>
</template>

<style scoped>
/* Fills the content column rather than sitting in a centred 1200px measure:
   the artboard runs the split panes edge to edge. flex: 1 opts into the
   full-height column layouts/default.vue now provides. */
.study {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Invalid scope, loading, error and session-complete are each the whole
   screen when they show. In the full-width shell they centre as a single
   card rather than stretching edge to edge as a banner - margin: auto works
   both ways here because .study is a flex column. */
.state {
  margin: auto;
  max-width: 420px;
  padding: 24px;
  text-align: center;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.state a {
  color: var(--accent);
}

.state-error {
  color: var(--fail);
  border-color: var(--fail);
}

.completion-title {
  display: block;
  color: var(--text);
  font: 400 24px var(--font-display);
}

.quiz-summary {
  display: grid;
  gap: 10px;
  width: min(100%, 360px);
  margin: 18px auto;
  padding: 18px;
  border: 1px solid var(--accent-secondary);
  border-radius: var(--radius);
  background: radial-gradient(circle at 50% 0, var(--accent-secondary-glow), transparent 58%), var(--surface-raised);
  box-shadow: var(--shadow-accent);
  animation: summary-arrive 420ms cubic-bezier(0.2, 0.9, 0.25, 1.15);
}

.summary-kicker {
  margin: 0;
  color: var(--accent-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.summary-score {
  color: var(--text);
  font: 400 clamp(30px, 6vw, 44px) var(--font-display);
  line-height: 1;
}

.summary-score small {
  color: var(--muted);
  font: 700 11px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.summary-stats span {
  display: grid;
  gap: 2px;
  color: var(--faint);
  font-size: 10px;
}

.summary-stats strong {
  color: var(--text);
  font: 400 17px var(--font-display);
}

@keyframes summary-arrive {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
}

@media (prefers-reduced-motion: reduce) {
  .quiz-summary { animation: none; }
}

/* One bordered strip across the top of the content column, replacing the old
   page heading plus scope row. flex: none so it keeps its height while the
   panes below take the rest. */
.study-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 12px 20px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
}

.header-left {
  flex: 1 1 520px;
  gap: 14px;
  min-width: 0;
}

.header-right {
  gap: 6px;
  /* flex-shrink: 1 (not flex: none's 0) so this can narrow below its
     content width once .study-header wraps at narrow widths - otherwise
     .display-toggles' own flex-wrap never gets a chance to engage. */
  flex: 0 1 auto;
  min-width: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  flex: none;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

.counts {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
}

.sep {
  color: var(--faint);
}

/* 230px on the artboard, but it is the one flexible thing in the strip, so
   it shrinks first when the window narrows instead of pushing the counts out. */
.progress {
  flex: 0 1 230px;
  min-width: 60px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.new-card-chip-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.new-card-chip {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: var(--faint);
  text-underline-offset: 3px;
}

.new-card-chip:hover {
  color: var(--text);
}

.new-card-chip-reached {
  color: var(--fail);
  text-decoration-color: var(--fail);
}

.new-card-limit-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 6;
  width: 240px;
}

.controls-toggle-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--faint);
  font-size: 14px;
  opacity: 0.6;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.controls-toggle-btn:hover,
.controls-toggle-btn:focus-visible {
  opacity: 1;
}

.controls-toggle-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.controls-toggle-btn .tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

.controls-toggle-btn:hover .tooltip,
.controls-toggle-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}

.study-overlay-anchor {
  position: relative;
}

.state-mascot {
  margin: 0 auto 12px;
}

/* The primary action on the completion screen, so it takes the accent fill
   rather than the outlined treatment "Previous card" below it uses - the two
   sit together there and should not read as equal-weight choices. */
.study-new-btn {
  position: relative;
  align-self: center;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--bg));
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.study-new-btn:hover .tooltip,
.study-new-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}

.study-new-btn .tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.previous-card-btn {
  position: relative;
  align-self: center;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.previous-card-btn .tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

.previous-card-btn:hover .tooltip,
.previous-card-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}

.previous-card-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Two panes, edge to edge, filling whatever height is left under the header.
   No gap: the artboard separates them with .side's own left border, not
   whitespace. min-height: 0 lets the panes shrink inside the grid rather
   than overflowing the page. */
.study-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 480px;
  align-items: stretch;
}

@media (max-width: 820px) {
  .header-left {
    flex-wrap: wrap;
  }

  .study-grid {
    grid-template-columns: 1fr;
  }

  .side {
    border-left: none;
    border-top: 1px solid var(--border);
  }
}

/* A column, not a row: the player was a grid child before 50b and stretched
   to its column by default. As a row flex item it collapsed to its content
   width instead. Column direction leaves align-items at stretch, so the
   player fills the pane, and justify-content centres it vertically. */
.player-pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px;
}

/* A glow, not a fill - matches feature 24's border/glow convention for
   "on" states rather than a solid color wash over the video. Sits above the
   player (no z-index needed, later in DOM order) but never intercepts
   clicks meant for it. */
.grade-flash {
  position: absolute;
  inset: 12px;
  pointer-events: none;
  border-radius: var(--radius);
  animation: grade-flash-pulse 500ms ease-out forwards;
}

.grade-flash.pass {
  box-shadow: 0 0 0 2px var(--pass), 0 0 32px 4px var(--pass);
}

.grade-flash.fail {
  box-shadow: 0 0 0 2px var(--fail), 0 0 32px 4px var(--fail);
}

@keyframes grade-flash-pulse {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* Lets the card shrink to the pane instead of stopping at its content's
   height, which is what gives .player-frame's max-height a definite height
   to resolve against. Scoped here rather than set on .player-card itself:
   CardPreviewModal's panel is also a flex column, and there the card must
   keep its content height and let the panel scroll. */
.player-pane :deep(.player-card) {
  min-height: 0;
}

.side {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 26px;
  overflow-y: auto;
  background: var(--surface-sunken);
  border-left: 1px solid var(--border);
}

/* Positioned ancestor for StudyAutoRevealCountdown's absolute centering -
   scoped to just the info panel, not the whole .side column, so the
   countdown overlays the card itself rather than centering between it and
   the pass/fail buttons below. */
.info-panel-wrap {
  position: relative;
}

.info-panel-wrap :deep(.auto-reveal-countdown) {
  pointer-events: none;
}

.info-reveal-target {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
}

.info-reveal-target:disabled {
  cursor: default;
}

.hotkey-legend {
  margin: 0;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: var(--faint);
}

.hotkey-legend kbd {
  font-family: inherit;
  color: var(--muted);
}
</style>
