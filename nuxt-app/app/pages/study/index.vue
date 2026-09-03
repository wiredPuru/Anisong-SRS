<script setup lang="ts">
import type { StudyScope } from "~/composables/useStudySession";

const route = useRoute();

type ScopeResult = { valid: true; scope: StudyScope } | { valid: false };

const scopeResult = computed<ScopeResult>(() => {
  const type = route.query.type;

  if (type === undefined || type === "all") {
    return { valid: true, scope: { type: "all" } };
  }

  if (type === "artist" || type === "anime") {
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
}>("/api/media-library");

const hasDefaultDownloadFolder = computed(() => Boolean(studySettings.value?.defaultDownloadFolder));
const audioOnly = computed(() => studySettings.value?.playbackMode === "audioOnly");

const {
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
  refresh: refreshStudySession,
} = useStudySession(scope, audioOnly);

function onLocalPathUpdated({ kind, localPath }: { kind: "video" | "audio"; localPath: string }) {
  if (!currentCard.value) return;
  currentCard.value = {
    ...currentCard.value,
    ...(kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath }),
  };
}

const showNewCardLimitPopover = ref(false);
const newCardLimitPopoverRef = ref<HTMLElement | null>(null);
const learningControlOpen = ref(false);

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
const hideInfo = ref(false);
const hideCover = ref(false);
const randomStart = ref(false);
const ambientMode = ref(false);
const showControls = ref(true);
const immersive = ref(false);
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
// Shared by both StudyAutoRevealCountdown instances (immersive and
// non-immersive) so their v-if conditions can't drift apart.
const autoRevealCountdownActive = computed(
  () => autoRevealMode.value !== "off" && hasStartedPlaybackThisCard.value && !autoRevealedThisCard.value,
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

function stopAutoRevealTimeout() {
  if (autoRevealTimeout !== null) {
    clearTimeout(autoRevealTimeout);
    autoRevealTimeout = null;
  }
}

function startAutoRevealTimeout(durationMs: number) {
  stopAutoRevealTimeout();
  autoRevealArmedAt = Date.now();
  autoRevealArmedDurationMs = durationMs;
  autoRevealTimeout = setTimeout(() => {
    autoRevealedThisCard.value = true;
    autoRevealTimeout = null;
    autoRevealRemainingMs = null;
  }, durationMs);
}

// Arms (or resumes, with whatever time was left at the last pause) the
// countdown. Called both from the reactive reset below and from every
// playback resume. No-ops harmlessly when Auto Reveal is off, nothing has
// played yet, or this card already revealed.
function maybeStartOrResumeAutoReveal() {
  if (autoRevealMode.value === "off" || autoRevealedThisCard.value || !hasStartedPlaybackThisCard.value) return;
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
  if (isNowHidden || !isTargeted || autoRevealedThisCard.value) return;
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
      if (autoRevealTargetsVisual.value) {
        hideVideo.value = true;
        hideCover.value = true;
      }
      if (autoRevealTargetsInfo.value) {
        hideInfo.value = true;
      }
    }

    stopAutoRevealTimeout();
    autoRevealRemainingMs = null;
    autoRevealedThisCard.value = false;

    // Turning Auto Reveal on, switching mode, or changing the seconds value
    // while a card is actively playing starts counting immediately with the
    // fresh duration above; otherwise this waits for the next real resume.
    if (!isNewCard && isPlaybackActive.value) {
      maybeStartOrResumeAutoReveal();
    }
  },
  { immediate: true },
);

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
  const key = event.key.toLowerCase();
  if (key === "i") {
    hideInfo.value = !hideInfo.value;
  } else if (key === "v") {
    hideVideo.value = !hideVideo.value;
  } else if (key === "c") {
    hideCover.value = !hideCover.value;
  } else if (key === "a") {
    ambientMode.value = !ambientMode.value;
  } else if (key === "h") {
    showControls.value = !showControls.value;
  } else if (key === "e") {
    immersive.value = !immersive.value;
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
    <div v-else-if="loading && !currentCard" class="state">Loading...</div>
    <div v-else-if="error" class="state state-error">{{ error }}</div>
    <div v-else-if="sessionComplete" class="state">All caught up! Nothing due right now.</div>
    <template v-else-if="currentCard">
      <header class="study-header">
        <div class="header-left">
          <span class="chip">{{ scopeChipLabel }}</span>
          <span class="counts">
            Card {{ reviewedCount + 1 }}
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
        </div>
        <div class="header-right">
          <StudyDisplayToggles
            v-if="showControls"
            :hide-video="hideVideo"
            :hide-info="hideInfo"
            :hide-cover="hideCover"
            :random-start="randomStart"
            :ambient-mode="ambientMode"
            v-model:auto-reveal-mode="autoRevealMode"
            :auto-reveal-seconds="autoRevealSeconds"
            @toggle-hide-video="hideVideo = !hideVideo"
            @toggle-hide-info="hideInfo = !hideInfo"
            @toggle-hide-cover="hideCover = !hideCover"
            @toggle-random-start="randomStart = !randomStart"
            @toggle-ambient-mode="ambientMode = !ambientMode"
            @update:auto-reveal-seconds="onUpdateAutoRevealSeconds"
          />
          <button
            type="button"
            class="controls-toggle-btn"
            :aria-label="showControls ? 'Hide controls' : 'Show controls'"
            @click="showControls = !showControls"
          >
            <span aria-hidden="true">{{ showControls ? "👁" : "🙈" }}</span>
            <span class="tooltip">{{ showControls ? "Hide controls" : "Show controls" }} &middot; Hotkey: H</span>
          </button>
        </div>
      </header>
      <div class="study-grid" :class="{ 'study-grid-immersive': immersive }">
        <div class="player-pane">
        <StudyMediaPlayer
          :key="presentationKey"
          :card="currentCard"
          :hide-video="(hideVideo || autoRevealTargetsVisual) && !autoRevealedThisCard"
          :random-start="randomStart"
          :ambient="ambientMode"
          :allow-expand="true"
          :hide-theme-badge="hideInfo && !autoRevealedThisCard"
          :has-default-download-folder="hasDefaultDownloadFolder"
          :audio-only="audioOnly"
          :hide-cover="(hideCover || autoRevealTargetsVisual) && !autoRevealedThisCard"
          :hide-listening-label="immersive && autoRevealCountdownActive"
          v-model:immersive="immersive"
          @playback-started="onPlaybackStarted"
          @playback-paused="onPlaybackPaused"
          @local-path-updated="onLocalPathUpdated"
        >
          <template v-if="immersive" #immersive>
            <StudyAutoRevealCountdown
              v-if="autoRevealCountdownActive"
              :key="presentationKey"
              :seconds="autoRevealSeconds"
              :ambient="ambientMode"
              :immersive="true"
            />
            <div class="info-slot" :class="{ 'info-slot-elevated': learningControlOpen }">
              <StudyInfoPanel
                :blurred="hideInfo && !autoRevealedThisCard"
                :presentation-key="presentationKey"
                :ambient="ambientMode"
                :hide-toggles="!showControls"
                :immersive="true"
                :song-title="currentCard.songTitle"
                :song-title-native="currentCard.songTitleNative"
                :artist-name="currentCard.artistName"
                :anime-title-english="currentCard.animeTitleEnglish"
                :anime-title-romaji="currentCard.animeTitleRomaji"
                :anime-title-native="currentCard.animeTitleNative"
                :theme-slot="currentCard.themeSlot"
                :box="currentCard.box"
                :streak="currentCard.streak"
                :streak-required="studySettings?.boxOneStreakRequired"
                @streak-required-saved="onSettingsSaved"
                @streak-control-open-change="learningControlOpen = $event"
              />
            </div>
            <div class="answer-slot">
              <StudyAnswerControls :disabled="reviewing" @pass="submit('pass')" @fail="submit('fail')" />
            </div>
          </template>
        </StudyMediaPlayer>
        </div>
        <div v-if="!immersive" class="side">
          <div class="info-panel-wrap">
            <StudyAutoRevealCountdown
              v-if="autoRevealCountdownActive"
              :key="presentationKey"
              :seconds="autoRevealSeconds"
              :ambient="ambientMode"
            />
            <StudyInfoPanel
              :blurred="hideInfo && !autoRevealedThisCard"
              :presentation-key="presentationKey"
              :ambient="ambientMode"
              :hide-toggles="!showControls"
              :immersive="false"
              :song-title="currentCard.songTitle"
              :song-title-native="currentCard.songTitleNative"
              :artist-name="currentCard.artistName"
              :anime-title-english="currentCard.animeTitleEnglish"
              :anime-title-romaji="currentCard.animeTitleRomaji"
              :anime-title-native="currentCard.animeTitleNative"
              :theme-slot="currentCard.themeSlot"
              :box="currentCard.box"
              :streak="currentCard.streak"
              :streak-required="studySettings?.boxOneStreakRequired"
              @streak-required-saved="onSettingsSaved"
            />
          </div>
          <StudyAnswerControls :disabled="reviewing" @pass="submit('pass')" @fail="submit('fail')" />
          <!-- Every key here is checked against a real handler: S in
               StudyMediaPlayer's onKeydown, I and E in this page's own. The
               artboard's legend reads "SPACE play/pause / R replay / H hide
               info" - all three wrong, and there is no replay binding at
               all, so it is deliberately not copied. -->
          <p class="hotkey-legend">
            <span><kbd>S</kbd> play/pause</span>
            <span><kbd>I</kbd> hide info</span>
            <span><kbd>E</kbd> immersive</span>
          </p>
        </div>
      </div>
    </template>
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

/* One bordered strip across the top of the content column, replacing the old
   page heading plus scope row. flex: none so it keeps its height while the
   panes below take the rest. */
.study-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
  gap: 14px;
  min-width: 0;
}

