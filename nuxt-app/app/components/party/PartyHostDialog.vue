<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; title: string; wide?: boolean }>(), { wide: false });
const emit = defineEmits<{ close: [] }>();

const titleId = useId();

function onKeydown(event: KeyboardEvent) {
  if (props.open && event.key === "Escape") emit("close");
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <!-- v-show, not v-if: what is open inside (a half-built game) survives closing. -->
  <div v-show="open" class="backdrop" @click.self="emit('close')">
    <div class="dialog-box" :class="{ wide }" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <div class="dialog-head">
        <h2 :id="titleId" class="dialog-title">{{ title }}</h2>
        <slot name="actions" />
        <button type="button" class="dialog-close" aria-label="Close" @click="emit('close')">✕</button>
      </div>
      <div class="dialog-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--scrim);
}

.dialog-box {
  width: min(560px, 100%);
  max-height: min(860px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.dialog-box.wide {
  width: min(900px, 100%);
}

.dialog-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-title {
  flex: 1;
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
}

.dialog-close {
  border: none;
  background: none;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
}

.dialog-body {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
