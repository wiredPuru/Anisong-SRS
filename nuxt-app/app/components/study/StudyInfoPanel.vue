<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    songTitle: string;
    songTitleNative: string;
    artistName: string;
    animeTitleEnglish: string;
    animeTitleRomaji: string;
    animeTitleNative: string;
    // Optional so the Theme row is simply absent for any caller that doesn't
    // pass it, rather than this being a breaking addition.
    themeSlot?: string;
    box?: number;
    streak?: number;
    streakRequired?: number;
    blurred?: boolean;
    ambient?: boolean;
    hideToggles?: boolean;
    immersive?: boolean;
    presentationKey?: number;
  }>(),
  { streakRequired: 3 },
);

const emit = defineEmits<{ "streak-required-saved": []; "streak-control-open-change": [boolean] }>();

// This panel deliberately isn't remounted per card (it would reset the
// language toggles below), so the same element carries the CSS blur
// transition from the previous card's already-settled state. Without this,
// a new card that should start blurred instantly instead animates into
// blur from the old card's unblurred state - a visible flash of real text.
// Suppress the transition for exactly one paint on a genuine card change
// (double rAF - the first schedules after this paint, the second confirms
// it happened), then re-enable it so a same-card toggle still fades normally.
const skipBlurTransition = ref(false);

watch(
  () => props.presentationKey,
  () => {
    skipBlurTransition.value = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skipBlurTransition.value = false;
      });
    });
  },
);

const showStreakPopover = ref(false);
const streakTooltipActive = ref(false);
const streakPopoverRef = ref<HTMLElement | null>(null);

const streakControlOpen = computed(() => showStreakPopover.value || streakTooltipActive.value);
watch(streakControlOpen, (open) => emit("streak-control-open-change", open));

function onStreakPopoverSaved() {
  emit("streak-required-saved");
}

function onClickOutsideStreakPopover(event: MouseEvent) {
  if (streakPopoverRef.value && !streakPopoverRef.value.contains(event.target as Node)) {
    showStreakPopover.value = false;
  }
}

function onKeydownStreakPopover(event: KeyboardEvent) {
  if (event.key === "Escape") showStreakPopover.value = false;
}

onMounted(() => {
  window.addEventListener("mousedown", onClickOutsideStreakPopover);
  window.addEventListener("keydown", onKeydownStreakPopover);
});
onUnmounted(() => {
  window.removeEventListener("mousedown", onClickOutsideStreakPopover);
  window.removeEventListener("keydown", onKeydownStreakPopover);
});

const showEn = ref(true);
const showRomaji = ref(true);
const showJapanese = ref(true);
const showFurigana = ref(true);

const animeJpHtml = ref(props.animeTitleNative);
const songJpHtml = ref(props.songTitleNative);
const animeJpIsHtml = ref(false);
const songJpIsHtml = ref(false);
let lastFetchedKey: string | null = null;

async function resolveJapaneseText() {
  const animeText = props.animeTitleNative;
  const songText = props.songTitleNative;
  const key = `${animeText}|||${songText}|||${showFurigana.value}`;
  if (lastFetchedKey === key) return;

  if (!showFurigana.value) {
    animeJpHtml.value = animeText;
    songJpHtml.value = songText;
    animeJpIsHtml.value = false;
    songJpIsHtml.value = false;
    lastFetchedKey = key;
    return;
  }

  animeJpHtml.value = animeText;
  songJpHtml.value = songText;
  animeJpIsHtml.value = false;
  songJpIsHtml.value = false;
  try {
    const [animeResult, songResult] = await Promise.all([
      $fetch<{ html: string }>("/api/furigana", { query: { text: animeText } }),
      $fetch<{ html: string }>("/api/furigana", { query: { text: songText } }),
    ]);
    if (props.animeTitleNative === animeText && props.songTitleNative === songText) {
      animeJpHtml.value = animeResult.html;
      songJpHtml.value = songResult.html;
      animeJpIsHtml.value = true;
      songJpIsHtml.value = true;
      lastFetchedKey = key;
    }
  } catch {
    animeJpHtml.value = animeText;
    songJpHtml.value = songText;
    animeJpIsHtml.value = false;
    songJpIsHtml.value = false;
  }
}

