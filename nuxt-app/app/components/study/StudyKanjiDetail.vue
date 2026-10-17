<script setup lang="ts">
import {
  formatKunReading,
  formatRtkFrame,
  formatStrokes,
  type KanjiEntry,
  MAX_KANJI_STORY_LENGTH,
  storyDraftState,
} from "~/utils/japaneseBreakdown";

const props = defineProps<{
  char: string;
  // How many characters were opened before this one; Back shows only past the first.
  depth: number;
  storyChars: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  open: [char: string];
  back: [];
  storyChanged: [char: string, hasStory: boolean];
}>();

const kanjiDeck = useKanjiDeck();
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

const savedStory = ref<string | null>(null);
const draft = ref("");
const storyLoading = ref(false);
const storySaving = ref(false);
const storyError = ref<string | null>(null);
const justSaved = ref(false);
const storyRequests = createLatestRequest();
const draftState = computed(() => storyDraftState(savedStory.value, draft.value));

async function loadStory() {
  const isCurrent = storyRequests.start();
  storyLoading.value = true;
  storyError.value = null;
  justSaved.value = false;
  savedStory.value = null;
  draft.value = "";
  try {
    const reply = await $fetch<{ char: string; text: string | null }>("/api/kanji/story", {
      query: { char: props.char },
    });
    if (!isCurrent()) return;
    savedStory.value = reply.text;
    draft.value = reply.text ?? "";
  } catch (failure) {
    if (isCurrent()) storyError.value = extractErrorMessage(failure, "Couldn't load your story. Try again.");
  } finally {
    if (isCurrent()) storyLoading.value = false;
  }
}

async function saveStory() {
  if (!draftState.value.canSave || storySaving.value) return;
  const char = props.char;
  storySaving.value = true;
  storyError.value = null;
  try {
    const reply = await $fetch<{ char: string; text: string }>("/api/kanji/story", {
      method: "PUT",
      body: { char, text: draft.value },
    });
    if (props.char !== char) return;
    savedStory.value = reply.text;
    draft.value = reply.text;
    justSaved.value = true;
    emit("storyChanged", char, true);
  } catch (failure) {
    if (props.char === char) storyError.value = extractErrorMessage(failure, "Couldn't save your story. Try again.");
  } finally {
    storySaving.value = false;
  }
}

async function removeStory() {
  if (savedStory.value === null || storySaving.value) return;
  const char = props.char;
  storySaving.value = true;
  storyError.value = null;
  try {
    await $fetch("/api/kanji/story", { method: "DELETE", body: { char } });
    if (props.char !== char) return;
    savedStory.value = null;
    draft.value = "";
    justSaved.value = false;
    emit("storyChanged", char, false);
  } catch (failure) {
    if (props.char === char) storyError.value = extractErrorMessage(failure, "Couldn't remove your story. Try again.");
  } finally {
    storySaving.value = false;
  }
}

function partLabel(part: string): string | undefined {
  const notes = [props.storyChars.has(part) && "has your story", kanjiDeck.chars.value.has(part) && "in Kanji Study"].filter(Boolean);
  return notes.length ? `${part} (${notes.join(", ")})` : undefined;
}

watch(() => props.char, () => {
  load();
  loadStory();
}, { immediate: true });
onScopeDispose(() => {
  requests.invalidate();
  storyRequests.invalidate();
});
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
          <StudyKanjiDeckButton :char="char" />
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
          :class="{ 'has-story': storyChars.has(part), 'in-deck': kanjiDeck.chars.value.has(part) }"
          :aria-label="partLabel(part)"
          lang="ja"
          @click="emit('open', part)"
        >
          {{ part }}
        </button>
      </p>
    </div>
    <p v-else-if="entry" class="kd-note">This character has no smaller parts.</p>

    <div class="kd-story">
      <label class="kd-label" for="kd-story-input">Your story</label>
      <textarea
        id="kd-story-input"
        v-model="draft"
        class="kd-story-input"
        rows="4"
        :disabled="storyLoading"
        placeholder="Write a vivid mnemonic that ties the keyword to the parts."
        @input="justSaved = false"
      />
      <div class="kd-story-actions">
        <button type="button" class="kd-save" :disabled="!draftState.canSave || storySaving" @click="saveStory">
          {{ storySaving ? "Saving..." : "Save story" }}
        </button>
        <button
          v-if="savedStory !== null"
          type="button"
          class="kd-remove"
          :disabled="storySaving"
          @click="removeStory"
        >
          Remove
        </button>
        <span v-if="justSaved" class="kd-saved" role="status">Saved</span>
        <span v-if="draftState.tooLong" class="kd-error">
          Too long (max {{ MAX_KANJI_STORY_LENGTH }} characters).
        </span>
      </div>
      <p v-if="storyError" class="kd-note kd-error" role="alert">{{ storyError }}</p>
    </div>
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

.kd-part.has-story {
  position: relative;
}

.kd-part.has-story::after {
  content: "";
  position: absolute;
  top: 2px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.kd-part.in-deck {
  border-color: var(--pass);
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

.kd-story {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kd-story .kd-label {
  margin: 0;
}

.kd-story-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font: 14px/1.5 var(--font-sans);
  resize: vertical;
}

.kd-story-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.kd-save {
  padding: 5px 14px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font: 700 13px var(--font-sans);
  cursor: pointer;
}

.kd-remove {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font: 600 13px var(--font-sans);
  cursor: pointer;
}

.kd-save:disabled,
.kd-remove:disabled {
  opacity: 0.5;
  cursor: default;
}

.kd-saved {
  color: var(--pass);
  font-weight: 700;
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
