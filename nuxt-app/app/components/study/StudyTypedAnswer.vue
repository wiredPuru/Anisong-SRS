<script setup lang="ts">
import type { AnimeAnswerOption } from "~/composables/useAnimeAnswerSearch";

const props = defineProps<{
  presentationKey: number;
  contextKey: string;
  disabled: boolean;
  available: boolean;
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

function search() {
  selected.value = null;
  active.value = -1;
  open.value = true;
  if (!playbackRequested.value && query.value.trim()) {
    playbackRequested.value = true;
    emit("typingStarted");
  }
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
  <div class="typed-answer">
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
    <p role="status" aria-live="polite">
      <template v-if="loading">Searching anime...</template>
      <template v-else-if="error">{{ error }}</template>
      <template v-else-if="selected">Selected: {{ label(selected) }}</template>
      <template v-else-if="open && query.trim().length >= 2 && !results.length">No anime found.</template>
      <template v-else>Use arrow keys and Enter to select an anime.</template>
    </p>
    <p v-if="!available">This card has no valid anime identity. Turn Typed Answers off to review it manually.</p>
    <button type="button" :disabled="disabled || !available || !selected" @click="selected && emit('answer', selected)">Submit answer</button>
    <button type="button" :disabled="disabled || !available" @click="emit('giveUp')">Give up</button>
  </div>
</template>

<style scoped>
.typed-answer { display: grid; gap: 8px; min-width: 0; }
input, button { font: inherit; padding: 10px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
ul { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); }
li { padding: 8px; cursor: pointer; overflow-wrap: anywhere; }
li.active, li:hover { background: var(--surface-raised); color: var(--accent); }
small { display: block; color: var(--muted); }
p { margin: 0; font-size: 12px; color: var(--muted); }
button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
