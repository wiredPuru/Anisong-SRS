<script setup lang="ts">
interface SongSearchResult {
  resultKey: string;
  animethemesThemeId: number | null;
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  artistName: string | null;
  animeAniListId: number;
  animeAnimethemesId: number | null;
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
  clipBlocked: boolean;
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
  artistId: number;
  artistName: string;
  animeId: number;
  animeAniListId: number;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

const props = defineProps<{
  query: string;
  hasDefaultDownloadFolder: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  preview: [card: CardWithDetails];
}>();

const results = ref<SongSearchResult[] | null>(null);
const searching = ref(false);
const searchError = ref<string | null>(null);
let generation = 0;

const addedCards = reactive<Record<number, CardWithDetails>>({});
const adding = reactive<Record<string, boolean>>({});
const addError = reactive<Record<string, string | null>>({});
const resultSongId = reactive<Record<string, number>>({});
const noAnimethemesMatch = reactive<Record<string, boolean>>({});

const {
  downloading,
  downloadProgress,
  downloadError,
  downloadKey,
  canDownload,
  hasAnyDownloadableSource,
  downloadMedia: downloadMediaBase,
} = useCardDownloads();

async function runSearch(query: string) {
  const q = query.trim();
  const gen = ++generation;

  if (q.length < 2) {
    results.value = null;
    searchError.value = null;
    searching.value = false;
    return;
  }

  searching.value = true;
  searchError.value = null;

  try {
    const res = await $fetch<{ results: SongSearchResult[] }>("/api/lookup/song-search", { query: { q } });
    if (gen !== generation) return;
    results.value = res.results;
  } catch (err) {
    if (gen !== generation) return;
    searchError.value = extractErrorMessage(err, "Song search failed.");
  } finally {
    if (gen === generation) searching.value = false;
  }
}

watch(() => props.query, runSearch, { immediate: true });

function resolvedSongId(resultKey: string): number | undefined {
  return resultSongId[resultKey];
}

function addedSongCard(resultKey: string): CardWithDetails | undefined {
  const songId = resultSongId[resultKey];
  return songId !== undefined ? addedCards[songId] : undefined;
}

async function downloadMedia(songId: number, kind: "video" | "audio") {
  const card = addedCards[songId];
  if (!card) return;

  const updated = await downloadMediaBase<CardWithDetails>(songId, card.id, kind);
  if (updated) addedCards[songId] = updated;
}

function addSongRowClick(result: SongSearchResult) {
  if (addedSongCard(result.resultKey) || adding[result.resultKey] || result.clipBlocked || noAnimethemesMatch[result.resultKey]) return;
  addSongResult(result);
}

async function addSongResult(result: SongSearchResult) {
  const key = result.resultKey;
  addError[key] = null;
  adding[key] = true;

  try {
    const imported = await $fetch<{
      songId: number;
      videoUrl: string | null;
      audioUrl: string | null;
      existingCard: CardWithDetails | null;
      noAnimethemesMatch: boolean;
    }>("/api/lookup/song-import", { method: "POST", body: result });

    if (imported.noAnimethemesMatch) {
      noAnimethemesMatch[key] = true;
      return;
    }

    resultSongId[key] = imported.songId;

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
    emit("refresh");
  } catch (err) {
    addError[key] = extractErrorMessage(err, "Failed to add card.");
  } finally {
    adding[key] = false;
  }
}

async function removeCard(resultKey: string) {
  const songId = resultSongId[resultKey];
  const card = songId !== undefined ? addedCards[songId] : undefined;
  if (!card || songId === undefined) return;

  addError[resultKey] = null;
  try {
    await $fetch("/api/cards", { method: "DELETE", body: { id: card.id } });
    delete addedCards[songId];
    emit("refresh");
  } catch (err) {
    addError[resultKey] = extractErrorMessage(err, "Failed to delete card.");
  }
}
</script>

<template>
  <div v-if="props.query.trim().length >= 2" class="add-song-group">
    <h2 class="group-title">Songs</h2>
    <div v-if="searching" class="state">
      <ActivityStatus :request-key="props.query" label="Searching for songs" />
    </div>
    <p v-else-if="searchError" class="inline-error">{{ searchError }}</p>
    <template v-else-if="results">
      <ul v-if="results.length" class="theme-list">
        <li
          v-for="result in results"
          :key="result.resultKey"
          class="theme-row"
          :class="{ 'row-clickable': !addedSongCard(result.resultKey) && !result.clipBlocked && !noAnimethemesMatch[result.resultKey] }"
          @click="addSongRowClick(result)"
        >
          <div class="theme-info">
            <span class="theme-title">{{ result.songTitle ?? formatThemeSlotLabel(result.themeSlot) }}</span>
            <span class="result-meta">
              {{ result.artistName ?? "Unknown artist" }} - {{ result.animeTitleRomaji }} ({{ formatThemeSlotLabel(result.themeSlot) }})
            </span>
          </div>