.header-right {
  gap: 6px;
  flex: none;
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

.study-grid-immersive {
  grid-template-columns: 1fr;
}

@media (max-width: 820px) {
  .study-grid {
    grid-template-columns: 1fr;
  }

  .side {
    border-left: none;
    border-top: 1px solid var(--border);
  }
}

.player-pane {
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 24px;
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

/* Rendered through StudyMediaPlayer.vue's "immersive" slot, so these are
   real DOM children of .player-frame (position: relative) - positioning is
   plain and exact relative to the video's own box, no need to replicate its
   viewport-centering math (a previous attempt at that got both the
   horizontal AND vertical math wrong in different ways). */
/* Each offset is a plain percent of .player-frame's own box (the
   containing block for an absolutely positioned descendant), calibrated
   against the same ~1450x816 reference frame as the cqw values below, so
   position keeps constant proportion to the frame at every size instead of
   sticking to a fixed px offset tuned for one particular width. */
/* max-height bounds the card so its own content (a long title can wrap to
   two lines, on top of romaji/JP/song/artist) can never grow tall enough to
   run under .answer-slot, which paints after it in DOM order and would
   otherwise silently hide whatever it overlaps - proportional width scaling
   alone doesn't shrink content to fit a *short* frame, only a narrow one.
   67% leaves room for the top offset plus .answer-slot's own reserved space
   below. overflow-y is the backstop for the rare case content still doesn't
   fit even at the smallest clamped text size - scrollable beats silently
   hidden. */
.info-slot {
  position: absolute;
  top: 7.36%;
  left: 1.1%;
  max-width: 55%;
  max-height: 67%;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 10;
}

/* The Learning chip's tooltip/popover are positioned absolute descendants of
   .info-slot, but .info-slot and .answer-slot are separate stacking contexts
   at the same z-index - a child's z-index can never out-rank a sibling
   stacking context, so nothing inside .info-slot could paint above
   .answer-slot no matter how high its own z-index was. Bumped only while the
   Learning tooltip/popover is actually open (StudyInfoPanel.vue's
   streak-control-open-change), so normal info-card content still loses to
   .answer-slot by default - the deliberate behavior the max-height comment
   above already relies on. */
.info-slot-elevated {
  z-index: 20;
  overflow: visible;
}

/* bottom uses max(), not a plain %, so this never shrinks below
   .player-controls' own clamped floor height (StudyMediaPlayer.vue) on a
   very small frame - a plain percentage clearance can shrink faster than
   that floor stops shrinking, letting the two overlap again right where the
   proportional scaling above bottoms out. 60px clears the controls bar's
   worst-case floor height (~49px: two 9px vertical paddings plus a 31px
   play button) with a small buffer. */
.answer-slot {
  position: absolute;
  left: 1.1%;
  right: 1.1%;
  bottom: max(11.03%, 60px);
  z-index: 10;
}

/* Each button gets its own frosted background, matching the info card's
   overlay treatment, rather than one undifferentiated bar behind both -
   :deep() reaches into StudyAnswerControls.vue's own scoped .answer-btn
   without needing to touch that component. Its existing pass/fail-tinted
   border-color is left alone so the two stay visually distinct. */
/* Transparent, blur-only "glass" look (the one the user actually wanted -
   an earlier round mistakenly forced this to a dark tint instead).
   !important still needed to beat StudyAnswerControls.vue's own scoped
   .answer-btn rule (background: var(--surface)). */
.answer-slot :deep(.answer-btn) {
  background: transparent !important;
  /* Lighter than the shared --glass-blur token (app-wide default) so the
     video stays more visible through it - matches StudyInfoPanel.vue's
     immersive chips, which use the same value. */
  backdrop-filter: blur(10px) saturate(1.3) !important;
  /* Matches StudyInfoPanel.vue's immersive text-shadow treatment. */
  text-shadow:
    0 2px 8px rgba(0, 0, 0, 0.85),
    0 1px 2px rgba(0, 0, 0, 0.9);
  /* Proportional to .player-frame's rendered width (StudyMediaPlayer.vue's
     container-type: inline-size) instead of StudyAnswerControls.vue's own
     fixed px, calibrated against the same ~1450px reference frame as
     StudyInfoPanel.vue - see its .info-card.overlay comment for why this
     isn't capped at today's fixed value. !important for the same
     specificity reason as the properties above - StudyAnswerControls.vue is
     also used outside .player-frame (the non-immersive .side panel), so its
     own base rule is left untouched and only overridden here. */
  padding: clamp(12px, 1.38cqw, 32px) !important;
  gap: clamp(8px, 0.83cqw, 19px) !important;
  font-size: clamp(13px, 1.24cqw, 29px) !important;
}

.answer-slot :deep(.answer-bar) {
  gap: clamp(10px, 1.1cqw, 26px) !important;
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

.answer-slot :deep(.key) {
  padding: clamp(2px, 0.21cqw, 5px) clamp(6px, 0.62cqw, 14px) !important;
  font-size: clamp(9px, 0.9cqw, 21px) !important;
}
</style>
