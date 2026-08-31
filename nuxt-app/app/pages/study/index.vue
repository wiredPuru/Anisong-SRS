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

const {
  currentCard,
  loading,
  error,
  sessionComplete,
  reviewing,
  reviewedCount,
  presentationKey,
  newCardsToday,
  submit,
  refresh: refreshStudySession,
} = useStudySession(scope);

const { data: studySettings, refresh: refreshStudySettings } = await useFetch<{
  dailyNewCardLimit: number | null;
  boxOneStreakRequired: number;
}>("/api/media-library");

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

const scopeChipLabel = computed(() => {
  const result = scopeResult.value;
  if (!result.valid) return "";
  return result.scope.type === "all" ? "All decks" : (deckLabel.value ?? "...");
});

const hideVideo = ref(false);
const hideInfo = ref(false);
const randomStart = ref(false);
const ambientMode = ref(false);
const showControls = ref(true);
const immersive = ref(false);

const AMBIENT_STORAGE_KEY = "gaqSrs:studyAmbientMode";

onMounted(() => {
  try {
    const stored = localStorage.getItem(AMBIENT_STORAGE_KEY);
    ambientMode.value = stored !== null ? stored === "1" : window.innerWidth > 820;
  } catch {
    ambientMode.value = window.innerWidth > 820;
  }
});

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
    <h1>Study</h1>

    <div v-if="!scopeResult.valid" class="state state-error">
      This study link isn't valid. Go back to <NuxtLink to="/decks">Decks</NuxtLink> and pick a deck.
    </div>
    <div v-else-if="loading && !currentCard" class="state">Loading...</div>
    <div v-else-if="error" class="state state-error">{{ error }}</div>
    <div v-else-if="sessionComplete" class="state">All caught up! Nothing due right now.</div>
    <template v-else-if="currentCard">
      <div class="scope-row">
        <span class="chip">{{ scopeChipLabel }}</span>
        <span class="count">Card {{ reviewedCount + 1 }} this session</span>
        <div v-if="newCardsToday" ref="newCardLimitPopoverRef" class="new-card-chip-wrap">
          <button
            type="button"
            class="chip new-card-chip"
            :class="{ 'new-card-chip-reached': newCardsToday.limit !== null && newCardsToday.introduced >= newCardsToday.limit }"
            @click="showNewCardLimitPopover = !showNewCardLimitPopover"
          >
            New cards today: {{ newCardsToday.introduced }}<template v-if="newCardsToday.limit !== null"
              >/{{ newCardsToday.limit }}</template
            ><template v-else> (no limit)</template>
          </button>
          <div v-if="showNewCardLimitPopover" class="new-card-limit-popover">
            <SettingsNewCardLimitControl :limit="studySettings?.dailyNewCardLimit ?? null" @saved="onSettingsSaved" />
          </div>
        </div>
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
      <StudyDisplayToggles
        v-if="showControls"
        :hide-video="hideVideo"
        :hide-info="hideInfo"
        :random-start="randomStart"
        :ambient-mode="ambientMode"
        @toggle-hide-video="hideVideo = !hideVideo"
        @toggle-hide-info="hideInfo = !hideInfo"
        @toggle-random-start="randomStart = !randomStart"
        @toggle-ambient-mode="ambientMode = !ambientMode"
      />
      <div class="study-grid" :class="{ 'study-grid-immersive': immersive }">
        <StudyMediaPlayer
          :key="presentationKey"
          :card="currentCard"
          :hide-video="hideVideo"
          :random-start="randomStart"
          :ambient="ambientMode"
          :allow-expand="true"
          :hide-theme-badge="hideInfo"
          v-model:immersive="immersive"
        >
          <template v-if="immersive" #immersive>
            <div class="info-slot" :class="{ 'info-slot-elevated': learningControlOpen }">
              <StudyInfoPanel
                :blurred="hideInfo"
                :ambient="ambientMode"
                :hide-toggles="!showControls"
                :immersive="true"
                :song-title="currentCard.songTitle"
                :song-title-native="currentCard.songTitleNative"
                :artist-name="currentCard.artistName"
                :anime-title-english="currentCard.animeTitleEnglish"
                :anime-title-romaji="currentCard.animeTitleRomaji"
                :anime-title-native="currentCard.animeTitleNative"
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
        <div v-if="!immersive" class="side">
          <StudyInfoPanel
            :blurred="hideInfo"
            :ambient="ambientMode"
            :hide-toggles="!showControls"
            :immersive="false"
            :song-title="currentCard.songTitle"
            :song-title-native="currentCard.songTitleNative"
            :artist-name="currentCard.artistName"
            :anime-title-english="currentCard.animeTitleEnglish"
            :anime-title-romaji="currentCard.animeTitleRomaji"
            :anime-title-native="currentCard.animeTitleNative"
            :box="currentCard.box"
            :streak="currentCard.streak"
            :streak-required="studySettings?.boxOneStreakRequired"
            @streak-required-saved="onSettingsSaved"
          />
          <StudyAnswerControls :disabled="reviewing" @pass="submit('pass')" @fail="submit('fail')" />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.study {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 {
  margin: 0 0 24px;
  font-size: 28px;
  font-weight: 800;
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
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

.scope-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
}

.count {
  color: var(--muted);
  font-size: 14px;
}

.new-card-chip-reached {
  background: color-mix(in srgb, var(--fail) 18%, var(--surface));
  border-color: var(--fail);
  color: var(--fail);
}

.new-card-chip-wrap {
  position: relative;
}

.new-card-chip {
  font-family: inherit;
  cursor: pointer;
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

.study-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 32px;
  align-items: start;
}

.study-grid-immersive {
  grid-template-columns: 1fr;
}

@media (max-width: 820px) {
  .study-grid {
    grid-template-columns: 1fr;
  }
}

.side {
  display: flex;
  flex-direction: column;
  gap: 26px;
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

.answer-slot {
  position: absolute;
  left: 1.1%;
  right: 1.1%;
  bottom: 11.03%;
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

.answer-slot :deep(.key) {
  padding: clamp(2px, 0.21cqw, 5px) clamp(6px, 0.62cqw, 14px) !important;
  font-size: clamp(9px, 0.9cqw, 21px) !important;
}
</style>
