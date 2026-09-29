<script setup lang="ts">
import type { StudyFilters } from "~/utils/studyFilters";

type SourceType = "all" | "artist" | "anime" | "created";
interface DeckOption {
  id: number;
  label: string;
  cardCount: number;
}
interface DeckListItem {
  id: number;
  name?: string;
  titleEnglish?: string;
  cardCount: number;
}

const props = defineProps<{ gameRunning: boolean }>();
const emit = defineEmits<{ loaded: [result: { loaded: number; skipped: number; total: number }] }>();

const SOURCE_LABELS: Record<SourceType, string> = {
  all: "All cards",
  artist: "Artist",
  anime: "Anime",
  created: "Manual deck",
};
const DEBOUNCE_MS = 300;

const sourceType = ref<SourceType>("all");
const deckQuery = ref("");
const decks = ref<DeckOption[]>([]);
const decksLoading = ref(false);
const selectedDeck = ref<DeckOption | null>(null);
const filters = ref<StudyFilters>(structuredClone(EMPTY_STUDY_FILTERS));
const filtersOpen = ref(false);
const shuffle = ref(true);
const downloadedOnly = ref(false);

const previewTotal = ref<number | null>(null);
const previewError = ref<string | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

const activeFilterCount = computed(() => countActiveFilters(filters.value));
const scope = computed(() => {
  if (sourceType.value === "all") return { type: "all" as const };
  return selectedDeck.value ? { type: sourceType.value, id: selectedDeck.value.id } : null;
});

let deckTimer: ReturnType<typeof setTimeout> | null = null;
let deckRequest = 0;
async function fetchDecks() {
  if (sourceType.value === "all") return;
  const request = ++deckRequest;
  decksLoading.value = true;
  try {
    const result = await $fetch<{ decks: DeckListItem[] }>("/api/party/host/decks", {
      query: { type: sourceType.value, q: deckQuery.value.trim() || undefined },
    });
    if (request !== deckRequest) return;
    decks.value = result.decks.map((deck) => ({
      id: deck.id,
      label: deck.name ?? deck.titleEnglish ?? `#${deck.id}`,
      cardCount: deck.cardCount,
    }));
  } catch {
    if (request === deckRequest) decks.value = [];
  } finally {
    if (request === deckRequest) decksLoading.value = false;
  }
}

watch(sourceType, () => {
  selectedDeck.value = null;
  deckQuery.value = "";
  decks.value = [];
  void fetchDecks();
});
watch(deckQuery, () => {
  if (deckTimer) clearTimeout(deckTimer);
  deckTimer = setTimeout(fetchDecks, DEBOUNCE_MS);
});

function requestBody(withShuffle: boolean) {
  return {
    scope: scope.value,
    filters: filtersQueryValue(filters.value),
    shuffle: withShuffle,
    downloadedOnly: downloadedOnly.value,
  };
}

let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewRequest = 0;
async function refreshPreview() {
  const request = ++previewRequest;
  previewError.value = null;
  if (!scope.value) {
    previewTotal.value = null;
    return;
  }
  try {
    const result = await $fetch<{ total: number }>("/api/party/host/queue-preview", {
      method: "POST",
      body: requestBody(false),
    });
    if (request === previewRequest) previewTotal.value = result.total;
  } catch (err) {
    if (request !== previewRequest) return;
    previewTotal.value = null;
    previewError.value = extractErrorMessage(err, "Could not count the songs.");
  }
}
watch([scope, filters, downloadedOnly], () => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, DEBOUNCE_MS);
}, { deep: true, immediate: true });

// append adds to the running game's queue; otherwise the load replaces it.
async function loadGame(append = false) {
  if (!scope.value || loading.value) return;
  loading.value = true;
  loadError.value = null;
  try {
    const preview = await $fetch<{ cardIds: number[]; total: number }>("/api/party/host/queue-preview", {
      method: "POST",
      body: requestBody(shuffle.value),
    });
    if (!preview.cardIds.length) {
      loadError.value = "No songs match. Loosen the filters or pick another source.";
      return;
    }
    const result = await $fetch<{ loaded: number; skipped: number }>("/api/party/host/command", {
      method: "POST",
      body: { type: "load", cardIds: preview.cardIds, downloadedOnly: downloadedOnly.value, append },
    });
    if (!result.loaded && append) {
      loadError.value = "Every matching song is already in the queue.";
      return;
    }
    if (!result.loaded) {
      loadError.value = downloadedOnly.value
        ? "None of these songs has a downloaded clip it can play."
        : "None of these songs has a clip the current Clip source setting allows.";
      return;
    }
    emit("loaded", { ...result, total: preview.total });
  } catch (err) {
    loadError.value = extractErrorMessage(err, "Could not load the game.");
  } finally {
    loading.value = false;
  }
}

