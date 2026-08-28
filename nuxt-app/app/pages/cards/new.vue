<script setup lang="ts">
interface AniListResult {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

interface ThemeResult {
  songId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

interface ImportResult {
  anime: {
    id: number;
    aniListId: number;
    animethemesId: number | null;
    titleEnglish: string;
    titleRomaji: string;
    titleNative: string;
  };
  themes: ThemeResult[];
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

const searchQuery = ref("");
const searchResults = ref<AniListResult[] | null>(null);
const searching = ref(false);
const searchError = ref<string | null>(null);

const selectedAnime = ref<ImportResult | null>(null);
const importing = ref(false);
const importError = ref<string | null>(null);

const addedSongIds = reactive(new Set<number>());
const adding = reactive<Record<number, boolean>>({});
const addError = reactive<Record<number, string | null>>({});
const localPathInput = reactive<Record<number, string>>({});

async function search() {
  const q = searchQuery.value.trim();
  if (!q) return;

  searching.value = true;
  searchError.value = null;
  searchResults.value = null;
  selectedAnime.value = null;
  importError.value = null;

  try {
    const res = await $fetch<{ results: AniListResult[] }>("/api/lookup/anilist-search", { query: { q } });
    searchResults.value = res.results;
  } catch (err) {
    searchError.value = extractErrorMessage(err, "Search failed.");
  } finally {
    searching.value = false;
  }
}

async function selectAnime(result: AniListResult) {
  importing.value = true;
  importError.value = null;
  selectedAnime.value = null;

  try {
    const res = await $fetch<ImportResult>("/api/lookup/import", {
      method: "POST",
      body: { aniListId: result.aniListId },
    });
    selectedAnime.value = res;
  } catch (err) {
    importError.value = extractErrorMessage(err, "Import failed.");
  } finally {
    importing.value = false;
  }
}

async function addCard(theme: ThemeResult) {
  addError[theme.songId] = null;
  adding[theme.songId] = true;

  try {
    const localVideoPath = (localPathInput[theme.songId] ?? "").trim();
    await $fetch("/api/cards", {
      method: "POST",
      body: {
        songId: theme.songId,
        localVideoPath: localVideoPath || undefined,
        animethemesVideoUrl: theme.videoUrl ?? undefined,
        animethemesAudioUrl: theme.audioUrl ?? undefined,
      },
    });
    addedSongIds.add(theme.songId);
  } catch (err) {
    addError[theme.songId] = extractErrorMessage(err, "Failed to add card.");
  } finally {
    adding[theme.songId] = false;
  }
}
</script>

<template>
  <main class="cards-new">
    <div class="header-row">
      <h1>Add card</h1>
      <NuxtLink to="/cards" class="back-link">Back to cards</NuxtLink>
    </div>
    <p class="hint">Search AniList, pick an anime, then add a card per theme.</p>

    <form class="search-form" @submit.prevent="search">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search anime title..."
        :disabled="searching"
        class="search-input"
      />
      <button type="submit" class="search-btn" :disabled="searching">Search</button>
    </form>
    <p v-if="searchError" class="inline-error">{{ searchError }}</p>

    <div v-if="searching" class="state">Searching...</div>
    <template v-else-if="searchResults">
      <ul v-if="searchResults.length" class="result-list">
        <li v-for="result in searchResults" :key="result.aniListId" class="result-row">
          <div class="result-info">
            <span class="result-title">{{ result.titleRomaji }}</span>
            <span v-if="result.titleEnglish" class="result-meta">{{ result.titleEnglish }}</span>
          </div>
          <button type="button" class="select-btn" :disabled="importing" @click="selectAnime(result)">
            Select
          </button>
        </li>
      </ul>
      <p v-else class="state">No anime found for "{{ searchQuery }}".</p>
    </template>

    <div v-if="importing" class="state">Loading themes...</div>
    <p v-if="importError" class="inline-error">{{ importError }}</p>

    <div v-if="selectedAnime" class="themes-section">
      <h2>{{ selectedAnime.anime.titleEnglish }}</h2>
      <p v-if="!selectedAnime.themes.length" class="state">No themes found for this anime on animethemes.moe.</p>
      <ul v-else class="theme-list">
        <li v-for="theme in selectedAnime.themes" :key="theme.songId" class="theme-row">
          <div class="theme-info">
            <span class="theme-title">{{ theme.songTitle }}</span>
            <span class="result-meta">{{ theme.artistName }} - {{ theme.themeSlot }}</span>
          </div>

          <template v-if="addedSongIds.has(theme.songId)">
            <span class="added-badge">Added</span>
          </template>
          <template v-else>
            <div class="theme-actions">
              <input
                v-model="localPathInput[theme.songId]"
                type="text"
                placeholder="Local video path (optional)"
                :disabled="adding[theme.songId]"
                class="path-input"
              />
              <button
                type="button"
                class="add-btn"
                :disabled="adding[theme.songId]"
                @click="addCard(theme)"
              >
                Add card
              </button>
            </div>
            <p v-if="addError[theme.songId]" class="inline-error">{{ addError[theme.songId] }}</p>
          </template>
        </li>
      </ul>
    </div>
  </main>
</template>

<style scoped>
.cards-new {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
}

h2 {
  margin: 24px 0 12px;
  font-size: 20px;
  font-weight: 800;
}

.back-link {
  flex: none;
  color: var(--muted);
  font-family: var(--font-sans);
  text-decoration: none;
}

.hint {
  margin: 0 0 24px;
  color: var(--muted);
}

.search-form {
  display: flex;
  gap: 10px;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.search-btn {
  flex: none;
  padding: 12px 22px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 800;
  cursor: pointer;
}

.search-btn:disabled,
.search-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.state {
  margin-top: 16px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.inline-error {
  margin-top: 10px;
  color: var(--fail);
  font-size: 14px;
}

.result-list,
.theme-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row,
.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  flex-wrap: wrap;
}

.result-info,
.theme-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.result-title,
.theme-title {
  font-weight: 700;
}

.result-meta {
  color: var(--muted);
  font-size: 14px;
}

.select-btn,
.add-btn {
  flex: none;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.select-btn:disabled,
.add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.theme-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-input {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  width: 220px;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.added-badge {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--pass);
  color: var(--pass-ink);
  font-size: 13px;
  font-weight: 700;
}
</style>
