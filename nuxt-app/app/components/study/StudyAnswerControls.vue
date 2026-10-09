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

/* Candy pills over the video: a solid fill so they read on any frame, with
   a soft glow of their own colour. */
.grade-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 52px;
  padding: 0 30px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.35);
  font: 800 16px var(--font-sans);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 0 18px var(--glow);
  transition: transform 0.15s ease;
}

.grade-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.grade-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.grade-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.grade-btn kbd {
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
  background: color-mix(in srgb, currentColor 10%, transparent);
  font: 800 11px var(--font-sans);
  opacity: 0.8;
}

.fail {
  --glow: color-mix(in srgb, var(--fail) 40%, transparent);
  background: var(--fail);
  color: var(--fail-ink);
}

.pass {
  --glow: color-mix(in srgb, var(--pass) 40%, transparent);
  background: var(--pass);
  color: var(--pass-ink);
}

.reveal {
  --glow: var(--accent-glow);
  background: var(--accent);
  color: var(--accent-ink);
}
</style>
