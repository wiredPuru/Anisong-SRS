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
  songTitleNative: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

type SearchMode = "anime" | "artist" | "song";

interface ArtistCandidate {
  id: number;
  name: string;
  slug: string;
}

interface SongSearchResult {
  animethemesThemeId: number;
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  artistName: string | null;
  animeAniListId: number;
  animeAnimethemesId: number;
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

const searchMode = ref<SearchMode>("anime");

const searchQuery = ref("");
const searchResults = ref<AniListResult[] | null>(null);
const searching = ref(false);
const searchError = ref<string | null>(null);

const artistSearchResults = ref<ArtistCandidate[] | null>(null);
const artistSearching = ref(false);
const artistSearchError = ref<string | null>(null);

const songSearchResults = ref<SongSearchResult[] | null>(null);
const songSearching = ref(false);
const songSearchError = ref<string | null>(null);
const songAdding = reactive<Record<number, boolean>>({});
const songAddError = reactive<Record<number, string | null>>({});
const songResultSongId = reactive<Record<number, number>>({});

function setSearchMode(mode: SearchMode) {
  searchMode.value = mode;

  searchResults.value = null;
  searchError.value = null;
  selectedAnime.value = null;
  importError.value = null;

  artistSearchResults.value = null;
  artistSearchError.value = null;
  selectedArtist.value = null;
  artistImportError.value = null;

  songSearchResults.value = null;
  songSearchError.value = null;
}

async function artistSearch() {
  const q = searchQuery.value.trim();
  if (!q) return;

  artistSearching.value = true;
  artistSearchError.value = null;
  artistSearchResults.value = null;

  try {
    const res = await $fetch<{ results: ArtistCandidate[] }>("/api/lookup/artist-search", { query: { q } });
    artistSearchResults.value = res.results;
  } catch (err) {
    artistSearchError.value = extractErrorMessage(err, "Search failed.");
  } finally {
    artistSearching.value = false;
  }
}

async function songSearch() {
  const q = searchQuery.value.trim();
  if (!q) return;

  songSearching.value = true;
  songSearchError.value = null;
  songSearchResults.value = null;

  try {
    const res = await $fetch<{ results: SongSearchResult[] }>("/api/lookup/song-search", { query: { q } });
    songSearchResults.value = res.results;
  } catch (err) {
    songSearchError.value = extractErrorMessage(err, "Search failed.");
  } finally {
    songSearching.value = false;
  }
}

const selectedAnime = ref<ImportResult | null>(null);
const importing = ref(false);
const importError = ref<string | null>(null);

interface ArtistThemeResult {
  songId: number;
  themeSlot: string;
  songTitle: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

interface ArtistImportResult {
  artistName: string;
  animeGroups: {
    anime: {
      id: number;
      aniListId: number;
      animethemesId: number | null;
      titleEnglish: string;
      titleRomaji: string;
      titleNative: string;
    };
    themes: ArtistThemeResult[];
  }[];
}

const selectedArtist = ref<ArtistImportResult | null>(null);
const artistImporting = ref(false);
const artistImportError = ref<string | null>(null);

async function selectArtist(candidate: ArtistCandidate) {
  artistImporting.value = true;
  artistImportError.value = null;
  selectedArtist.value = null;

  try {
    const res = await $fetch<ArtistImportResult>("/api/lookup/artist-import", {
      method: "POST",
      body: { artistSlug: candidate.slug },
    });
    selectedArtist.value = res;
    await preloadAddedCards(res.animeGroups.flatMap((group) => group.themes.map((theme) => theme.songId)));
  } catch (err) {
    artistImportError.value = extractErrorMessage(err, "Import failed.");
  } finally {
    artistImporting.value = false;
  }
}

const addingAllForArtist = ref(false);

async function addAllArtistThemes() {
  if (!selectedArtist.value) return;

  addingAllForArtist.value = true;
  try {
    for (const group of selectedArtist.value.animeGroups) {
      for (const theme of group.themes) {
        if (addedCards[theme.songId]) continue;
        await addCard(theme);
      }
    }
  } finally {
    addingAllForArtist.value = false;
  }
}

const downloadingAllForArtist = ref(false);

function hasDownloadableAddedVideos(): boolean {
  if (!selectedArtist.value) return false;
  return selectedArtist.value.animeGroups.some((group) =>
    group.themes.some((theme) => {
      const card = addedCards[theme.songId];
      return card ? canDownload(card, "video") : false;
    }),
  );
}

async function downloadAllArtistVideos() {
  if (!selectedArtist.value) return;

  downloadingAllForArtist.value = true;
  try {
    for (const group of selectedArtist.value.animeGroups) {
      for (const theme of group.themes) {
        const card = addedCards[theme.songId];
        if (!card || !canDownload(card, "video")) continue;
        await downloadMedia(theme.songId, "video");
      }
    }
  } finally {
    downloadingAllForArtist.value = false;
  }
}

const addedCards = reactive<Record<number, CardWithDetails>>({});
const adding = reactive<Record<number, boolean>>({});
const addError = reactive<Record<number, string | null>>({});
const localPathInput = reactive<Record<number, string>>({});
const previewCard = ref<CardWithDetails | null>(null);

const { data: mediaLibraryData } = await useFetch<{
  libraryPaths: string[];
  defaultDownloadFolder: string | null;
  playbackMode: "auto" | "audioOnly";
}>("/api/media-library");
const hasDefaultDownloadFolder = computed(() => Boolean(mediaLibraryData.value?.defaultDownloadFolder));
const audioOnly = computed(() => mediaLibraryData.value?.playbackMode === "audioOnly");

const {
  downloading,
  downloadProgress,
  downloadError,
  downloadKey,
  canDownload,
  hasAnyDownloadableSource,
  downloadMedia: downloadMediaBase,
} = useCardDownloads();

function progressPercent(songId: number, kind: "video" | "audio"): number {
  const progress = downloadProgress[downloadKey(songId, kind)];
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}

async function downloadMedia(songId: number, kind: "video" | "audio") {
  const card = addedCards[songId];
  if (!card) return;

  const updated = await downloadMediaBase<CardWithDetails>(songId, card.id, kind);
  if (updated) {
    addedCards[songId] = updated;
  }
}

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
    await preloadAddedCards(res.themes.map((theme) => theme.songId));
  } catch (err) {
    importError.value = extractErrorMessage(err, "Import failed.");
  } finally {
    importing.value = false;
  }
}

