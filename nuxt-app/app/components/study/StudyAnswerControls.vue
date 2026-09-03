<script setup lang="ts">
const props = defineProps<{ disabled: boolean }>();
const emit = defineEmits<{ pass: []; fail: [] }>();

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (props.disabled || isTypingTarget(event)) return;
  if (event.key === "ArrowLeft") emit("fail");
  else if (event.key === "ArrowRight") emit("pass");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="answer-bar">
    <button type="button" class="answer-btn fail" :disabled="disabled" @click="emit('fail')">
      <span class="answer-label">Fail</span>
      <span class="key">&larr; Arrow</span>
    </button>
    <button type="button" class="answer-btn pass" :disabled="disabled" @click="emit('pass')">
      <span class="answer-label">Pass</span>
      <span class="key">Arrow &rarr;</span>
    </button>
  </div>
</template>

<style scoped>
.answer-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Arcade cabinet buttons: a solid lip under each one (box-shadow 0 4px 0)
   rather than a soft drop shadow, so they read as physical keys. The lip is
   part of the resting state, so the hover lift shortens it by the same 2px
   it rises - otherwise the button appears to float away from its own base. */
.answer-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-family: var(--font-sans);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.answer-label {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
}

.answer-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.answer-btn:active:not(:disabled) {
  transform: translateY(2px);
}

.answer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.answer-btn.fail {
  color: var(--fail);
  border-color: var(--fail);
  background: color-mix(in srgb, var(--fail) 12%, var(--bg));
  box-shadow: 0 4px 0 color-mix(in srgb, var(--fail) 42%, var(--bg));
}

.answer-btn.fail:hover:not(:disabled) {
  box-shadow: 0 6px 0 color-mix(in srgb, var(--fail) 42%, var(--bg));
}

.answer-btn.fail:active:not(:disabled) {
  box-shadow: 0 2px 0 color-mix(in srgb, var(--fail) 42%, var(--bg));
}

.answer-btn.pass {
  color: var(--pass);
  border-color: var(--pass);
  background: color-mix(in srgb, var(--pass) 12%, var(--bg));
  box-shadow: 0 4px 0 color-mix(in srgb, var(--pass) 42%, var(--bg));
}

.answer-btn.pass:hover:not(:disabled) {
  box-shadow: 0 6px 0 color-mix(in srgb, var(--pass) 42%, var(--bg));
}

.answer-btn.pass:active:not(:disabled) {
  box-shadow: 0 2px 0 color-mix(in srgb, var(--pass) 42%, var(--bg));
}

.key {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  opacity: 0.75;
}
</style>
