<script setup lang="ts">
withDefaults(defineProps<{ label?: string; activeCount?: number }>(), { label: "Display", activeCount: 0 });

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

// Only clicks on the page close it. The auto-reveal and answer-category
// modals it opens are teleported to <body>, so they count as outside, and
// the panel stays mounted (v-show) so they survive it closing.
function onMousedown(event: MouseEvent) {
  if (!open.value || !(event.target instanceof Node)) return;
  if (rootRef.value?.contains(event.target)) return;
  if (event.target instanceof Element && event.target.closest(".backdrop, [role='dialog']")) return;
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && open.value) open.value = false;
}

onMounted(() => {
  window.addEventListener("mousedown", onMousedown);
  window.addEventListener("keydown", onKeydown);
});
onUnmounted(() => {
  window.removeEventListener("mousedown", onMousedown);
  window.removeEventListener("keydown", onKeydown);
});

defineExpose({ close: () => (open.value = false) });
</script>

<template>
  <div ref="rootRef" class="display-menu">
    <button
      type="button"
      class="icon-btn"
      :aria-expanded="open"
      aria-haspopup="true"
      :aria-label="label"
      @click="open = !open"
    >
      <span aria-hidden="true">✦</span>
      <span v-if="activeCount" class="icon-badge">{{ activeCount }}</span>
      <span v-if="!open" class="tooltip">{{ label }}</span>
    </button>
    <div v-show="open" class="menu-panel" role="group" :aria-label="`${label} options`">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.display-menu {
  position: relative;
}

.menu-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: var(--z-chrome);
  display: grid;
  gap: 14px;
  width: 248px;
  padding: 14px;
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  background: var(--glass-surface-panel);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-soft);
}

/* The toggles were laid out for a header strip; in the menu they stack, and
   their hotkey tooltips open to the left instead of over the next row. */
.menu-panel :deep(.display-toggles) {
  flex-direction: column;
  align-items: stretch;
  flex-wrap: nowrap;
}

.menu-panel :deep(.toggle-btn) {
  text-align: left;
  border-radius: var(--radius-pill);
  padding: 8px 14px;
}

.menu-panel :deep(.seg) {
  border-radius: var(--radius-pill);
}

.menu-panel :deep(.seg-btn) {
  flex: 1;
}

.menu-panel :deep(.seg-btn:first-child) {
  border-radius: var(--radius-pill) 0 0 var(--radius-pill);
}

.menu-panel :deep(.seg-btn:last-child) {
  border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
}

.menu-panel :deep(.categories-btn) {
  width: auto;
  border-radius: var(--radius-pill);
}

.menu-panel :deep(.display-toggles .tooltip) {
  top: 50%;
  left: auto;
  right: calc(100% + 22px);
  transform: translateY(-50%);
}

.menu-panel :deep(.theme-chips) {
  flex-wrap: wrap;
}

.menu-panel :deep(.theme-chips-note) {
  display: none;
}
</style>
