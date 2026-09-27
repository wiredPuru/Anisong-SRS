<script setup lang="ts">
const emit = defineEmits<{ close: [] }>();

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="hotkeys-title">
      <h2 id="hotkeys-title" class="title">Keyboard shortcuts</h2>
      <dl class="keys">
        <template v-for="hotkey in PARTY_HOTKEYS" :key="hotkey.keys">
          <dt><kbd>{{ hotkey.keys }}</kbd></dt>
          <dd>{{ hotkey.action }}</dd>
        </template>
      </dl>
      <p class="note">Shortcuts pause while you type in a field.</p>
      <button type="button" class="close" @click="emit('close')">Close</button>
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

.panel {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
}

.keys {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  align-items: center;
}

.keys dd {
  margin: 0;
}

kbd {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: var(--surface-sunken);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
}

.note {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.close {
  align-self: flex-end;
  padding: 8px 18px;
  border: 2px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}
</style>
