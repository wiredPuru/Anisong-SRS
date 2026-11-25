<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import { PARTY_THEMES, type PartyTheme } from "~/utils/partyThemes";

defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

// Everyday looks first, then each season's under its own heading.
const groups = computed(() => {
  const bySeason = new Map<string, PartyTheme[]>();
  for (const theme of PARTY_THEMES) {
    const key = theme.season ?? "Everyday";
    bySeason.set(key, [...(bySeason.get(key) ?? []), theme]);
  }
  return [...bySeason].map(([label, themes]) => ({ label, themes }));
});
</script>

<template>
  <section class="themes" aria-labelledby="themes-title">
    <h2 id="themes-title" class="themes-title">Display theme</h2>
    <p class="themes-hint">Changes the display screen right away and is remembered next time.</p>
    <div v-for="group in groups" :key="group.label" class="themes-group">
      <p class="themes-group-label">{{ group.label }}</p>
      <div class="themes-grid" role="radiogroup" :aria-label="`${group.label} themes`">
        <button
          v-for="theme in group.themes"
          :key="theme.id"
          type="button"
          role="radio"
          class="theme-card"
          :class="{ on: state.displayTheme === theme.id }"
          :aria-checked="state.displayTheme === theme.id"
          @click="emit('command', { type: 'displayTheme', theme: theme.id })"
        >
          <span class="theme-preview" :style="{ '--sw-bg': theme.swatch[0], '--sw-panel': theme.swatch[1], '--sw-accent': theme.swatch[2], '--sw-text': theme.swatch[3] }" aria-hidden="true">
            <span class="theme-preview-panel"><span class="theme-preview-line" /><span class="theme-preview-line short" /></span>
          </span>
          <span class="theme-name">{{ theme.label }}</span>
          <span class="theme-hint">{{ theme.hint }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.themes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.themes-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.themes-hint,
.themes-group-label {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.themes-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.themes-group-label {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 12px;
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 8px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.theme-card:hover {
  border-color: var(--muted);
}

.theme-card.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.theme-preview {
  height: 64px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 8px;
  border-radius: calc(var(--radius-sm) - 4px);
  background: var(--sw-bg);
}

.theme-preview-panel {
  width: 70%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 2px solid var(--sw-accent);
  border-radius: 8px;
  background: var(--sw-panel);
}

.theme-preview-line {
  height: 5px;
  border-radius: 3px;
  background: var(--sw-text);
  opacity: 0.85;
}

.theme-preview-line.short {
  width: 55%;
  background: var(--sw-accent);
}

.theme-name {
  font-weight: 800;
  font-size: 14px;
}

.theme-hint {
  color: var(--muted);
  font-size: 12px;
}
</style>
