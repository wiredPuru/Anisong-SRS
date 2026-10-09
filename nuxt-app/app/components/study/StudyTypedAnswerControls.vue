<script setup lang="ts">
import type { RequiredCategories } from "~/utils/criterionGrading";
import type { TypedAnswerCategories } from "~/utils/typedAnswerCategories";

defineProps<{
  typedAnswers: boolean;
  locked: boolean;
  categories: TypedAnswerCategories;
  requiredCategories?: RequiredCategories;
}>();
const emit = defineEmits<{
  toggle: [];
  "update:categories": [TypedAnswerCategories];
}>();

const showCategories = ref(false);
</script>

<template>
  <div class="typed-controls">
    <button
      type="button"
      class="toggle-btn"
      :class="{ on: typedAnswers }"
      :aria-pressed="typedAnswers"
      :disabled="locked"
      @click="emit('toggle')"
    >
      Typed Answers
      <span class="tooltip">{{ locked ? "Continue before changing answer mode" : "Remember your preference for typed answers" }}</span>
    </button>
    <button
      v-if="typedAnswers"
      type="button"
      class="categories-btn"
      aria-label="Answer categories"
      :disabled="locked"
      @click="showCategories = true"
    >
      <span aria-hidden="true">⚙</span>
      <span class="tooltip">Choose what you guess each round</span>
    </button>
    <StudyTypedAnswerCategoriesModal
      v-if="showCategories"
      :categories="categories"
      :required="requiredCategories"
      @update:categories="emit('update:categories', $event)"
      @close="showCategories = false"
    />
  </div>
</template>

<style scoped>
.typed-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-btn {
  position: relative;
  flex: none;
  padding: 7px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.toggle-btn:hover:not(:disabled),
.categories-btn:hover:not(:disabled) {
  color: var(--text);
}

.toggle-btn.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  color: var(--accent);
  box-shadow: 0 0 14px var(--accent-glow);
}

.toggle-btn:disabled,
.categories-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.categories-btn {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
}

.tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

.toggle-btn:hover .tooltip,
.toggle-btn:focus-visible .tooltip,
.categories-btn:hover .tooltip,
.categories-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}
</style>
