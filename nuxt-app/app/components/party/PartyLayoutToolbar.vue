<script setup lang="ts">
const emit = defineEmits<{ done: [] }>();

const { reset } = usePartyLayout();
</script>

<template>
  <div class="layout-toolbar" role="toolbar" aria-label="Arrange the screen">
    <p class="layout-toolbar-hint">Drag a piece to move it, or its corner dot to resize it.</p>
    <button type="button" class="layout-toolbar-button" @click="reset">Reset layout</button>
    <button type="button" class="layout-toolbar-button primary" @click="emit('done')">Done</button>
  </div>
</template>

<style scoped>
.layout-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-chrome);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 24px);
  padding: 8px 8px 8px 18px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.layout-toolbar-hint {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.layout-toolbar-button {
  flex-shrink: 0;
  padding: 6px 16px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.layout-toolbar-button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
</style>
