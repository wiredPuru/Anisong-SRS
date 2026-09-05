<script setup lang="ts">
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  themeSlot: string;
  artistId: number;
  artistName: string;
  animeId: number;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

interface AniListResult {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

interface ArtistCandidate {
  id: number;
  name: string;
  slug: string;
}

interface SearchResults {
  cards: CardWithDetails[];
}

function emptyResults(): SearchResults {
  return { cards: [] };
}

const searchQuery = ref("");
const results = ref<SearchResults>(emptyResults());
const searchPending = ref(false);
const searchError = ref(false);
const dropdownOpen = ref(false);
const searchContainerRef = ref<HTMLElement | null>(null);

const externalAnime = ref<AniListResult[] | null>(null);
const externalPending = ref(false);

const externalArtists = ref<ArtistCandidate[] | null>(null);
const externalArtistsPending = ref(false);

const hasResults = computed(() => results.value.cards.length > 0);
const hasExternalResults = computed(() => Boolean(externalAnime.value && externalAnime.value.length));
const hasExternalArtistResults = computed(() => Boolean(externalArtists.value && externalArtists.value.length));
const showNoResults = computed(
  () =>
    !searchPending.value &&
    !searchError.value &&
    !externalPending.value &&
    !externalArtistsPending.value &&
    !hasResults.value &&
    !hasExternalResults.value &&
    !hasExternalArtistResults.value,
);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let searchGeneration = 0;

async function runLocalSearch(q: string, gen: number) {
  try {
    const localResults = await $fetch<SearchResults>("/api/search", { query: { q } });
    if (gen === searchGeneration) results.value = localResults;
  } catch {
    if (gen === searchGeneration) searchError.value = true;
  } finally {
    if (gen === searchGeneration) searchPending.value = false;
  }
}

async function runAnimeSearch(q: string, gen: number) {
  try {
    const res = await $fetch<{ results: AniListResult[] }>("/api/lookup/anilist-search", { query: { q } });
    if (gen === searchGeneration) externalAnime.value = res.results;
  } catch {
    // AniList unreachable folds into the generic "No results" state below,
    // not a separate error message - the dropdown never shows two
    // different "nothing here" states at once.
  } finally {
    if (gen === searchGeneration) externalPending.value = false;
  }
}

async function runArtistSearch(q: string, gen: number) {
  try {
    const res = await $fetch<{ results: ArtistCandidate[] }>("/api/lookup/artist-search", { query: { q } });
    if (gen === searchGeneration) externalArtists.value = res.results;
  } catch {
    // Same fold-into-empty-group behavior as the anime fallback above.
  } finally {
    if (gen === searchGeneration) externalArtistsPending.value = false;
  }
}

async function runSearch() {
  const q = searchQuery.value.trim();
  const gen = ++searchGeneration;

  if (q.length < 2) {
    results.value = emptyResults();
    externalAnime.value = null;
    externalPending.value = false;
    externalArtists.value = null;
    externalArtistsPending.value = false;
    searchPending.value = false;
    searchError.value = false;
    return;
  }

  searchPending.value = true;
  searchError.value = false;
  externalPending.value = true;
  externalAnime.value = null;
  externalArtistsPending.value = true;
  externalArtists.value = null;

  await Promise.all([runLocalSearch(q, gen), runAnimeSearch(q, gen), runArtistSearch(q, gen)]);
}

function onSearchInput() {
  dropdownOpen.value = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 250);
}

function onSearchFocus() {
  if (searchQuery.value.trim().length >= 2) dropdownOpen.value = true;
}

function onSearchEnter() {
  const q = searchQuery.value.trim();
  if (q.length < 2) return;
  resetSearch();
  navigateTo(`/cards?q=${encodeURIComponent(q)}`);
}

function closeDropdown() {
  dropdownOpen.value = false;
}

function resetSearch() {
  searchQuery.value = "";
  results.value = emptyResults();
  externalAnime.value = null;
  externalPending.value = false;
  externalArtists.value = null;
  externalArtistsPending.value = false;
  dropdownOpen.value = false;
}

const pendingCardPreview = useState<CardWithDetails | null>("pendingCardPreview", () => null);

function selectCard(card: CardWithDetails) {
  pendingCardPreview.value = card;
  resetSearch();
  navigateTo("/cards");
}

function addShow(result: AniListResult) {
  resetSearch();
  navigateTo(`/cards?q=${encodeURIComponent(result.titleRomaji)}`);
}

function selectArtistResult(candidate: ArtistCandidate) {
  resetSearch();
  navigateTo(`/cards?q=${encodeURIComponent(candidate.name)}`);
}

function onClickOutside(event: MouseEvent) {
  if (searchContainerRef.value && !searchContainerRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => window.addEventListener("mousedown", onClickOutside));
onUnmounted(() => window.removeEventListener("mousedown", onClickOutside));
</script>

<template>
  <div ref="searchContainerRef" class="nav-search">
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Search Anime or Artist"
      class="search-input"
      @input="onSearchInput"
      @focus="onSearchFocus"
      @keydown.escape="closeDropdown"
      @keydown.enter="onSearchEnter"
    />
    <div v-if="dropdownOpen" class="search-dropdown">
      <p v-if="searchPending" class="search-status">Searching...</p>
      <p v-else-if="searchError" class="search-status search-status-error">Search failed.</p>
      <div v-else-if="results.cards.length" class="search-group">
        <span class="search-group-label">Cards</span>
        <button
          v-for="c in results.cards"
          :key="`card-${c.id}`"
          type="button"
          class="search-result"
          @click="selectCard(c)"
        >
          {{ c.songTitle }}
          <span class="search-result-sub">{{ c.artistName }}</span>
        </button>
      </div>

      <p v-if="externalArtistsPending" class="search-status">Searching for artists...</p>
      <div v-else-if="hasExternalArtistResults" class="search-group">
        <span class="search-group-label">Artists</span>
        <button
          v-for="artist in externalArtists"
          :key="`artist-${artist.id}`"
          type="button"
          class="search-result"
          @click="selectArtistResult(artist)"
        >
          {{ artist.name }}
        </button>
      </div>

      <p v-if="externalPending" class="search-status">Searching for shows...</p>
      <div v-else-if="hasExternalResults" class="search-group">
        <span class="search-group-label">Anime</span>
        <button
          v-for="a in externalAnime"
          :key="`external-${a.aniListId}`"
          type="button"
          class="search-result"
          @click="addShow(a)"
        >
          {{ a.titleRomaji }}
          <span v-if="a.titleEnglish" class="search-result-sub">{{ a.titleEnglish }}</span>
        </button>
      </div>

      <p v-if="showNoResults" class="search-status">No results.</p>
    </div>
  </div>
</template>

<style scoped>
.nav-search {
  position: relative;
  flex: none;
  width: 220px;
}

.search-input {
  width: 100%;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  z-index: 20;
}

.search-status {
  margin: 0;
  padding: 4px 6px;
  color: var(--muted);
  font-size: 13px;
}

.search-status-error {
  color: var(--fail);
}

.search-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-group-label {
  padding: 0 6px 4px;
  color: var(--faint);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.search-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 6px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.search-result:hover {
  background: var(--surface-raised);
}

.search-result-sub {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
</style>