async function removeCard(songId: number) {
  const card = addedCards[songId];
  if (!card) return;

  addError[songId] = null;
  try {
    await $fetch("/api/cards", { method: "DELETE", body: { id: card.id } });
    delete addedCards[songId];
    if (previewCard.value?.id === card.id) previewCard.value = null;
  } catch (err) {
    addError[songId] = extractErrorMessage(err, "Failed to delete card.");
  }
}

function onPreviewCardUpdated(updated: CardWithDetails) {
  addedCards[updated.songId] = updated;
  previewCard.value = updated;
}

async function preloadAddedCards(songIds: number[]) {
  if (!songIds.length) return;
  try {
    const res = await $fetch<{ cards: CardWithDetails[] }>("/api/cards/by-songs", {
      query: { songIds: songIds.join(",") },
    });
    for (const c of res.cards) addedCards[c.songId] = c;
  } catch {
    // Best-effort UX nicety; the server-side duplicate check still applies on Add.
  }
}

function resolvedSongId(animethemesThemeId: number): number | undefined {
  return songResultSongId[animethemesThemeId];
}

function addedSongCard(animethemesThemeId: number): CardWithDetails | undefined {
  const songId = songResultSongId[animethemesThemeId];
  return songId !== undefined ? addedCards[songId] : undefined;
}

