<script setup lang="ts">
defineProps<{
  result: "pass" | "fail";
  busy: boolean;
  retry: boolean;
  canUndo: boolean;
}>();

const emit = defineEmits<{ continue: []; undo: [] }>();

const continueButton = ref<HTMLButtonElement | null>(null);
onMounted(() => continueButton.value?.focus({ preventScroll: true }));
</script>

<template>
  <section class="manual-result" :class="result" role="status" aria-live="polite" aria-atomic="true">
    <h2 class="heading">{{ result === "pass" ? "Got it" : "Missed" }}</h2>
    <span class="spacer" />
    <button type="button" class="btn ghost" :disabled="busy || !canUndo" @click="emit('undo')">Undo</button>
    <button ref="continueButton" type="button" class="btn primary" :disabled="busy" @click="emit('continue')">
      {{ retry ? "Retry" : "Next" }}
      <kbd>&#9166;</kbd>
    </button>
  </section>
</template>

<style scoped>
.manual-result {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 12px;
  min-width: 0;
  width: 100%;
}

.manual-result.pass { --result-color: var(--pass); }
.manual-result.fail { --result-color: var(--fail); }

.heading {
  margin: 0;
  color: var(--result-color);
  font: 700 20px var(--font-display);
}

.spacer { flex: 1; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 48px;
  padding: 0 22px;
  border-radius: var(--radius-pill);
  font: 700 15px var(--font-sans);
  white-space: nowrap;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  border: 0;
  background: #ffffff;
  color: #0b0b0d;
}

.btn.ghost {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.btn kbd {
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid currentColor;
  font: 700 11px var(--font-sans);
  opacity: 0.6;
}
</style>
