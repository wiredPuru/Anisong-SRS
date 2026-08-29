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
      <span class="key">&larr;</span> Fail
    </button>
    <button type="button" class="answer-btn pass" :disabled="disabled" @click="emit('pass')">
      Pass <span class="key">&rarr;</span>
    </button>
  </div>
</template>

<style scoped>
.answer-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.answer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.answer-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.answer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.answer-btn.fail {
  color: var(--fail);
  border-color: color-mix(in srgb, var(--fail) 45%, var(--border));
}

.answer-btn.pass {
  color: var(--pass);
  border-color: color-mix(in srgb, var(--pass) 45%, var(--border));
}

.key {
  font-size: 13px;
  padding: 3px 9px;
  border-radius: 7px;
  color: var(--muted);
  font-weight: 700;
}
</style>
