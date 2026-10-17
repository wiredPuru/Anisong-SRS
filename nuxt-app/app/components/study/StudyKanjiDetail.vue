<script setup lang="ts">
import {
  formatKunReading,
  formatRtkFrame,
  formatStrokes,
  type KanjiEntry,
} from "~/utils/japaneseBreakdown";

const props = defineProps<{
  char: string;
  // How many characters were opened before this one; Back shows only past the first.
  depth: number;
}>();

const emit = defineEmits<{
  open: [char: string];
  back: [];
}>();

const entry = ref<KanjiEntry | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const requests = createLatestRequest();

async function load() {
  const isCurrent = requests.start();
  loading.value = true;
  error.value = null;
  entry.value = null;
  try {
    const reply = await $fetch<{ kanji: KanjiEntry[]; unknown: string[] }>("/api/kanji", {
      query: { text: props.char },
    });
    if (isCurrent()) entry.value = reply.kanji[0] ?? null;
  } catch (failure) {
    if (isCurrent()) error.value = extractErrorMessage(failure, "Couldn't load this character. Try again.");
  } finally {
    if (isCurrent()) loading.value = false;
  }
}

// KRADFILE lists a primitive as its own part (鬼 is 鬼 田 儿 ヒ ム); drilling into itself would go nowhere.
const parts = computed(() => entry.value?.parts.filter((part) => part !== props.char) ?? []);

watch(() => props.char, load, { immediate: true });
onScopeDispose(requests.invalidate);
</script>

<template>
  <div class="kd">
    <button type="button" class="kd-back" @click="emit('back')">
      &larr; {{ depth > 1 ? "Back" : "Back to titles" }}
    </button>

    <div class="kd-main">
      <span class="kd-char" lang="ja">{{ char }}</span>
      <div class="kd-body">
        <p v-if="loading" class="kd-note">Loading...</p>
        <p v-else-if="error" class="kd-note kd-error" role="alert">
          {{ error }} <button type="button" class="kd-retry" @click="load">Try again</button>
        </p>
        <p v-else-if="!entry" class="kd-note">
          No dictionary entry. This is a bare stroke shape used to build other characters.
        </p>
        <template v-else>
          <p class="kd-keyword">
            {{ entry.keyword || "(no English meaning)" }}
            <span v-if="entry.alternates.length" class="kd-alt">{{ entry.alternates.join(", ") }}</span>
          </p>
          <p v-if="entry.on.length || entry.kun.length" class="kd-readings" lang="ja">
            <span v-if="entry.on.length">{{ entry.on.join("、") }}</span>
            <span v-if="entry.kun.length">{{ entry.kun.map(formatKunReading).join("、") }}</span>
          </p>
          <p class="kd-meta">
            {{ formatStrokes(entry.strokes) }}
            <template v-if="formatRtkFrame(entry.rtk)"> &middot; {{ formatRtkFrame(entry.rtk) }}</template>
          </p>
        </template>
      </div>
    </div>

    <div v-if="parts.length" class="kd-parts">
      <h3 class="kd-label">Parts</h3>
      <p class="kd-part-row">
        <button
          v-for="part in parts"
          :key="part"
          type="button"
          class="kd-part"
          lang="ja"
          @click="emit('open', part)"
        >
          {{ part }}
        </button>
      </p>
    </div>
    <p v-else-if="entry" class="kd-note">This character has no smaller parts.</p>
  </div>
</template>

<style scoped>
.kd {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.kd-back {
  align-self: flex-start;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font: 600 13px var(--font-sans);
  cursor: pointer;
}

.kd-main {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.kd-char {
  flex: none;
  font-size: 96px;
  line-height: 1;
}

.kd-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kd-body p {
  margin: 0;
}

.kd-keyword {
  font-size: 22px;
  font-weight: 700;
  text-transform: capitalize;
}

.kd-alt {
  margin-left: 8px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  text-transform: none;
}

.kd-readings {
  display: flex;
  flex-direction: column;
  color: var(--muted);
  font-size: 15px;
}

.kd-meta {
  color: var(--faint);
  font-size: 13px;
}

.kd-label {
  margin: 0 0 6px;
  color: var(--faint);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.kd-part-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}

.kd-part {
  padding: 4px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-size: 26px;
  cursor: pointer;
}

.kd-part:hover {
  border-color: var(--accent);
}

.kd-note {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.kd-error {
  color: var(--fail);
}

.kd-retry {
  margin-left: 6px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
</style>
