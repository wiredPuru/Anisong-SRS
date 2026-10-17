<script setup lang="ts">
import {
  formatKunReading,
  formatRtkFrame,
  formatStrokes,
  hasKanji,
  JAPANESE_SCRIPT_LABELS,
  JAPANESE_SCRIPT_STORAGE_KEY,
  JAPANESE_SCRIPTS,
  parseScript,
  titleSections,
  type JapaneseScript,
} from "~/utils/japaneseBreakdown";

// Mirrors KanjiEntry in server/utils/kanjiData.ts; keep the fields in the same order.
interface KanjiEntry {
  char: string;
  keyword: string;
  alternates: string[];
  parts: string[];
  on: string[];
  kun: string[];
  strokes: number;
  grade: number | null;
  jlpt: number | null;
  freq: number | null;
  rtk: number | null;
}

interface KanjiReply {
  kanji: KanjiEntry[];
  unknown: string[];
}

const props = defineProps<{
  animeTitleNative: string;
  songTitleNative: string;
  // The titles are the answer: blurred and inert while it is still a secret.
  blurred?: boolean;
}>();

const sections = computed(() => titleSections(props.animeTitleNative, props.songTitleNative));
const script = ref<JapaneseScript>("normal");
const kanjiByTitle = ref<Record<string, KanjiReply>>({});
const shownText = ref<Record<string, string>>({});
const loading = ref(false);
const error = ref<string | null>(null);
const requests = createLatestRequest();

onMounted(() => {
  try {
    script.value = parseScript(localStorage.getItem(JAPANESE_SCRIPT_STORAGE_KEY));
  } catch {
    script.value = "normal";
  }
});

function chooseScript(next: JapaneseScript) {
  script.value = next;
  try {
    localStorage.setItem(JAPANESE_SCRIPT_STORAGE_KEY, next);
  } catch {
    // Not remembered without storage; the choice still holds for this card.
  }
}

async function convert(text: string, to: JapaneseScript): Promise<string> {
  if (to === "normal") return text;
  return (await $fetch<{ text: string }>("/api/japanese-script", { query: { text, to } })).text;
}

async function load() {
  const isCurrent = requests.start();
  loading.value = true;
  error.value = null;
  try {
    const texts = sections.value.map((section) => section.text);
    const [kanji, converted] = await Promise.all([
      Promise.all(texts.map((text) => (hasKanji(text)
        ? $fetch<KanjiReply>("/api/kanji", { query: { text } })
        : Promise.resolve<KanjiReply>({ kanji: [], unknown: [] })))),
      Promise.all(texts.map((text) => convert(text, script.value))),
    ]);
    if (!isCurrent()) return;
    kanjiByTitle.value = Object.fromEntries(texts.map((text, index) => [text, kanji[index]!]));
    shownText.value = Object.fromEntries(texts.map((text, index) => [text, converted[index]!]));
  } catch (failure) {
    if (isCurrent()) error.value = extractErrorMessage(failure, "Couldn't load the breakdown. Try again.");
  } finally {
    if (isCurrent()) loading.value = false;
  }
}

watch(() => [props.animeTitleNative, props.songTitleNative, script.value], load, { immediate: true });
onScopeDispose(requests.invalidate);

function rowsFor(text: string): KanjiReply {
  return kanjiByTitle.value[text] ?? { kanji: [], unknown: [] };
}
</script>

<template>
  <div class="jb" :class="{ blurred }" :inert="blurred">
    <div class="jb-head">
      <h2 class="jb-heading">Japanese breakdown</h2>
      <div class="jb-switch" role="group" aria-label="Title script">
        <button
          v-for="option in JAPANESE_SCRIPTS"
          :key="option"
          type="button"
          class="jb-switch-btn"
          :class="{ active: script === option }"
          :aria-pressed="script === option"
          @click="chooseScript(option)"
        >
          {{ JAPANESE_SCRIPT_LABELS[option] }}
        </button>
      </div>
    </div>

    <p v-if="error" class="jb-note jb-error" role="alert">
      {{ error }} <button type="button" class="jb-retry" @click="load">Try again</button>
    </p>
    <p v-else-if="!sections.length" class="jb-note">This card has no Japanese title.</p>

    <section v-for="section in sections" :key="section.key" class="jb-section">
      <h3 class="jb-label">{{ section.label }}</h3>
      <p class="jb-title" lang="ja">{{ shownText[section.text] ?? section.text }}</p>
      <p v-if="loading && !kanjiByTitle[section.text]" class="jb-note">Loading...</p>
      <p v-else-if="kanjiByTitle[section.text] && !hasKanji(section.text)" class="jb-note">No kanji in this title.</p>
      <ul v-else class="jb-grid">
        <li v-for="entry in rowsFor(section.text).kanji" :key="entry.char" class="jb-tile">
          <span class="jb-char" lang="ja">{{ entry.char }}</span>
          <div class="jb-body">
            <p class="jb-keyword">
              {{ entry.keyword || "(no English meaning)" }}
              <span v-if="entry.alternates.length" class="jb-alt">{{ entry.alternates.join(", ") }}</span>
            </p>
            <p v-if="entry.parts.length" class="jb-parts" aria-label="Components">
              <span v-for="part in entry.parts" :key="part" class="jb-part" lang="ja">{{ part }}</span>
            </p>
            <p v-if="entry.on.length || entry.kun.length" class="jb-readings" lang="ja">
              <span v-if="entry.on.length">{{ entry.on.join("、") }}</span>
              <span v-if="entry.kun.length">{{ entry.kun.map(formatKunReading).join("、") }}</span>
            </p>
            <p class="jb-meta">
              {{ formatStrokes(entry.strokes) }}
              <template v-if="formatRtkFrame(entry.rtk)"> &middot; {{ formatRtkFrame(entry.rtk) }}</template>
            </p>
          </div>
        </li>
        <li v-for="char in rowsFor(section.text).unknown" :key="`unknown-${char}`" class="jb-tile jb-unknown">
          <span class="jb-char" lang="ja">{{ char }}</span>
          <p class="jb-note">Not in the kanji dictionary.</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.jb {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: var(--text);
}

.jb.blurred {
  filter: blur(14px);
  user-select: none;
  pointer-events: none;
}

.jb-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.jb-heading {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.jb-switch {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.jb-switch-btn {
  padding: 5px 12px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font: 600 13px var(--font-sans);
  cursor: pointer;
}

.jb-switch-btn.active {
  background: var(--accent);
  color: var(--accent-ink);
}

.jb-label {
  margin: 0 0 4px;
  color: var(--faint);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.jb-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.jb-note {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.jb-error {
  color: var(--fail);
}

.jb-retry {
  margin-left: 6px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.jb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.jb-tile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
}

.jb-char {
  flex: none;
  font-size: 44px;
  line-height: 1;
}

.jb-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.jb-body p {
  margin: 0;
}

.jb-keyword {
  font-size: 15px;
  font-weight: 700;
  text-transform: capitalize;
}

.jb-alt {
  margin-left: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
}

.jb-parts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.jb-part {
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  font-size: 14px;
}

.jb-readings {
  display: flex;
  flex-direction: column;
  color: var(--muted);
  font-size: 13px;
}

.jb-meta {
  color: var(--faint);
  font-size: 12px;
}

.jb-unknown {
  align-items: center;
}
</style>
