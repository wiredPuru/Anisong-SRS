<script setup lang="ts">
import type { SongAnswerOption } from "~/composables/useSongAnswerSearch";

const props = defineProps<{
  disabled: boolean;
}>();
const emit = defineEmits<{ "update:answer": [string | null] }>();
const query = ref("");
const open = ref(false);
const active = ref(-1);
const composing = ref(false);
const listId = useId();
const { results, loading, error, update, reset } = useSongAnswerSearch();

function publish() {
  emit("update:answer", query.value.trim() || null);
}

function search() {
  active.value = -1;
  open.value = true;
  publish();
  if (!composing.value) update(query.value);
}

function choose(option: SongAnswerOption) {
  query.value = option.songTitle;
  open.value = false;
  active.value = -1;
  reset();
  publish();
}

function onKeydown(event: KeyboardEvent) {
  if (shouldIgnoreAnswerKey(props.disabled, event.isComposing, composing.value, event.repeat)) return;
  if (event.key === "Escape") { open.value = false; return; }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!results.value.length) return;
    open.value = true;
    active.value = active.value < 0
      ? (event.key === "ArrowDown" ? 0 : results.value.length - 1)
      : (active.value + (event.key === "ArrowDown" ? 1 : -1) + results.value.length) % results.value.length;
    nextTick(() => document.getElementById(`${listId}-${active.value}`)?.scrollIntoView({ block: "nearest" }));
  } else if (event.key === "Enter") {
    // Never submits the round - the anime box owns Submit/Give up. Here Enter
    // only takes the highlighted suggestion, so a player reaching for it mid
    // song-guess cannot accidentally answer the anime question.
    event.preventDefault();
    const option = results.value[active.value];
    if (open.value && option) choose(option);
  }
}
</script>

<template>
  <div class="song-answer">
    <label :for="`${listId}-input`">Song name</label>
    <input
      :id="`${listId}-input`"
      v-model="query"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="open && results.length > 0"
      :aria-controls="listId"
      :aria-activedescendant="open && active >= 0 ? `${listId}-${active}` : undefined"
      :disabled="disabled"
      placeholder="Name the song for bonus points"
      @input="search"
      @keydown.stop="onKeydown"
      @compositionstart="composing = true; reset()"
      @compositionend="composing = false; search()"
      @blur="open = false"
      @focus="open = true"
    />
    <ul v-if="open && results.length" :id="listId" role="listbox" aria-label="Song suggestions">
      <li
        v-for="(option, index) in results"
        :id="`${listId}-${index}`"
        :key="option.key"
        role="option"
        :aria-selected="active === index"
        :class="{ active: active === index }"
        @mousedown.prevent
        @click="choose(option)"
      >
        <span>{{ option.songTitle }}</span>
        <small v-if="option.artistName">{{ option.artistName }}</small>
      </li>
    </ul>
    <p class="answer-status" role="status" aria-live="polite">
      <template v-if="loading">Searching songs...</template>
      <template v-else-if="error">{{ error }}</template>
      <template v-else-if="open && query.trim().length >= 2 && !results.length">No song found. Your typed answer still counts.</template>
      <template v-else>Optional. Leave it blank to skip this category.</template>
    </p>
  </div>
</template>

<style scoped>
.song-answer {
  position: relative;
  display: grid;
  gap: 6px;
  flex: none;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

label { color: var(--faint); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
input { font: inherit; padding: 10px; color: var(--text); background: var(--surface-raised); border: 1px solid var(--border); border-radius: var(--radius-sm); }
input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input:disabled { opacity: 0.6; cursor: not-allowed; }

ul {
  position: absolute;
  right: 12px;
  left: 12px;
  top: calc(100% - 34px);
  z-index: 5;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

li { padding: 8px; cursor: pointer; overflow-wrap: anywhere; }
li.active, li:hover { background: var(--surface-raised); color: var(--accent); }
small { display: block; color: var(--muted); }
p { margin: 0; font-size: 12px; color: var(--muted); }
</style>
