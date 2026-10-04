<script setup lang="ts">
import { THEME_TYPE_CHIPS, clearThemeTypes, toggleThemeType, type StudyFilters, type StudyThemeType } from "~/utils/studyFilters";

const filters = defineModel<StudyFilters>({ required: true });
defineProps<{ disabled?: boolean }>();

const allActive = computed(() => filters.value.themeTypes.length === 0);

function toggle(type: StudyThemeType) {
  filters.value = toggleThemeType(filters.value, type);
}
</script>

<template>
  <div class="theme-chips" role="group" aria-label="Which songs this session covers">
    <span class="theme-chips-label">Session:</span>
    <button
      v-for="chip in THEME_TYPE_CHIPS"
      :key="chip.value"
      type="button"
      class="theme-chip"
      :class="{ active: filters.themeTypes.includes(chip.value) }"
      :aria-pressed="filters.themeTypes.includes(chip.value)"
      :disabled="disabled"
      @click="toggle(chip.value)"
    >
      {{ chip.label }}
    </button>
    <button
      type="button"
      class="theme-chip"
      :class="{ active: allActive }"
      :aria-pressed="allActive"
      :disabled="disabled"
      @click="filters = clearThemeTypes(filters)"
    >
      All
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