function applyFilters(next: StudyFilters) {
  filters.value = next;
  filtersOpen.value = false;
}
</script>

<template>
  <section class="builder" aria-labelledby="builder-title">
    <h2 id="builder-title" class="builder-title">New game</h2>

    <div class="source-tabs" role="tablist" aria-label="Song source">
      <button
        v-for="(label, type) in SOURCE_LABELS"
        :key="type"
        type="button"
        role="tab"
        class="source-tab"
        :class="{ active: sourceType === type }"
        :aria-selected="sourceType === type"
        @click="sourceType = type"
      >
        {{ label }}
      </button>
    </div>

    <div v-if="sourceType !== 'all'" class="deck-picker">
      <input v-model="deckQuery" type="search" class="deck-search" :placeholder="`Search ${SOURCE_LABELS[sourceType].toLowerCase()}s`" />
      <ul class="deck-list" :aria-busy="decksLoading">
        <li v-for="deck in decks" :key="deck.id">
          <button
            type="button"
            class="deck-option"
            :class="{ selected: selectedDeck?.id === deck.id }"
            @click="selectedDeck = deck"
          >
            <span class="deck-label">{{ deck.label }}</span>
            <span class="deck-count">{{ deck.cardCount }}</span>
          </button>
        </li>
        <li v-if="!decks.length && !decksLoading" class="deck-empty">Nothing matches.</li>
      </ul>
    </div>

    <div class="builder-row">
      <button type="button" class="builder-btn secondary" @click="filtersOpen = true">
        Filters<span v-if="activeFilterCount" class="badge">{{ activeFilterCount }}</span>
      </button>
      <label class="shuffle-toggle">
        <input v-model="shuffle" type="checkbox" />
        Shuffle
      </label>
      <label class="shuffle-toggle">
        <input v-model="downloadedOnly" type="checkbox" />
        Downloaded clips only
      </label>
    </div>

    <p v-if="previewError" class="builder-error" role="alert">{{ previewError }}</p>
    <p v-else-if="!scope" class="builder-note">Pick a {{ SOURCE_LABELS[sourceType].toLowerCase() }} to play.</p>
    <p v-else-if="previewTotal !== null" class="builder-note">
      {{ previewTotal }} song{{ previewTotal === 1 ? "" : "s" }} match<template v-if="previewTotal > 2000">; a game holds the first 2000{{ shuffle ? " of a shuffle" : "" }}</template>.
    </p>

    <p v-if="loadError" class="builder-error" role="alert">{{ loadError }}</p>
    <div v-if="props.gameRunning" class="builder-actions">
      <button type="button" class="builder-btn primary" :disabled="!scope || !previewTotal || loading" @click="loadGame(true)">
        {{ loading ? "Adding..." : `Add ${Math.min(previewTotal ?? 0, 2000)} songs to queue` }}
      </button>
      <button type="button" class="builder-btn secondary" :disabled="!scope || !previewTotal || loading" @click="loadGame(false)">
        Start new game
      </button>
    </div>
    <button v-else type="button" class="builder-btn primary" :disabled="!scope || !previewTotal || loading" @click="loadGame()">
      {{ loading ? "Loading..." : `Load ${Math.min(previewTotal ?? 0, 2000)} songs` }}
    </button>

    <StudyFiltersModal
      :open="filtersOpen"
      :filters="filters"
      api-base="/api/party/host"
      title="Game filters"
      hint="Only songs matching every filter are added to the game."
      @close="filtersOpen = false"
      @apply="applyFilters"
    />
  </section>
</template>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.builder-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
}

.source-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-tab {
  padding: 8px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.source-tab.active {
  border-color: var(--accent);
  color: var(--accent);
}

.deck-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deck-search {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
}

.deck-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.deck-option {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
  text-align: left;
  cursor: pointer;
}

.deck-option.selected {
  background: var(--surface-raised);
  color: var(--accent);
  font-weight: 700;
}

.deck-count {
  color: var(--muted);
}

.deck-empty {
  padding: 10px 14px;
  color: var(--muted);
}

.builder-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.shuffle-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.builder-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 2px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.builder-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.builder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.builder-btn.secondary {
  border-color: var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
}

.badge {
  min-width: 20px;
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  color: var(--accent-secondary-ink);
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}

.builder-note,
.builder-error {
  margin: 0;
  font-size: 14px;
}

.builder-note {
  color: var(--muted);
}

.builder-error {
  color: var(--fail);
  font-weight: 700;
}
</style>
