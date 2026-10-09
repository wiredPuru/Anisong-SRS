<script setup lang="ts">
import type { AnimeAnswerOption } from "~/composables/useAnimeAnswerSearch";

const props = defineProps<{
  presentationKey: number;
  contextKey: string;
  disabled: boolean;
  available: boolean;
  overlay?: boolean;
}>();
const emit = defineEmits<{ answer: [selection: AnimeAnswerOption]; giveUp: []; typingStarted: [] }>();
const query = ref("");
const selected = ref<AnimeAnswerOption | null>(null);
const open = ref(false);
const active = ref(-1);
const composing = ref(false);
const playbackRequested = ref(false);
const input = ref<HTMLInputElement | null>(null);
const listId = useId();
const { results, loading, error, update, reset } = useAnimeAnswerSearch();

function label(option: AnimeAnswerOption) {
  return option.titleEnglish || option.titleRomaji || option.titleNative || String(option.aniListId);
}

function titles(option: AnimeAnswerOption) {
  return [...new Set([option.titleRomaji, option.titleNative].filter((title) => title && title !== label(option)))].join(" / ");
}

function requestPlayback() {
  if (playbackRequested.value) return;
  playbackRequested.value = true;
  emit("typingStarted");
}

function search() {
  selected.value = null;
  active.value = -1;
  open.value = true;
  if (query.value.trim()) requestPlayback();
  if (!composing.value) update(query.value);
}

function choose(option: AnimeAnswerOption) {
  selected.value = option;
  query.value = label(option);
  open.value = false;
  active.value = -1;
  reset();
}

function onKeydown(event: KeyboardEvent) {
  if (shouldIgnoreAnswerKey(props.disabled, event.isComposing, composing.value, event.repeat)) return;
  if (event.key === " " && !query.value && props.available) {
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
    else if (selected.value && props.available) emit("answer", selected.value);
    else if (query.value.trim() && props.available) emit("giveUp");
  }
}

function clearAnswer() {
  query.value = "";
  selected.value = null;
  open.value = false;
  active.value = -1;
  reset();
  if (!props.disabled && props.available) nextTick(() => input.value?.focus());
}

// Auto Reveal's timeout submits the round as it stands: the picked suggestion
// if there is one, otherwise a blank answer, even with unpicked text typed.
function submitCurrent() {
  if (selected.value && props.available) emit("answer", selected.value);
  else emit("giveUp");
}
defineExpose({ submitCurrent });

watch(() => [props.presentationKey, props.contextKey], ([presentationKey], [previousPresentationKey]) => {
  if (presentationKey !== previousPresentationKey) playbackRequested.value = false;
  clearAnswer();
});
watch(() => [props.disabled, props.available], ([disabled, available]) => {
  if (!disabled && available) nextTick(() => input.value?.focus());
});
onMounted(() => {
  if (!props.disabled && props.available) input.value?.focus();
});
</script>

<template>
  <div class="typed-answer" :class="{ overlay, 'has-selection': selected }">
    <label :for="`${listId}-input`">Anime title</label>
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
      placeholder="Type at least two characters"
      @input="search"
      @keydown.stop="onKeydown"
      @compositionstart="composing = true; reset()"
      @compositionend="composing = false; search()"
      @blur="open = false"
      @focus="open = true"
    />
    <ul v-if="open && results.length" :id="listId" role="listbox" aria-label="Anime suggestions">
      <li
        v-for="(option, index) in results"
        :id="`${listId}-${index}`"
        :key="option.aniListId"
        role="option"
        :aria-selected="active === index"
        :class="{ active: active === index }"
        @mousedown.prevent
        @click="choose(option)"
      >
        <span>{{ label(option) }}</span>
        <small v-if="titles(option)">{{ titles(option) }}</small>
      </li>
    </ul>
    <p class="answer-status" role="status" aria-live="polite">
      <template v-if="loading">Searching anime...</template>
      <template v-else-if="error">{{ error }}</template>
      <template v-else-if="selected">Selected: {{ label(selected) }}</template>
      <template v-else-if="open && query.trim().length >= 2 && !results.length">No anime found.</template>
      <template v-else>Start typing or press Space to play. Select a match, or press Enter to give up.</template>
    </p>
    <p v-if="!available" class="answer-unavailable">This card has no valid anime identity. Turn Typed Answers off to review it manually.</p>
    <button v-if="selected" class="submit-btn" type="button" :disabled="disabled || !available" @click="emit('answer', selected)">Submit answer</button>
    <button class="give-up-btn" type="button" :disabled="disabled || !available" @click="emit('giveUp')">Give up</button>
  </div>
</template>

<style scoped>
.typed-answer { display: grid; gap: 8px; min-width: 0; }
input, button { font: inherit; padding: 10px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
ul { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
li { padding: 8px; cursor: pointer; overflow-wrap: anywhere; }
li:hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface-raised)); }
li.active {
  background: color-mix(in srgb, var(--accent) 28%, var(--surface-raised));
  box-shadow: inset 3px 0 0 var(--accent);
  color: var(--text);
  font-weight: 700;
}
small { display: block; color: var(--muted); }
p { margin: 0; font-size: 12px; color: var(--muted); }
button:disabled { opacity: 0.6; cursor: not-allowed; }

/* Inside Study's Now playing bar: the input, then Guess and Give up on one
   row, with the status line quiet underneath. Suggestions open upward, over
   the picture, since the bar sits at the bottom of the screen. */
.typed-answer.overlay {
  position: relative;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 10px;
}

.overlay input {
  height: 52px;
  padding: 0 18px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  font-size: 17px;
  font-weight: 600;
}

.overlay input:focus,
.overlay input:focus-visible {
  outline: none;
  border-color: #ffffff;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
}

.overlay ul {
  padding: 6px;
  border-radius: 14px;
  border-color: var(--border);
  background: #141418;
}

.overlay li {
  padding: 9px 12px;
  border-radius: 10px;
}

.overlay li:hover {
  background: color-mix(in srgb, var(--accent) 16%, #141418);
}

.overlay li.active {
  background: color-mix(in srgb, var(--accent) 30%, #141418);
  color: var(--text);
}

.overlay label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.overlay button {
  height: 52px;
  padding: 0 22px;
  border-radius: var(--radius-pill);
  font-weight: 700;
  white-space: nowrap;
}

.overlay .submit-btn {
  border: 0;
  background: #ffffff;
  color: #0b0b0d;
}

.overlay .give-up-btn {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
}

.overlay input { grid-column: 1; grid-row: 1; min-width: 0; }
.typed-answer.overlay.has-selection { grid-template-columns: minmax(0, 1fr) auto auto; }
.overlay .submit-btn { grid-column: 2; grid-row: 1; }
.overlay .give-up-btn { grid-column: 2; grid-row: 1; }
.overlay.has-selection .give-up-btn { grid-column: 3; }
.overlay .answer-status { grid-column: 1 / -1; grid-row: 2; padding-left: 4px; color: var(--faint); }
.overlay .answer-unavailable { grid-column: 1 / -1; grid-row: 3; }

.overlay ul {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: min(100%, 560px);
  z-index: 20;
  max-height: min(280px, 46vh);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
}

@media (max-width: 600px) {
  .typed-answer.overlay {
    padding: 8px;
    gap: 6px;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .overlay button {
    padding: 8px;
    font-size: 12px;
  }

  .overlay .answer-status,
  .overlay .answer-unavailable {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .overlay ul {
    max-height: 46px;
  }
}
</style>
