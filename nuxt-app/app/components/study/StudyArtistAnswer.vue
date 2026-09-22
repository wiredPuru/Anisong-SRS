<script setup lang="ts">
// Only shown when the deck grades the artist (feature 72). Free text with no
// suggestions: the answer is matched against the one stored artist name.
// `primary` is a deck grading the artist alone, where this box owns the
// round's Submit / Give up and playback kick-off, as StudySongAnswer's does.
const props = defineProps<{
  disabled: boolean;
  primary?: boolean;
}>();
const emit = defineEmits<{ "update:answer": [string | null]; answer: []; giveUp: []; typingStarted: [] }>();
const query = ref("");
const input = ref<HTMLInputElement | null>(null);
const playbackRequested = ref(false);
const composing = ref(false);
const listId = useId();

function requestPlayback() {
  if (!props.primary || playbackRequested.value) return;
  playbackRequested.value = true;
  emit("typingStarted");
}

function onInput() {
  emit("update:answer", query.value.trim() || null);
  if (query.value.trim()) requestPlayback();
}

// Outside primary mode Enter never submits: the main answer box owns
// Submit/Give up.
function onKeydown(event: KeyboardEvent) {
  if (shouldIgnoreAnswerKey(props.disabled, event.isComposing, composing.value, event.repeat)) return;
  if (props.primary && event.key === " " && !query.value) {
    event.preventDefault();
    requestPlayback();
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (props.primary && query.value.trim()) emit("answer");
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
      autocomplete="off"
      :disabled="disabled"
      :placeholder="primary ? 'Type the artist' : 'Name the artist (required)'"
      @input="onInput"
      @keydown.stop="onKeydown"
      @compositionstart="composing = true"
      @compositionend="composing = false"
    />
    <p v-if="primary" class="answer-status">Start typing or press Space to play. Press Enter to submit, or give up.</p>
    <div v-if="primary" class="primary-actions">
      <button v-if="query.trim()" type="button" :disabled="disabled" @click="emit('answer')">Submit answer</button>
      <button type="button" :disabled="disabled" @click="emit('giveUp')">Give up</button>
    </div>
  </div>
</template>

<style scoped>
/* Matches StudySongAnswer's secondary row so the stacked answers line up. */
.artist-answer {
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

.answer-status { margin: 0; font-size: 12px; color: var(--muted); }

/* Same shape as StudySongAnswer's primary box: the round's only answer. */
.artist-answer.primary {
  flex-wrap: wrap;
  padding: 12px;
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
}

.artist-answer.primary input { flex-basis: 60%; padding: 10px; font-size: 15px; }
.artist-answer.primary .answer-status { flex-basis: 100%; order: 3; }

.primary-actions { display: flex; gap: 8px; }

.primary-actions button {
  font: inherit;
  padding: 10px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.primary-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
