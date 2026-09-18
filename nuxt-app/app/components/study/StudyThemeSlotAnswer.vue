<script setup lang="ts">
import type { ThemeSlotSelection, ThemeSlotType } from "~/utils/themeSlotAnswer";

defineProps<{
  disabled: boolean;
}>();
const emit = defineEmits<{ "update:selection": [ThemeSlotSelection | null] }>();

// Local only: the parent's bound selection stays null (skipped) until the
// player actually touches this control, so an untouched bonus category is
// never silently graded as a guess of "OP1". The page keys this component
// on presentationKey, forcing a fresh mount (and fresh local state) every
// card, the same reset guarantee an overlay-slot remount used to give it
// before this moved out of the player frame - see the placement note below.
const type = ref<ThemeSlotType>("OP");
const number = ref(1);
const touched = ref(false);

function emitSelection() {
  touched.value = true;
  emit("update:selection", { type: type.value, number: number.value });
}

function chooseType(next: ThemeSlotType) {
  type.value = next;
  emitSelection();
}

function onNumberInput(event: Event) {
  const raw = Number((event.target as HTMLInputElement).value);
  if (!Number.isInteger(raw)) return;
  number.value = Math.min(30, Math.max(1, raw));
  emitSelection();
}
</script>

<template>
  <!-- Lives in the study header, not floating over the video: an overlay
       positioned inside the player frame (tried first, in two different
       corners) collided with the frame's own existing overlay content on a
       16:9 frame at a narrow viewport, where the anime answer box and the
       playback controls already fill the frame edge to edge with no free
       space left for a third element. The header has normal, unconstrained
       flow and already wraps responsively (StudyDisplayToggles), so this
       control reuses that instead of fighting the video frame for room. -->
  <div class="theme-slot-answer" :class="{ touched }">
    <span class="label">OP/ED</span>
    <div class="seg" role="group" aria-label="Opening or Ending">
      <button
        type="button"
        class="seg-btn"
        :class="{ on: type === 'OP' }"
        :aria-pressed="type === 'OP'"
        :disabled="disabled"
        @click="chooseType('OP')"
      >
        Opening
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ on: type === 'ED' }"
        :aria-pressed="type === 'ED'"
        :disabled="disabled"
        @click="chooseType('ED')"
      >
        Ending
      </button>
    </div>
    <label class="number-field">
      #
      <input type="number" min="1" max="30" step="1" :value="number" :disabled="disabled" @input="onNumberInput" />
    </label>
  </div>
</template>

<style scoped>
.theme-slot-answer {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
}

.theme-slot-answer.touched {
  border-color: var(--accent-secondary);
}

.label {
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.seg {
  display: flex;
  flex: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
}

.seg-btn {
  padding: 5px 9px;
  border: 0;
  border-left: 1px solid var(--border);
  background: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.seg-btn:first-child {
  border-left: 0;
  border-radius: calc(var(--radius-sm) - 1px) 0 0 calc(var(--radius-sm) - 1px);
}

.seg-btn:last-child {
  border-radius: 0 calc(var(--radius-sm) - 1px) calc(var(--radius-sm) - 1px) 0;
}

.seg-btn.on {
  background: var(--accent-secondary);
  color: var(--accent-ink);
}

.seg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.number-field {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.number-field input {
  width: 38px;
  padding: 4px 5px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  text-align: center;
}

@media (max-width: 600px) {
  .label {
    display: none;
  }
}
</style>
