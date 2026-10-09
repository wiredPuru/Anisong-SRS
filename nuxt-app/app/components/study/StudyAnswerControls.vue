<script setup lang="ts">
const props = defineProps<{ disabled: boolean; awaitingReveal: boolean }>();
const emit = defineEmits<{ pass: []; fail: []; reveal: [] }>();

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (props.disabled || isTypingTarget(event)) return;
  // Nothing to grade yet while the answer is still hidden - only Enter
  // (Reveal) does anything.
  if (props.awaitingReveal) {
    if (event.key === "Enter") {
      event.preventDefault();
      emit("reveal");
    }
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    emit("fail");
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    emit("pass");
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="answer-bar">
    <button
      v-if="awaitingReveal"
      type="button"
      class="grade-btn reveal"
      :disabled="disabled"
      @click="emit('reveal')"
    >
      Reveal <kbd>Enter</kbd>
    </button>
    <template v-else>
      <button type="button" class="grade-btn fail" :disabled="disabled" @click="emit('fail')">
        Missed <kbd aria-label="Left arrow">&larr;</kbd>
      </button>
      <button type="button" class="grade-btn pass" :disabled="disabled" @click="emit('pass')">
        Got it <kbd aria-label="Right arrow">&rarr;</kbd>
      </button>
    </template>
  </div>
</template>

<style scoped>
.answer-bar {
  display: flex;
  gap: 12px;
}

.grade-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 48px;
  padding: 0 24px;
  border-radius: var(--radius-pill);
  font: 700 15px var(--font-sans);
  white-space: nowrap;
  cursor: pointer;
}

.grade-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.grade-btn kbd {
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid currentColor;
  font: 700 11px var(--font-sans);
  opacity: 0.6;
}

.fail {
  border: 1px solid rgba(255, 138, 138, 0.3);
  background: rgba(255, 138, 138, 0.08);
  color: var(--fail);
}

.fail:hover:not(:disabled) {
  background: rgba(255, 138, 138, 0.16);
}

.pass,
.reveal {
  border: 0;
  background: #ffffff;
  color: #0b0b0d;
}

.pass:hover:not(:disabled),
.reveal:hover:not(:disabled) {
  background: #e9e9ee;
}
</style>
