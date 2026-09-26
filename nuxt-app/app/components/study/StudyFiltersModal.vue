<script setup lang="ts">
import type { StudyFilters } from "~/utils/studyFilters";

const props = defineProps<{ open: boolean; filters: StudyFilters }>();
const emit = defineEmits<{ close: []; apply: [filters: StudyFilters] }>();

const draft = ref<StudyFilters>(structuredClone(toRaw(props.filters)));

watch(() => props.open, (open) => {
  if (open) draft.value = structuredClone(toRaw(props.filters));
});

const problem = computed(() => studyFiltersProblem(draft.value));
const draftCount = computed(() => countActiveFilters(draft.value));

function clearAll() {
  draft.value = { ...structuredClone(EMPTY_STUDY_FILTERS), tagMinRank: draft.value.tagMinRank };
}

function apply() {
  if (problem.value) return;
  emit("apply", structuredClone(toRaw(draft.value)));
}

// Escape closes even from a field: every control in here is a form input, and
// Escape is never typed text.
function onKeydown(event: KeyboardEvent) {
  if (props.open && event.key === "Escape" && !event.isComposing) emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="study-filters-title">
      <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">✕</button>
      <h2 id="study-filters-title" class="title">Study filters</h2>
      <p class="hint">Only due cards matching every filter are studied. Scheduling is never changed.</p>

      <div class="body">
        <StudyFilterForm v-model="draft" />
      </div>

      <p v-if="problem" class="control-error">{{ problem }}</p>
      <div class="footer">
        <button type="button" class="text-btn" :disabled="draftCount === 0" @click="clearAll">Clear all</button>
        <span class="footer-spacer" />
        <button type="button" class="text-btn" @click="emit('close')">Cancel</button>
        <button type="button" class="apply-btn" :disabled="Boolean(problem)" @click="apply">
          Apply<template v-if="draftCount"> ({{ draftCount }})</template>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: var(--z-above-immersive);
}

.panel {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: min(760px, 88vh);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border-radius: calc(var(--radius) + 8px);
  background: var(--bg);
  border: 2px solid var(--outline);
  box-shadow: var(--shadow-soft);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.title {
  margin: 0;
  padding-right: 36px;
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
  padding-right: 4px;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}

.footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-spacer {
  flex: 1;
}

.text-btn {
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.apply-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.text-btn:disabled,
.apply-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 820px) {
  .panel {
    padding: 20px;
  }
}
</style>