async function addSongResult(result: SongSearchResult) {
  const key = result.animethemesThemeId;
  songAddError[key] = null;
  songAdding[key] = true;

  try {
    const imported = await $fetch<{
      songId: number;
      videoUrl: string | null;
      audioUrl: string | null;
      existingCard: CardWithDetails | null;
    }>("/api/lookup/song-import", { method: "POST", body: result });

    songResultSongId[key] = imported.songId;

    if (imported.existingCard) {
      addedCards[imported.songId] = imported.existingCard;
      return;
    }

    const res = await $fetch<{ card: CardWithDetails }>("/api/cards", {
      method: "POST",
      body: {
        songId: imported.songId,
        animethemesVideoUrl: imported.videoUrl ?? undefined,
        animethemesAudioUrl: imported.audioUrl ?? undefined,
      },
    });
    addedCards[imported.songId] = res.card;
  } catch (err) {
    songAddError[key] = extractErrorMessage(err, "Failed to add card.");
  } finally {
    songAdding[key] = false;
  }
}

async function addCard(theme: { songId: number; videoUrl: string | null; audioUrl: string | null }) {
  addError[theme.songId] = null;
  adding[theme.songId] = true;

  try {
    const localVideoPath = (localPathInput[theme.songId] ?? "").trim();
    const res = await $fetch<{ card: CardWithDetails }>("/api/cards", {
      method: "POST",
      body: {
        songId: theme.songId,
        localVideoPath: localVideoPath || undefined,
        animethemesVideoUrl: theme.videoUrl ?? undefined,
        animethemesAudioUrl: theme.audioUrl ?? undefined,
      },
    });
    addedCards[theme.songId] = res.card;
  } catch (err) {
    addError[theme.songId] = extractErrorMessage(err, "Failed to add card.");
  } finally {
    adding[theme.songId] = false;
  }
}

const route = useRoute();

onMounted(() => {
  const rawAniListId = route.query.aniListId;
  const aniListIdValue = Array.isArray(rawAniListId) ? rawAniListId[0] : rawAniListId;
  const aniListId = typeof aniListIdValue === "string" ? Number(aniListIdValue) : NaN;
  if (Number.isInteger(aniListId) && aniListId > 0) {
    selectAnime({ aniListId, titleRomaji: "", titleEnglish: null, titleNative: null });
    return;
  }

  const rawQuery = route.query.q;
  const queryValue = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
  if (typeof queryValue === "string" && queryValue.trim()) {
    searchQuery.value = queryValue;
    search();
  }
});
</script>

