<script setup lang="ts">
import type { ThemePreference } from "~/utils/theme";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Kai's pink and cream" },
  { value: "dark", label: "Dark", hint: "Warm gruvbox, Kai's pinks" },
  { value: "system", label: "System", hint: "Follows your OS" },
];

const { preference, setPreference } = useTheme();
</script>

<template>
  <div class="theme-options" role="radiogroup" aria-label="Theme">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      role="radio"
      class="theme-option"
      :class="{ active: preference === option.value }"
      :aria-checked="preference === option.value"
      @click="setPreference(option.value)"
    >
      <span class="swatch" aria-hidden="true">
        <span v-if="option.value !== 'dark'" class="swatch-half theme-light-scope">
          <span class="swatch-card"><span class="swatch-dot" /><span class="swatch-line" /></span>
        </span>
        <span v-if="option.value !== 'light'" class="swatch-half theme-dark-scope">
          <span class="swatch-card"><span class="swatch-dot" /><span class="swatch-line" /></span>
        </span>
      </span>
      <span class="option-label">{{ option.label }}</span>
      <span class="option-hint">{{ option.hint }}</span>
    </button>
  </div>
</template>

<style scoped>
.theme-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 10px 14px;
  border-radius: var(--radius);
  border: 2px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
}

.theme-option:hover {
  border-color: var(--outline);
}

.theme-option.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.swatch {
  display: flex;
  width: 100%;
  height: 72px;
  margin-bottom: 6px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}

.swatch-half {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.swatch-card {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 70%;
  max-width: 110px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 2px solid var(--outline);
}

.swatch-dot {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
}

.swatch-line {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--text);
  opacity: 0.7;
}

.option-label {
  padding-inline: 4px;
  font-family: var(--font-display);
  font-size: 16px;
}

.option-hint {
  padding-inline: 4px;
  color: var(--muted);
  font-size: 13px;
}
</style>