watch(
  [() => props.animeTitleNative, () => props.songTitleNative, showJapanese, showFurigana],
  ([, , jpOn]) => {
    if (jpOn) resolveJapaneseText();
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="info-card"
    :class="{
      blurred: blurred && !immersive,
      'ambient-glass': ambient,
      overlay: immersive,
      'skip-blur-transition': skipBlurTransition,
      'info-hidden': immersive && blurred,
    }"
  >
    <div class="panel-top">
      <div v-if="!hideToggles" class="lang-toggles" role="group" aria-label="Title languages">
        <button
          type="button"
          class="lang-btn"
          :class="{ on: showEn }"
          :aria-pressed="showEn"
          @click="showEn = !showEn"
        >
          EN
        </button>
        <button
          type="button"
          class="lang-btn"
          :class="{ on: showRomaji }"
          :aria-pressed="showRomaji"
          @click="showRomaji = !showRomaji"
        >
          Romaji
        </button>
        <button
          type="button"
          class="lang-btn"
          :class="{ on: showJapanese }"
          :aria-pressed="showJapanese"
          aria-label="Japanese"
          @click="showJapanese = !showJapanese"
        >
          日本語
        </button>
        <button
          type="button"
          class="lang-btn"
          :class="{ on: showFurigana }"
          :aria-pressed="showFurigana"
          aria-label="Furigana"
          :disabled="!showJapanese"
          @click="showFurigana = !showFurigana"
        >
          ふりがな
        </button>
      </div>
      <div v-if="box === 1" ref="streakPopoverRef" class="learning">
        <button
          type="button"
          class="learning-trigger"
          @click="showStreakPopover = !showStreakPopover"
          @mouseenter="streakTooltipActive = true"
          @mouseleave="streakTooltipActive = false"
          @focus="streakTooltipActive = true"
          @blur="streakTooltipActive = false"
        >
          <span class="label">Learning</span>
          <span class="name">{{ streak ?? 0 }}/{{ streakRequired }}</span>
          <span class="tooltip"
            >Answer correctly {{ streakRequired }} times in a row to graduate this card out of the learning
            stage.</span
          >
        </button>
        <div v-if="showStreakPopover" class="learning-popover">
          <SettingsBoxOneStreakControl :required="streakRequired" @saved="onStreakPopoverSaved" />
        </div>
      </div>
    </div>

    <div class="title-block">
      <span v-if="showEn" class="en">{{ animeTitleEnglish }}</span>
      <span v-if="showRomaji" class="romaji">{{ animeTitleRomaji }}</span>
      <span v-if="showJapanese && animeTitleNative !== animeTitleRomaji && animeJpIsHtml" class="jp" v-html="animeJpHtml" />
      <span v-else-if="showJapanese && animeTitleNative !== animeTitleRomaji" class="jp">{{ animeJpHtml }}</span>
    </div>

    <div class="divider" />

    <div class="detail-rows">
      <div class="detail-row">
        <span class="label">Song</span>
        <span class="value">{{ songTitle }}</span>
        <span v-if="showJapanese && songTitleNative !== songTitle && songJpIsHtml" class="jp" v-html="songJpHtml" />
        <span v-else-if="showJapanese && songTitleNative !== songTitle" class="jp">{{ songJpHtml }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Artist</span>
        <span class="value">{{ artistName }}</span>
      </div>
      <div v-if="themeSlot" class="detail-row">
        <span class="label">Theme</span>
        <span class="value">{{ themeSlot }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-card {
  padding: 26px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
  filter: blur(0);
  transition: filter 0.4s ease;
}

.info-card.blurred {
  filter: blur(14px);
}

/* Immersive Hide Info uses a plain visibility toggle, not the blur filter
   above - and unlike v-if removal, this keeps the card's layout box intact
   so its positioned ancestor (study/index.vue's .info-slot) doesn't collapse
   and clip the Auto Reveal countdown that's centered on it. */
.info-card.info-hidden {
  visibility: hidden;
}

/* Card-change only - see the watch() on presentationKey in <script setup>.
   A same-card blur toggle never gets this class, so it keeps transitioning. */
.info-card.skip-blur-transition {
  transition: none;
}

.info-card.ambient-glass {
  background: var(--glass-surface);
  border-color: var(--glass-border);
  backdrop-filter: var(--glass-blur);
}

/* Feature 53: this panel no longer floats over the video - it's one section
   of the bar underneath it (StudyMediaPlayer.vue's .immersive-bar), on that
   bar's own solid surface, so none of the old "must stay legible over
   arbitrary video pixels" treatment (text-shadow, per-chip frosted glass,
   cqw-proportional scaling) is needed any more. Plain flex row instead of
   the base rule's column, reusing the same fixed sizes the non-immersive
   side panel already uses (just tightened a little for a shorter bar row). */
.info-card.overlay {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  padding: 0;
  background: none;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  /* The base .info-card rule sets filter: blur(0) for the non-immersive
     Hide Info blur toggle - even a no-op blur(0) makes this element a new
     backdrop-filter sampling root for its descendants (CSS spec behavior).
     Immersive mode never uses that blur-transition mechanism (it's a plain
     show/hide instead), so resetting filter here is harmless. */
  filter: none;
}

/* The divider separated stacked blocks in the side panel; a horizontal bar
   row already separates them with the gap above instead. */
.info-card.overlay .divider {
  display: none;
}

/* flex: 1 1 100% forces this to claim the whole row width and wrap
   title-block/detail-rows onto a line of their own below it (the parent's
   flex-wrap: wrap is already set) - deliberately, not just for layout: the
   "Learning" streak trigger lives in here (base .learning{margin-left:auto}
   pushes it to the far end), and its popover opens leftward from wherever
   the trigger sits. Grouped tightly with the language toggles at the
   bar's left edge, that trigger sat close enough to the frame's left side
   that the popover opened out over the nav rail - confirmed live via
   bun run measure's browser check, not just reasoned about. Giving this row
   the bar's full width instead puts the trigger near the *right* edge, so
   the popover has the whole bar to open into. */
.info-card.overlay .panel-top {
  flex: 1 1 100%;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.info-card.overlay .title-block {
  gap: 2px;
}

.info-card.overlay .title-block .en {
  font-size: 20px;
}

.info-card.overlay .title-block .romaji {
  font-size: 12px;
}

.info-card.overlay .jp {
  font-size: 15px;
}

/* Song/artist/theme side by side instead of stacked, matching the bar's
   horizontal shape. */
.info-card.overlay .detail-rows {
  flex-direction: row;
  gap: 20px;
}

.info-card.overlay .detail-row .value {
  font-size: 14px;
}

/* Language control and the learning counter share one row at the top of the
   panel, per the artboard. margin-left: auto on .learning rather than
   space-between, so it stays right-aligned when hideToggles drops the
   language control entirely. */
.panel-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lang-toggles {
  display: flex;
  flex: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.lang-btn {
  padding: 6px 12px;
  border: 0;
  border-left: 1px solid var(--border);
  background: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.lang-btn:first-child {
  border-left: 0;
  border-radius: calc(var(--radius-sm) - 1px) 0 0 calc(var(--radius-sm) - 1px);
}

.lang-btn:last-child {
  border-radius: 0 calc(var(--radius-sm) - 1px) calc(var(--radius-sm) - 1px) 0;
}

.lang-btn.on {
  background: var(--accent-secondary);
  color: var(--accent-ink);
}

.lang-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title-block .en {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 400;
  line-height: 1.15;
}

.title-block .romaji {
  font-size: 16px;
  color: var(--muted);
  font-weight: 600;
}

.jp {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent-secondary);
}

.jp :deep(rt) {
  font-size: 11px;
  color: var(--faint);
  font-weight: 600;
}

.divider {
  height: 1px;
  background: var(--border);
}

.label {
  font-size: 11px;
  color: var(--faint);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.4px;
}

.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-row .value {
  font-size: 19px;
  font-weight: 700;
}

.detail-row .jp {
  font-size: 17px;
}

.learning {
  position: relative;
  margin-left: auto;
  flex: none;
}

.learning-trigger {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  cursor: pointer;
}

.learning-trigger .name {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-secondary);
}

.learning-trigger .tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: min(220px, 60vw);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

.learning-trigger:hover .tooltip,
.learning-trigger:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}

.learning-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 6;
  width: min(240px, 60vw);
}
</style>