          <template v-if="addedSongCard(result.resultKey)">
            <div class="added-info">
              <div class="added-actions">
                <span class="added-badge">Added</span>
                <button type="button" class="preview-btn" @click="emit('preview', addedSongCard(result.resultKey)!)">
                  Preview
                </button>
                <button type="button" class="remove-btn" @click="removeCard(result.resultKey)">Delete</button>
              </div>
              <div v-if="hasAnyDownloadableSource(addedSongCard(result.resultKey)!)" class="download-section">
                <div v-if="hasDefaultDownloadFolder" class="download-actions">
                  <template v-if="canDownload(addedSongCard(result.resultKey)!, 'video')">
                    <DownloadProgress
                      v-if="downloading[downloadKey(resolvedSongId(result.resultKey)!, 'video')]"
                      label="Downloading video"
                      :request-key="downloadKey(resolvedSongId(result.resultKey)!, 'video')"
                      :progress="downloadProgress[downloadKey(resolvedSongId(result.resultKey)!, 'video')]"
                    />
                    <button
                      v-else
                      type="button"
                      class="download-btn"
                      @click="downloadMedia(resolvedSongId(result.resultKey)!, 'video')"
                    >
                      Download video
                    </button>
                  </template>
                  <template v-if="canDownload(addedSongCard(result.resultKey)!, 'audio')">
                    <DownloadProgress
                      v-if="downloading[downloadKey(resolvedSongId(result.resultKey)!, 'audio')]"
                      label="Downloading audio"
                      :request-key="downloadKey(resolvedSongId(result.resultKey)!, 'audio')"
                      :progress="downloadProgress[downloadKey(resolvedSongId(result.resultKey)!, 'audio')]"
                    />
                    <button
                      v-else
                      type="button"
                      class="download-btn"
                      @click="downloadMedia(resolvedSongId(result.resultKey)!, 'audio')"
                    >
                      Download audio
                    </button>
                  </template>
                </div>
                <p v-else class="download-hint">
                  Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
                </p>
                <p v-if="downloadError[resolvedSongId(result.resultKey)!]" class="inline-error">
                  {{ downloadError[resolvedSongId(result.resultKey)!] }}
                </p>
              </div>
              <p v-if="addError[result.resultKey]" class="inline-error">
                {{ addError[result.resultKey] }}
              </p>
            </div>
          </template>
          <template v-else>
            <div class="theme-actions">
              <button
                type="button"
                class="add-btn"
                :disabled="adding[result.resultKey] || result.clipBlocked || noAnimethemesMatch[result.resultKey]"
                @click.stop="addSongResult(result)"
              >
                {{ adding[result.resultKey] ? "Adding..." : "Add" }}
              </button>
            </div>
            <p v-if="noAnimethemesMatch[result.resultKey]" class="no-match-hint">
              Not on AnimeThemes.moe, so it cannot be added.
            </p>
            <p v-else-if="result.clipBlocked" class="clip-blocked-hint">
              No clip allowed - blocked by your <NuxtLink to="/settings">Clip source setting</NuxtLink>.
            </p>
            <p v-if="addError[result.resultKey]" class="inline-error">
              {{ addError[result.resultKey] }}
            </p>
          </template>
        </li>
      </ul>
      <p v-else class="state">No matching songs found.</p>
    </template>
  </div>
</template>

<style scoped>
.add-song-group {
  margin-top: 24px;
}

.group-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 800;
  color: var(--muted);
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.inline-error {
  margin: 4px 0 0;
  color: var(--fail);
  font-size: 13px;
}

.theme-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.theme-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.theme-title {
  font-weight: 700;
}

.result-meta {
  color: var(--muted);
  font-size: 13px;
}

.theme-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-btn {
  flex: none;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clip-blocked-hint {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.clip-blocked-hint a {
  color: var(--accent);
}

.no-match-hint {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.added-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.added-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.added-badge {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  color: var(--accent-secondary-ink);
  font-size: 12px;
  font-weight: 700;
}

.preview-btn {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.remove-btn {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.download-section {
  margin-top: 2px;
}

.download-actions {
  display: flex;
  flex-wrap: wrap;
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

</style>
