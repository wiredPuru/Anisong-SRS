<script setup lang="ts">
const props = defineProps<{
  songTitle: string;
  songTitleNative: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  box?: number;
  streak?: number;
  blurred?: boolean;
  ambient?: boolean;
  hideToggles?: boolean;
  immersive?: boolean;
}>();

const BOX_1_STREAK_REQUIRED = 3;

const showEn = ref(true);
const showRomaji = ref(true);
const showJapanese = ref(true);
const showFurigana = ref(true);

const animeJpHtml = ref(props.animeTitleNative);
const songJpHtml = ref(props.songTitleNative);
let lastFetchedKey: string | null = null;

async function resolveJapaneseText() {
  const animeText = props.animeTitleNative;
  const songText = props.songTitleNative;
  const key = `${animeText}|||${songText}|||${showFurigana.value}`;
  if (lastFetchedKey === key) return;

  if (!showFurigana.value) {
    animeJpHtml.value = animeText;
    songJpHtml.value = songText;
    lastFetchedKey = key;
    return;
  }

  animeJpHtml.value = animeText;
  songJpHtml.value = songText;
  try {
    const [animeResult, songResult] = await Promise.all([
      $fetch<{ html: string }>("/api/furigana", { query: { text: animeText } }),
      $fetch<{ html: string }>("/api/furigana", { query: { text: songText } }),
    ]);
    if (props.animeTitleNative === animeText && props.songTitleNative === songText) {
      animeJpHtml.value = animeResult.html;
      songJpHtml.value = songResult.html;
      lastFetchedKey = key;
    }
  } catch {
    animeJpHtml.value = animeText;
    songJpHtml.value = songText;
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
    v-if="!(immersive && blurred)"
    class="info-card"
    :class="{ blurred: blurred && !immersive, 'ambient-glass': ambient, overlay: immersive }"
  >
    <div v-if="!hideToggles" class="lang-toggles">
      <button type="button" class="lang-btn" :class="{ on: showEn }" @click="showEn = !showEn">EN</button>
      <button type="button" class="lang-btn" :class="{ on: showRomaji }" @click="showRomaji = !showRomaji">
        Romaji
      </button>
      <button type="button" class="lang-btn" :class="{ on: showJapanese }" @click="showJapanese = !showJapanese">
        Japanese
      </button>
      <button
        type="button"
        class="lang-btn"
        :class="{ on: showFurigana }"
        :disabled="!showJapanese"
        @click="showFurigana = !showFurigana"
      >
        Furigana
      </button>
    </div>

    <div class="title-block">
      <span v-if="showEn" class="en">{{ animeTitleEnglish }}</span>
      <span v-if="showRomaji" class="romaji">{{ animeTitleRomaji }}</span>
      <span v-if="showJapanese && animeTitleNative !== animeTitleRomaji" class="jp" v-html="animeJpHtml" />
    </div>

    <div class="song-block">
      <span class="label">Song</span>
      <span class="song-title">{{ songTitle }}</span>
      <span v-if="showJapanese && songTitleNative !== songTitle" class="jp" v-html="songJpHtml" />
    </div>

    <div class="meta-row">
      <div class="artist">
        <span class="label">Artist</span>
        <span class="name">{{ artistName }}</span>
      </div>
      <div v-if="box === 1" class="learning">
        <span class="label">Learning</span>
        <span class="name">{{ streak ?? 0 }}/{{ BOX_1_STREAK_REQUIRED }}</span>
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
.info-card.overlay .title-block,
.info-card.overlay .song-block,
.info-card.overlay .meta-row {
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  backdrop-filter: blur(10px) saturate(1.3);
  padding: clamp(8px, 0.83cqw, 19px) clamp(10px, 1.1cqw, 26px);
}

.info-card.overlay .meta-row {
  padding-top: clamp(8px, 0.83cqw, 19px);
}

.info-card.overlay :is(.en, .romaji, .jp, .song-title, .label, .name) {
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

.info-card.overlay .song-title {
  font-size: clamp(12px, 1.24cqw, 29px);
}

.info-card.overlay .meta-row .artist .name,
.info-card.overlay .meta-row .learning .name {
  font-size: clamp(12px, 1.24cqw, 29px);
}

.info-card.overlay .lang-toggles {
  gap: clamp(6px, 0.69cqw, 16px);
}

.info-card.overlay .lang-btn {
  padding: clamp(6px, 0.62cqw, 14px) clamp(8px, 1.1cqw, 26px);
  font-size: clamp(10px, 0.9cqw, 21px);
}

.lang-toggles {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.lang-btn {
  padding: 9px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
}

.lang-btn.on {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
  box-shadow: 0 0 14px var(--accent-secondary-glow);
}

.lang-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-block .en {
  font-size: 27px;
  font-weight: 800;
}

.title-block .romaji {
  font-size: 16px;
  color: var(--muted);
  font-weight: 600;
}

.jp {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-secondary);
}

.jp :deep(rt) {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}

.label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.song-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-title {
  font-size: 18px;
  font-weight: 700;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.meta-row .artist {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-row .artist .name {
  font-size: 18px;
  font-weight: 700;
}

.meta-row .learning {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.meta-row .learning .name {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-secondary);
}
</style>
