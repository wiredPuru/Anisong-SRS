<script setup lang="ts">
const props = defineProps<{
  songTitle: string;
  songTitleNative: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  blurred?: boolean;
  ambient?: boolean;
  hideToggles?: boolean;
}>();

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
  <div class="info-card" :class="{ blurred, 'ambient-glass': ambient }">
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
</style>