<template>
  <main class="cards-new">
    <div class="header-row">
      <h1>Add card</h1>
      <NuxtLink to="/cards" class="back-link">Back to cards</NuxtLink>
    </div>
    <p class="hint">Search AniList, pick an anime, then add a card per theme.</p>

    <div class="toggle">
      <button
        type="button"
        class="toggle-btn"
        :class="{ active: searchMode === 'anime' }"
        @click="setSearchMode('anime')"
      >
        By anime
      </button>
      <button
        type="button"
        class="toggle-btn"
        :class="{ active: searchMode === 'artist' }"
        @click="setSearchMode('artist')"
      >
        By artist
      </button>
      <button
        type="button"
        class="toggle-btn"
        :class="{ active: searchMode === 'song' }"
        @click="setSearchMode('song')"
      >
        By song
      </button>
    </div>

    <template v-if="searchMode === 'anime'">
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
    </template>

    <template v-else-if="searchMode === 'artist'">
      <form class="search-form" @submit.prevent="artistSearch">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search artist name..."
          :disabled="artistSearching"
          class="search-input"
        />
        <button type="submit" class="search-btn" :disabled="artistSearching">Search</button>
      </form>
      <p v-if="artistSearchError" class="inline-error">{{ artistSearchError }}</p>

      <div v-if="artistSearching" class="state">Searching...</div>
      <template v-else-if="artistSearchResults">
        <ul v-if="artistSearchResults.length" class="result-list">
          <li v-for="result in artistSearchResults" :key="result.id" class="result-row">
            <div class="result-info">
              <span class="result-title">{{ result.name }}</span>
            </div>
            <button type="button" class="select-btn" :disabled="artistImporting" @click="selectArtist(result)">
              Select
            </button>
          </li>
        </ul>
        <p v-else class="state">No artist found for "{{ searchQuery }}".</p>
      </template>

      <div v-if="artistImporting" class="state">Loading themes...</div>
      <p v-if="artistImportError" class="inline-error">{{ artistImportError }}</p>

      <div v-if="selectedArtist" class="themes-section">
        <template v-if="selectedArtist.animeGroups.length">
          <div class="bulk-actions">
            <button type="button" class="add-btn" :disabled="addingAllForArtist" @click="addAllArtistThemes">
              {{ addingAllForArtist ? "Adding..." : "Add all" }}
            </button>
            <button
              v-if="hasDefaultDownloadFolder && hasDownloadableAddedVideos()"
              type="button"
              class="add-btn"
              :disabled="downloadingAllForArtist"
              @click="downloadAllArtistVideos"
            >
              {{ downloadingAllForArtist ? "Downloading..." : "Download all" }}
            </button>
          </div>
          <div v-for="group in selectedArtist.animeGroups" :key="group.anime.id">
            <h2>{{ group.anime.titleEnglish }}</h2>
            <ul class="theme-list">
              <li v-for="theme in group.themes" :key="theme.songId" class="theme-row">
                <div class="theme-info">
                  <span class="theme-title">{{ theme.songTitle }}</span>
                  <span class="result-meta">{{ selectedArtist.artistName }} - {{ theme.themeSlot }}</span>
                </div>

                <template v-if="addedCards[theme.songId]">
                  <div class="added-info">
                    <div class="added-actions">
                      <span class="added-badge">Added</span>
                      <button type="button" class="preview-btn" @click="previewCard = addedCards[theme.songId]">
                        Preview
                      </button>
                      <button type="button" class="remove-btn" @click="removeCard(theme.songId)">Delete</button>
                    </div>
                    <div v-if="hasAnyDownloadableSource(addedCards[theme.songId])" class="download-section">
                      <div v-if="hasDefaultDownloadFolder" class="download-actions">
                        <template v-if="canDownload(addedCards[theme.songId], 'video')">
                          <div v-if="downloading[downloadKey(theme.songId, 'video')]" class="download-progress">
                            <div class="download-progress-bar">
                              <span :style="{ width: progressPercent(theme.songId, 'video') + '%' }" />
                            </div>
                            <span class="download-progress-label">{{
                              formatDownloadProgress(downloadProgress[downloadKey(theme.songId, "video")])
                            }}</span>
                          </div>
                          <button
                            v-else
                            type="button"
                            class="download-btn"
                            @click="downloadMedia(theme.songId, 'video')"
                          >
                            Download video
                          </button>
                        </template>
                        <template v-if="canDownload(addedCards[theme.songId], 'audio')">
                          <div v-if="downloading[downloadKey(theme.songId, 'audio')]" class="download-progress">
                            <div class="download-progress-bar">
                              <span :style="{ width: progressPercent(theme.songId, 'audio') + '%' }" />
                            </div>
                            <span class="download-progress-label">{{
                              formatDownloadProgress(downloadProgress[downloadKey(theme.songId, "audio")])
                            }}</span>
                          </div>
                          <button
                            v-else
                            type="button"
                            class="download-btn"
                            @click="downloadMedia(theme.songId, 'audio')"
                          >
                            Download audio
                          </button>
                        </template>
                      </div>
                      <p v-else class="download-hint">
                        Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
                      </p>
                      <p v-if="downloadError[theme.songId]" class="inline-error">{{ downloadError[theme.songId] }}</p>
                    </div>
                    <p v-if="addError[theme.songId]" class="inline-error">{{ addError[theme.songId] }}</p>
                  </div>
                </template>
                <template v-else>
                  <div class="theme-actions">
                    <button type="button" class="add-btn" :disabled="adding[theme.songId]" @click="addCard(theme)">
                      Add
                    </button>
                  </div>
                  <p v-if="addError[theme.songId]" class="inline-error">{{ addError[theme.songId] }}</p>
                </template>
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="state">No themes found for {{ selectedArtist.artistName }} on animethemes.moe.</p>
      </div>
    </template>

    <template v-else-if="searchMode === 'song'">
      <form class="search-form" @submit.prevent="songSearch">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search song title..."
          :disabled="songSearching"
          class="search-input"
        />
        <button type="submit" class="search-btn" :disabled="songSearching">Search</button>
      </form>
      <p v-if="songSearchError" class="inline-error">{{ songSearchError }}</p>

      <div v-if="songSearching" class="state">Searching...</div>
      <template v-else-if="songSearchResults">
        <ul v-if="songSearchResults.length" class="theme-list">
          <li v-for="result in songSearchResults" :key="result.animethemesThemeId" class="theme-row">
            <div class="theme-info">
              <span class="theme-title">{{ result.songTitle ?? result.themeSlot }}</span>
              <span class="result-meta">
                {{ result.artistName ?? "Unknown artist" }} - {{ result.animeTitleRomaji }} ({{ result.themeSlot }})
              </span>
            </div>

            <template v-if="addedSongCard(result.animethemesThemeId)">
              <div class="added-info">
                <div class="added-actions">
                  <span class="added-badge">Added</span>
                  <button type="button" class="preview-btn" @click="previewCard = addedSongCard(result.animethemesThemeId)!">
                    Preview
                  </button>
                  <button type="button" class="remove-btn" @click="removeCard(resolvedSongId(result.animethemesThemeId)!)">
                    Delete
                  </button>
                </div>
                <div
                  v-if="hasAnyDownloadableSource(addedSongCard(result.animethemesThemeId)!)"
                  class="download-section"
                >
                  <div v-if="hasDefaultDownloadFolder" class="download-actions">
                    <template v-if="canDownload(addedSongCard(result.animethemesThemeId)!, 'video')">
                      <div
                        v-if="downloading[downloadKey(resolvedSongId(result.animethemesThemeId)!, 'video')]"
                        class="download-progress"
                      >
                        <div class="download-progress-bar">
                          <span
                            :style="{ width: progressPercent(resolvedSongId(result.animethemesThemeId)!, 'video') + '%' }"
                          />
                        </div>
                        <span class="download-progress-label">{{
                          formatDownloadProgress(
                            downloadProgress[downloadKey(resolvedSongId(result.animethemesThemeId)!, "video")],
                          )
                        }}</span>
                      </div>
                      <button
                        v-else
                        type="button"
                        class="download-btn"
                        @click="downloadMedia(resolvedSongId(result.animethemesThemeId)!, 'video')"
                      >
                        Download video
                      </button>
                    </template>
                    <template v-if="canDownload(addedSongCard(result.animethemesThemeId)!, 'audio')">
                      <div
                        v-if="downloading[downloadKey(resolvedSongId(result.animethemesThemeId)!, 'audio')]"
                        class="download-progress"
                      >
                        <div class="download-progress-bar">
                          <span
                            :style="{ width: progressPercent(resolvedSongId(result.animethemesThemeId)!, 'audio') + '%' }"
                          />
                        </div>
                        <span class="download-progress-label">{{
                          formatDownloadProgress(
                            downloadProgress[downloadKey(resolvedSongId(result.animethemesThemeId)!, "audio")],
                          )
                        }}</span>
                      </div>
                      <button
                        v-else
                        type="button"
                        class="download-btn"
                        @click="downloadMedia(resolvedSongId(result.animethemesThemeId)!, 'audio')"
                      >
                        Download audio
                      </button>
                    </template>
                  </div>
                  <p v-else class="download-hint">
                    Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
                  </p>
                  <p v-if="downloadError[resolvedSongId(result.animethemesThemeId)!]" class="inline-error">
                    {{ downloadError[resolvedSongId(result.animethemesThemeId)!] }}
                  </p>
                </div>
                <p v-if="addError[resolvedSongId(result.animethemesThemeId)!]" class="inline-error">
                  {{ addError[resolvedSongId(result.animethemesThemeId)!] }}
                </p>
              </div>
            </template>
            <template v-else>
              <div class="theme-actions">
                <button
                  type="button"
                  class="add-btn"
                  :disabled="songAdding[result.animethemesThemeId]"
                  @click="addSongResult(result)"
                >
                  {{ songAdding[result.animethemesThemeId] ? "Adding..." : "Add" }}
                </button>
              </div>
              <p v-if="songAddError[result.animethemesThemeId]" class="inline-error">
                {{ songAddError[result.animethemesThemeId] }}
              </p>
            </template>
          </li>
        </ul>
        <p v-else class="state">No songs found for "{{ searchQuery }}".</p>
      </template>
    </template>

    <div v-if="selectedAnime" class="themes-section">
      <h2>{{ selectedAnime.anime.titleEnglish }}</h2>
      <p v-if="!selectedAnime.themes.length" class="state">No themes found for this anime on animethemes.moe.</p>
      <ul v-else class="theme-list">
        <li v-for="theme in selectedAnime.themes" :key="theme.songId" class="theme-row">
          <div class="theme-info">
            <span class="theme-title">{{ theme.songTitle }}</span>
            <span class="result-meta">{{ theme.artistName }} - {{ theme.themeSlot }}</span>
          </div>

          <template v-if="addedCards[theme.songId]">
            <div class="added-info">
              <div class="added-actions">
                <span class="added-badge">Added</span>
                <button type="button" class="preview-btn" @click="previewCard = addedCards[theme.songId]">
                  Preview
                </button>
                <button type="button" class="remove-btn" @click="removeCard(theme.songId)">Delete</button>
              </div>
              <div v-if="hasAnyDownloadableSource(addedCards[theme.songId])" class="download-section">
                <div v-if="hasDefaultDownloadFolder" class="download-actions">
                  <template v-if="canDownload(addedCards[theme.songId], 'video')">
                    <div v-if="downloading[downloadKey(theme.songId, 'video')]" class="download-progress">
                      <div class="download-progress-bar">
                        <span :style="{ width: progressPercent(theme.songId, 'video') + '%' }" />
                      </div>
                      <span class="download-progress-label">{{
                        formatDownloadProgress(downloadProgress[downloadKey(theme.songId, "video")])
                      }}</span>
                    </div>
                    <button v-else type="button" class="download-btn" @click="downloadMedia(theme.songId, 'video')">
                      Download video
                    </button>
                  </template>
                  <template v-if="canDownload(addedCards[theme.songId], 'audio')">
                    <div v-if="downloading[downloadKey(theme.songId, 'audio')]" class="download-progress">
                      <div class="download-progress-bar">
                        <span :style="{ width: progressPercent(theme.songId, 'audio') + '%' }" />
                      </div>
                      <span class="download-progress-label">{{
                        formatDownloadProgress(downloadProgress[downloadKey(theme.songId, "audio")])
                      }}</span>
                    </div>
                    <button v-else type="button" class="download-btn" @click="downloadMedia(theme.songId, 'audio')">
                      Download audio
                    </button>
                  </template>
                </div>
                <p v-else class="download-hint">
                  Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
                </p>
                <p v-if="downloadError[theme.songId]" class="inline-error">{{ downloadError[theme.songId] }}</p>
              </div>
              <p v-if="addError[theme.songId]" class="inline-error">{{ addError[theme.songId] }}</p>
            </div>
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

    <CardPreviewModal
      :card="previewCard"
      :open="previewCard !== null"
      :has-default-download-folder="hasDefaultDownloadFolder"
      :audio-only="audioOnly"
      @close="previewCard = null"
      @updated="onPreviewCardUpdated"
    />
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

.toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.toggle-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.toggle-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
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

.bulk-actions {
  display: flex;
  gap: 10px;
  margin: 0 0 20px;
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

.added-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.added-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.added-badge {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--pass);
  color: var(--pass-ink);
  font-size: 13px;
  font-weight: 700;
}

.preview-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.remove-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.download-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.download-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.download-btn {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.download-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.download-progress-bar {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  overflow: hidden;
}

.download-progress-bar > span {
  display: block;
  height: 100%;
  background: var(--accent-secondary);
  transition: width 0.15s ease;
}

.download-progress-label {
  flex: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  min-width: 34px;
  text-align: right;
}

.download-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  text-align: right;
}

.download-hint a {
  color: var(--accent);
}
</style>
