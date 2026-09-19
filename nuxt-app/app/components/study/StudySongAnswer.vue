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

const status = computed(() => {
  if (loading.value) return "Searching songs...";
  if (error.value) return error.value;
  if (open.value && query.value.trim().length >= 2 && !results.value.length) return "No song found. Your typed answer still counts.";
  return "";
});

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
    <!-- Only rendered when it has something to say: the placeholder already
         covers the idle case, and the overlay has no room for a standing hint. -->
    <p v-if="status" class="answer-status" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<style scoped>
/* Sized down against the anime box it sits under: this is a bonus guess, and
   only the anime title grades the card. */
.song-answer {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
}

label { flex: none; color: var(--faint); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }

input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input:disabled { opacity: 0.6; cursor: not-allowed; }

/* Opens upward into free video space. Downward would land on the playback
   controls the overlay deliberately sits above. */
ul {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 5;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(200px, 34vh);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

li { padding: 7px 8px; font-size: 13px; cursor: pointer; overflow-wrap: anywhere; }
li.active, li:hover { background: var(--surface-raised); color: var(--accent); }
small { display: block; font-size: 11px; color: var(--muted); }

.answer-status { flex: none; margin: 0; font-size: 11px; color: var(--muted); }
</style>
