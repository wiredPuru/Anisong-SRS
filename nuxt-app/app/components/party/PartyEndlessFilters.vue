<script setup lang="ts">
import { EMPTY_STUDY_FILTERS, type StudyFilters } from "~/utils/studyFilters";
import type { PartyEndless } from "~/composables/usePartyHost";

const props = defineProps<{ endless: PartyEndless }>();

const { sourceType, selectedDeck, filters } = usePartyNewGame();
const filtersOpen = ref(false);
const activeCount = computed(() => countActiveFilters(filters.value));
const sourceLabel = computed(() => {
  if (props.endless.outsideLibrary) return "Songs outside your library";
  if (sourceType.value === "all") return "All cards";
  return selectedDeck.value ? `Deck: ${selectedDeck.value.label}` : "Pick a deck in New game";
});

function apply(next: StudyFilters) {
  filters.value = next;
  filtersOpen.value = false;
}

function clear() {
  filters.value = structuredClone(EMPTY_STUDY_FILTERS);
}
</script>

<template>
  <div class="endless-filters">
    <h2 class="filters-title">Endless filters</h2>
    <p class="filters-line">{{ sourceLabel }} · {{ activeCount ? `${activeCount} filter${activeCount === 1 ? "" : "s"} on` : "No filters" }}</p>
    <div class="filters-actions">
      <button type="button" class="filters-btn primary" @click="filtersOpen = true">Edit filters</button>
      <button v-if="activeCount" type="button" class="filters-btn" @click="clear">Clear</button>
    </div>
    <p class="filters-hint">Changes replace the songs still to come, from the next one on.</p>
    <StudyFiltersModal
      :open="filtersOpen"
      :filters="filters"
      api-base="/api/party/host"
      title="Endless filters"
      hint="Songs added from now on match every filter. Songs you added by hand stay."
      @close="filtersOpen = false"
      @apply="apply"
    />
  </div>
</template>

<style scoped>
.endless-filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filters-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.filters-line {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.filters-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.filters-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filters-btn {
  padding: 6px 14px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.filters-btn.primary {
  background: var(--accent);
  color: var(--accent-ink);
}
</style>
