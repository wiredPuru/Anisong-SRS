<script setup lang="ts">
import type { ArtistAnswerOption } from "~/composables/useArtistAnswerSearch";

// Only shown when the deck grades the artist (feature 72). Suggestions only
// fill the field; the typed text is still what gets matched against the one
// stored artist name. `primary` is a deck grading the artist alone, where this
// box owns the round's Submit / Give up and playback kick-off, as
// StudySongAnswer's does.
const props = defineProps<{
  disabled: boolean;
  primary?: boolean;
}>();
const emit = defineEmits<{ "update:answer": [string | null]; answer: []; giveUp: []; typingStarted: []; submitRound: [] }>();
const query = ref("");
const input = ref<HTMLInputElement | null>(null);
const playbackRequested = ref(false);
const open = ref(false);
const active = ref(-1);
const composing = ref(false);
const listId = useId();
const { results, loading, error, update, reset } = useArtistAnswerSearch();

const status = computed(() => {
  if (loading.value) return "Searching artists...";
  if (error.value) return error.value;
  if (open.value && query.value.trim().length >= 2 && !results.value.length) return "No artist found. Your typed answer still counts.";
  if (props.primary) return "Start typing or press Space to play. Press Enter to submit, or the right arrow to give up.";
  return "";
});

function publish() {
  emit("update:answer", query.value.trim() || null);
}

function requestPlayback() {
  if (!props.primary || playbackRequested.value) return;
  playbackRequested.value = true;
  emit("typingStarted");
}

function search() {
  active.value = -1;
  open.value = true;
  publish();
  if (query.value.trim()) requestPlayback();
  if (!composing.value) update(query.value);
}

function choose(option: ArtistAnswerOption) {
  query.value = option.artistName;
  open.value = false;
  active.value = -1;
  reset();
  publish();
}

// A highlighted suggestion takes Enter first. Otherwise, outside primary mode,
// Enter submits the whole round as it stands, like StudySongAnswer.
function onKeydown(event: KeyboardEvent) {
  if (shouldIgnoreAnswerKey(props.disabled, event.isComposing, composing.value, event.repeat)) return;
  if (props.primary && event.key === " " && !query.value) {
    event.preventDefault();
    requestPlayback();
    return;
  }
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
    event.preventDefault();
    const option = results.value[active.value];
    if (open.value && option) choose(option);
    else if (props.primary) {
      if (query.value.trim()) emit("answer");
    } else emit("submitRound");
  }
}

function focusIfPrimary() {
  if (props.primary && !props.disabled) nextTick(() => input.value?.focus());
}

watch(() => props.disabled, focusIfPrimary);
onMounted(focusIfPrimary);
</script>

<template>
  <div class="artist-answer" :class="{ primary }">
    <label :for="`${listId}-input`">Artist</label>
    <input
      ref="input"
      :id="`${listId}-input`"
      v-model="query"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="open && results.length > 0"
      :aria-controls="listId"
      :aria-activedescendant="open && active >= 0 ? `${listId}-${active}` : undefined"
      :disabled="disabled"
      :placeholder="primary ? 'Type the artist' : 'Name the artist (required)'"
      @input="search"
      @keydown.stop="onKeydown"
      @compositionstart="composing = true; reset()"
      @compositionend="composing = false; search()"
      @blur="open = false"
      @focus="open = true"
    />
    <ul v-if="open && results.length" :id="listId" role="listbox" aria-label="Artist suggestions">
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
        {{ option.artistName }}
      </li>
    </ul>
    <p v-if="status" class="answer-status" role="status" aria-live="polite">{{ status }}</p>
    <div v-if="primary" class="primary-actions">
      <button
        type="button"
        class="submit-btn"
        :disabled="disabled || !query.trim()"
        @click="emit('answer')"
      >
        Submit answer
      </button>
      <button type="button" :disabled="disabled" @click="emit('giveUp')">Give up</button>
    </div>
  </div>
</template>

<style scoped>
/* Matches StudySongAnswer's secondary row so the stacked answers line up. */
.artist-answer {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-surface-panel);
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

/* Opens upward into free video space, as StudySongAnswer's list does. */
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
  background: #141418;
  box-shadow: var(--shadow-soft);
}

li { padding: 7px 8px; font-size: 13px; cursor: pointer; overflow-wrap: anywhere; }
li:hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface-raised)); }
li.active {
  background: color-mix(in srgb, var(--accent) 28%, var(--surface-raised));
  box-shadow: inset 3px 0 0 var(--accent);
  color: var(--text);
  font-weight: 700;
}

/* Out of the flow: a status line that appears while typing must not resize the
   answer bar, and with it the video above. It sits inside the input's right edge. */
.answer-status {
  position: absolute;
  top: 50%;
  right: 18px;
  transform: translateY(-50%);
  margin: 0;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  font-size: 11px;
  color: var(--muted);
  pointer-events: none;
}

/* The round's only answer: the input gets a full-width row, and the hint and
   the buttons share a fixed-height row under it. Nothing in either row appears
   or disappears while typing, because this bar sizes the video above it and
   any height change would move the input under the cursor. */
.artist-answer.primary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "label input input"
    "status status actions";
  align-items: center;
  gap: 10px 12px;
  padding: 14px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
}

.artist-answer.primary label { grid-area: label; }
.artist-answer.primary input { grid-area: input; padding: 10px 12px; font-size: 15px; }
.artist-answer.primary .primary-actions { grid-area: actions; }

.artist-answer.primary .answer-status {
  grid-area: status;
  position: static;
  padding: 0;
  transform: none;
  background: none;
  font-size: 12px;
  /* Two lines whatever the hint says, so a short "Searching..." and the long
     how-to hint take the same room. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.4;
  height: calc(2 * 1.4em);
  overflow: hidden;
}

.primary-actions { display: flex; gap: 8px; }

.primary-actions button {
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  padding: 8px 16px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  white-space: nowrap;
  cursor: pointer;
}

.primary-actions .submit-btn {
  color: var(--accent-ink);
  background: var(--accent);
  border-color: var(--accent);
}

.primary-actions button:disabled { opacity: 0.4; cursor: not-allowed; }

/* Same narrow-layout fix as StudySongAnswer: the stack is pinned to the top of
   the clipped player frame, so an upward list would be hidden. */
@media (max-width: 600px) {
  .artist-answer.primary ul {
    top: 48px;
    bottom: auto;
    max-height: min(46px, 9vh);
  }
}
</style>
