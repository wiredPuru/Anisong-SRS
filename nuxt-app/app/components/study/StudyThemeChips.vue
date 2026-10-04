<script setup lang="ts">
import { THEME_CHIPS, activeThemeChip, withThemeChip, type StudyFilters, type ThemeChip } from "~/utils/studyFilters";

const filters = defineModel<StudyFilters>({ required: true });
defineProps<{ disabled?: boolean }>();

const active = computed(() => activeThemeChip(filters.value));

function pick(chip: ThemeChip) {
  filters.value = withThemeChip(filters.value, chip);
}
</script>

<template>
  <div class="theme-chips" role="group" aria-label="Which songs this session covers">
    <span class="theme-chips-label">Session:</span>
    <button
      v-for="chip in THEME_CHIPS"
      :key="chip.value"
      type="button"
      class="theme-chip"
      :class="{ active: active === chip.value }"
      :aria-pressed="active === chip.value"
      :disabled="disabled"
      @click="pick(chip.value)"
    >
      {{ chip.label }}
    </button>
    <span class="theme-chips-note">Narrows this session only. The deck is unchanged.</span>
  </div>
</template>

<style scoped>
.theme-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.theme-chips-label {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.theme-chip {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.theme-chip.active {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.theme-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.theme-chips-note {
  color: var(--faint);
  font-size: 12px;
}
</style>
