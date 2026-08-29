<script setup lang="ts">
interface NavLink {
  to: string;
  label: string;
}

const links: NavLink[] = [
  { to: "/", label: "Home" },
  { to: "/study", label: "Study" },
  { to: "/cards", label: "Cards" },
  { to: "/decks", label: "Decks" },
  { to: "/stats", label: "Stats" },
  { to: "/settings", label: "Settings" },
];

const route = useRoute();

function isActive(to: string): boolean {
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(`${to}/`);
}

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
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

interface NamedResult {
  id: number;
  name: string;
}

interface AnimeResult {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  coverImageUrl: string | null;
}

interface AniListResult {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

interface SearchResults {
  cards: CardWithDetails[];
  artists: NamedResult[];
  anime: AnimeResult[];
  decks: NamedResult[];
}

function emptyResults(): SearchResults {
  return { cards: [], artists: [], anime: [], decks: [] };
}

const searchQuery = ref("");
const results = ref<SearchResults>(emptyResults());
const searchPending = ref(false);
const searchError = ref(false);
const dropdownOpen = ref(false);
const searchContainerRef = ref<HTMLElement | null>(null);

const externalAnime = ref<AniListResult[] | null>(null);
const externalPending = ref(false);

const hasResults = computed(
  () =>
    results.value.cards.length +
      results.value.artists.length +
      results.value.anime.length +
      results.value.decks.length >
    0,
);
const hasExternalResults = computed(() => Boolean(externalAnime.value && externalAnime.value.length));
const showNoResults = computed(() => !hasResults.value && !externalPending.value && !hasExternalResults.value);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let searchGeneration = 0;

async function runSearch() {
  const q = searchQuery.value.trim();
  const gen = ++searchGeneration;

  if (q.length < 2) {
    results.value = emptyResults();
    externalAnime.value = null;
    externalPending.value = false;
    searchPending.value = false;
    return;
  }

  searchPending.value = true;
  searchError.value = false;
  externalAnime.value = null;

  let localResults: SearchResults;
  try {
    localResults = await $fetch<SearchResults>("/api/search", { query: { q } });
  } catch {
    if (gen === searchGeneration) {
      searchError.value = true;
      searchPending.value = false;
    }
    return;
  }

  if (gen !== searchGeneration) return;
  results.value = localResults;
  searchPending.value = false;

  if (localResults.anime.length === 0) {
    externalPending.value = true;
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
}

function onSearchInput() {
  dropdownOpen.value = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, 250);
}

function onSearchFocus() {
  if (searchQuery.value.trim().length >= 2) dropdownOpen.value = true;
}

function closeDropdown() {
  dropdownOpen.value = false;
}

function resetSearch() {
  searchQuery.value = "";
  results.value = emptyResults();
  externalAnime.value = null;
  externalPending.value = false;
  dropdownOpen.value = false;
}

const pendingCardPreview = useState<CardWithDetails | null>("pendingCardPreview", () => null);

function selectCard(card: CardWithDetails) {
  pendingCardPreview.value = card;
  resetSearch();
  navigateTo("/cards");
}

function selectArtist(result: NamedResult) {
  resetSearch();
  navigateTo(`/decks?type=artist&id=${result.id}`);
}

function selectAnime(result: AnimeResult) {
  resetSearch();
  navigateTo(`/decks?type=anime&id=${result.id}`);
}

function selectDeck(result: NamedResult) {
  resetSearch();
  navigateTo(`/decks?type=created&id=${result.id}`);
}

function addShow(result: AniListResult) {
  resetSearch();
  navigateTo(`/cards/new?aniListId=${result.aniListId}`);
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
  <nav class="app-nav">
    <div class="nav-links">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="nav-link"
        :class="{ active: isActive(link.to) }"
      >
        {{ link.label }}
      </NuxtLink>
    </div>

    <div ref="searchContainerRef" class="nav-search">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search..."
        class="search-input"
        @input="onSearchInput"
        @focus="onSearchFocus"
        @keydown.escape="closeDropdown"
      />
      <div v-if="dropdownOpen" class="search-dropdown">
        <p v-if="searchPending" class="search-status">Searching...</p>
        <p v-else-if="searchError" class="search-status search-status-error">Search failed.</p>
        <template v-else>
          <div v-if="results.cards.length" class="search-group">
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
          <div v-if="results.artists.length" class="search-group">
            <span class="search-group-label">Artists</span>
            <button
              v-for="a in results.artists"
              :key="`artist-${a.id}`"
              type="button"
              class="search-result"
              @click="selectArtist(a)"
            >
              {{ a.name }}
            </button>
          </div>
          <div v-if="results.anime.length" class="search-group">
            <span class="search-group-label">Anime</span>
            <button
              v-for="a in results.anime"
              :key="`anime-${a.id}`"
              type="button"
              class="search-result"
              @click="selectAnime(a)"
            >
              {{ a.titleEnglish }}
            </button>
          </div>
          <div v-if="results.decks.length" class="search-group">
            <span class="search-group-label">Decks</span>
            <button
              v-for="d in results.decks"
              :key="`deck-${d.id}`"
              type="button"
              class="search-result"
              @click="selectDeck(d)"
            >
              {{ d.name }}
            </button>
          </div>
          <p v-if="externalPending" class="search-status">Searching for shows...</p>
          <div v-else-if="hasExternalResults" class="search-group">
            <span class="search-group-label">Add a show</span>
            <div v-for="a in externalAnime" :key="`external-${a.aniListId}`" class="search-result external-result">
              <span class="search-result-text">
                {{ a.titleRomaji }}
                <span v-if="a.titleEnglish" class="search-result-sub">{{ a.titleEnglish }}</span>
              </span>
              <button type="button" class="add-show-btn" @click="addShow(a)">Add</button>
            </div>
          </div>
          <p v-if="showNoResults" class="search-status">No results.</p>
        </template>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
}

.nav-links {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.nav-link {
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
}

.nav-link:hover {
  color: var(--text);
}

.nav-link.active {
  background: var(--accent);
  color: var(--accent-ink);
}

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

.external-result {
  justify-content: space-between;
  cursor: default;
}

.search-result-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.add-show-btn {
  flex: none;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
</style>
