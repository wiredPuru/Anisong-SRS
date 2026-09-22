<script setup lang="ts">
import type { ThemeSlotSelection, ThemeSlotType } from "~/utils/themeSlotAnswer";

const props = defineProps<{
  disabled: boolean;
  required?: boolean;
}>();
const emit = defineEmits<{ "update:selection": [ThemeSlotSelection | null] }>();

// Local only: the parent's bound selection stays null (skipped) until the
// player actually touches this control, so an untouched bonus category is
// never silently graded as a guess of "OP1". The page keys this component
// on presentationKey, forcing a fresh mount (and fresh local state) every
// card.
const type = ref<ThemeSlotType>("OP");
const number = ref(1);
const touched = ref(false);
// A required answer left untouched is graded blank, so it must not look like
// an "Opening" already picked.
const showPick = computed(() => touched.value || !props.required);

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
  <div class="theme-slot-answer" :class="{ touched, required }">
    <span class="label">{{ required ? "OP/ED (required)" : "OP/ED" }}</span>
    <div class="seg" role="group" aria-label="Opening or Ending">
      <button
        type="button"
        class="seg-btn"
        :class="{ on: showPick && type === 'OP' }"
        :aria-pressed="showPick && type === 'OP'"
        :disabled="disabled"
        @click="chooseType('OP')"
      >
        Opening
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ on: showPick && type === 'ED' }"
        :aria-pressed="showPick && type === 'ED'"
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
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass-surface);
  backdrop-filter: var(--glass-blur);
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
  .theme-slot-answer:not(.required) .label {
    display: none;
  }
}
</style>
