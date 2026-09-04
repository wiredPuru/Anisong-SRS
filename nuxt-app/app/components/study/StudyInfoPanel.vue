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
    notes?: string | null;
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
      <div v-if="notes" class="detail-row">
        <span class="label">Notes</span>
        <span class="value notes-value">{{ notes }}</span>
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

.info-card.overlay {
  background: none;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  /* Overrides the base rule's default stretch so short chips (a one-word
     song title, a short artist name) hug their text instead of stretching
     to the widest sibling's width. The title block's own children keep the
     default stretch (unset here) so EN/Romaji/JP still share one chip. */
  align-items: flex-start;
  /* The base .info-card rule sets filter: blur(0) for the non-immersive
     Hide Info blur toggle - even a no-op blur(0) makes this element a new
     backdrop-filter sampling root for its descendants (CSS spec behavior),
     so the chips below were blurring an empty inner layer instead of the
     real video. Immersive mode never uses that blur-transition mechanism
     (it's a plain show/hide instead), so resetting filter here is safe. */
  filter: none;
  /* Overlay-only: sized in cqw against .player-frame's actual rendered
     width (see its container-type: inline-size), so this keeps constant
     proportion to the frame at every size - grows on a large frame, shrinks
     on a small one - rather than being capped at a fixed px value that only
     looked right at one particular frame width. Each cqw multiplier is
     calibrated so a ~1450px-wide frame (a typical desktop immersive size)
     lands on today's original px value; the clamp floor keeps text
     readable on a small frame, and the generous ceiling is a sanity cap
     against an unrealistically huge display, not a normal-range target. */
  padding: clamp(10px, 1.79cqw, 42px);
  gap: clamp(8px, 1.38cqw, 32px);
}

/* Matches the immersive Pass/Fail buttons' per-element frosted treatment
   (study/index.vue's .answer-slot :deep(.answer-btn)) rather than one big
   card background - each block gets its own frosted chip instead. Uses a
   lighter blur than the shared --glass-blur token (used app-wide - nav
   bar, search dropdown, etc.) so the video stays more visible through it;
   study/index.vue's answer-btn override uses the same lighter value. */
/* A dark scrim, not pure transparency. These chips sit over arbitrary video:
   a bright frame left the blurred glass light, and --muted/--faint text on it
   became near-unreadable (the romaji line and the row labels in particular).
   Tinting toward --bg keeps the text on a dark ground whatever is playing
   underneath, while the blur still lets the video through. */
.info-card.overlay .title-block,
.info-card.overlay .detail-rows {
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  backdrop-filter: blur(10px) saturate(1.3);
  padding: clamp(8px, 0.83cqw, 19px) clamp(10px, 1.1cqw, 26px);
}

/* Lifted off --faint for the same reason: it is a deliberately low-contrast
   grey against the app's own dark surfaces, which is the wrong assumption
   over video. */
.info-card.overlay .label {
  color: var(--muted);
}

.info-card.overlay .romaji {
  color: var(--text);
  opacity: 0.85;
}

/* The divider is the side panel's separator; in the overlay each block is
   its own frosted chip, so the gap between them already separates them. */
.info-card.overlay .divider {
  display: none;
}

.info-card.overlay :is(.en, .romaji, .jp, .value, .label) {
  text-shadow:
    0 2px 8px rgba(0, 0, 0, 0.85),
    0 1px 2px rgba(0, 0, 0, 0.9);
}

/* Overlay-only font-size overrides - more specific than the base rules below
   (which the non-immersive side panel still uses unchanged), so they only
   apply here. Proportional (cqw), not capped at the base rule's px value -
   see the comment on .info-card.overlay above for why. */
.info-card.overlay .title-block .en {
  font-size: clamp(15px, 1.86cqw, 43px);
}

.info-card.overlay .title-block .romaji {
  font-size: clamp(11px, 1.1cqw, 26px);
}

.info-card.overlay .jp {
  font-size: clamp(13px, 1.38cqw, 32px);
}

.info-card.overlay .label {
  font-size: clamp(10px, 0.83cqw, 19px);
}

.info-card.overlay .detail-row .value,
.info-card.overlay .learning .name {
  font-size: clamp(12px, 1.24cqw, 29px);
}

.info-card.overlay .detail-rows {
  gap: clamp(8px, 0.83cqw, 19px);
}

.info-card.overlay .lang-toggles {
  gap: clamp(6px, 0.69cqw, 16px);
}

.info-card.overlay .lang-btn {
  padding: clamp(6px, 0.62cqw, 14px) clamp(8px, 1.1cqw, 26px);
  font-size: clamp(10px, 0.9cqw, 21px);
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

/* Free text, not a title - lighter weight and wraps/respects line breaks
   instead of the bold single-line treatment the rest of .value gets. */
.detail-row .value.notes-value {
  font-weight: 500;
  white-space: pre-wrap;
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
