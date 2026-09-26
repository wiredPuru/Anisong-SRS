<script setup lang="ts">
import type { BulkStep } from "../../composables/useBulkMediaProgress";

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
  clipBlocked: boolean;
  noAnimethemesMatch: boolean;
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

const results = ref<AniListResult[] | null>(null);
const searching = ref(false);
const searchError = ref<string | null>(null);
let generation = 0;

const expandedAniListId = ref<number | null>(null);
const selectedAnime = ref<ImportResult | null>(null);
const importing = ref(false);
const importRequests = createLatestRequest();
onScopeDispose(importRequests.invalidate);
const importError = ref<string | null>(null);

const addedCards = reactive<Record<number, CardWithDetails>>({});
const adding = reactive<Record<number, boolean>>({});
const addError = reactive<Record<number, string | null>>({});
const localPathInput = reactive<Record<number, string>>({});

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
    const res = await $fetch<{ results: AniListResult[] }>("/api/lookup/anilist-search", { query: { q } });
    if (gen !== generation) return;
    results.value = res.results;
  } catch (err) {
    if (gen !== generation) return;
    searchError.value = extractErrorMessage(err, "Anime search failed.");
  } finally {
    if (gen === generation) searching.value = false;
  }
}

watch(() => props.query, runSearch, { immediate: true });

async function preloadAddedCards(songIds: number[], isCurrent: () => boolean) {
  if (!songIds.length) return;
  try {
    const res = await $fetch<{ cards: CardWithDetails[] }>("/api/cards/by-songs", {
      query: { songIds: songIds.join(",") },
    });
    if (!isCurrent()) return;
    for (const c of res.cards) addedCards[c.songId] = c;
  } catch {
    // Best-effort UX nicety; the server-side duplicate check still applies on Add.
  }
}

async function toggleExpand(result: AniListResult) {
  const isCurrent = importRequests.start();
  addAllProgress.reset();
  downloadAllProgress.reset();
  if (expandedAniListId.value === result.aniListId) {
    expandedAniListId.value = null;
    selectedAnime.value = null;
    importing.value = false;
    return;
  }

  expandedAniListId.value = result.aniListId;
  selectedAnime.value = null;
  importing.value = true;
  importError.value = null;

  try {
    const res = await $fetch<ImportResult>("/api/lookup/import", {
      method: "POST",
      body: { aniListId: result.aniListId },
    });
    if (!isCurrent()) return;
    selectedAnime.value = res;
    await preloadAddedCards(res.themes.map((theme) => theme.songId), isCurrent);
  } catch (err) {
    if (isCurrent()) importError.value = extractErrorMessage(err, "Import failed.");
  } finally {
    if (isCurrent()) importing.value = false;
  }
}

async function downloadMedia(songId: number, kind: "video" | "audio") {
  const card = addedCards[songId];
  if (!card) return;

  const updated = await downloadMediaBase<CardWithDetails>(songId, card.id, kind);
  if (updated) addedCards[songId] = updated;
}

const downloadAllProgress = useBulkMediaProgress();

function hasDownloadableAdded(): boolean {
  if (!selectedAnime.value) return false;
  return selectedAnime.value.themes.some((theme) => {
    const card = addedCards[theme.songId];
    return card ? hasAnyDownloadableSource(card) : false;
  });
}

async function downloadAllMedia() {
  if (!selectedAnime.value) return;

  const steps: BulkStep[] = [];
  for (const theme of selectedAnime.value.themes) {
    const card = addedCards[theme.songId];
    if (!card) continue;
    if (canDownload(card, "video")) {
      steps.push({
        label: `${theme.songTitle} (video)`,
        run: async () => {
          await downloadMedia(theme.songId, "video");
          return !downloadError[theme.songId];
        },
      });
    }
    if (canDownload(card, "audio")) {
      steps.push({
        label: `${theme.songTitle} (audio)`,
        run: async () => {
          await downloadMedia(theme.songId, "audio");
          return !downloadError[theme.songId];
        },
      });
    }
  }
  await downloadAllProgress.runSteps(steps);
}

const addAllProgress = useBulkMediaProgress();

async function addAllThemes() {
  if (!selectedAnime.value) return;

  const steps: BulkStep[] = [];
  for (const theme of selectedAnime.value.themes) {
    if (addedCards[theme.songId] || theme.noAnimethemesMatch) continue;
    steps.push({
      label: theme.songTitle,
      run: async () => {
        await addCard(theme);
        return !addError[theme.songId];
      },
    });
  }
  await addAllProgress.runSteps(steps);
}

async function addCard(theme: ThemeResult) {
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
    emit("refresh");
  } catch (err) {
    addError[theme.songId] = extractErrorMessage(err, "Failed to add card.");
  } finally {
    adding[theme.songId] = false;
  }
}

async function removeCard(songId: number) {
  const card = addedCards[songId];
  if (!card) return;

  addError[songId] = null;
  try {
    await $fetch("/api/cards", { method: "DELETE", body: { id: card.id } });
    delete addedCards[songId];
    emit("refresh");
  } catch (err) {
    addError[songId] = extractErrorMessage(err, "Failed to delete card.");
  }
}
</script>

<template>
  <div v-if="props.query.trim().length >= 2" class="add-anime-group">
    <h2 class="group-title">Anime</h2>
    <div v-if="searching" class="state">
      <ActivityStatus :request-key="props.query" label="Searching for anime" />
    </div>
    <p v-else-if="searchError" class="inline-error">{{ searchError }}</p>
    <template v-else-if="results">
      <ul v-if="results.length" class="result-list">
        <li v-for="result in results" :key="result.aniListId" class="result-row">
          <button type="button" class="result-toggle" @click="toggleExpand(result)">
            <span class="result-title">{{ result.titleRomaji }}</span>
            <span v-if="result.titleEnglish" class="result-meta">{{ result.titleEnglish }}</span>
          </button>

          <div v-if="expandedAniListId === result.aniListId" class="theme-picker">
            <div v-if="importing" class="state">
              <ActivityStatus :label="`Fetching themes for ${result.titleRomaji}`" :request-key="result.aniListId" />
            </div>
            <p v-else-if="importError" class="inline-error">{{ importError }}</p>
            <template v-else-if="selectedAnime">
              <p v-if="!selectedAnime.themes.length" class="state">
                No themes found for this anime on animethemes.moe.
              </p>
              <template v-else>
                <div class="bulk-actions">
                  <button type="button" class="add-btn" :disabled="addAllProgress.running.value" @click="addAllThemes">
                    {{ addAllProgress.running.value ? "Adding..." : "Add all" }}
                  </button>
                  <button
                    v-if="props.hasDefaultDownloadFolder && hasDownloadableAdded()"
                    type="button"
                    class="download-btn"
                    :disabled="downloadAllProgress.running.value"
                    @click="downloadAllMedia"
                  >
                    {{ downloadAllProgress.running.value ? "Downloading..." : "Download all" }}
                  </button>
                </div>
                <p v-if="addAllProgress.running.value" class="bulk-progress" role="status" aria-live="polite">
                  Adding {{ addAllProgress.progress.completed }} of {{ addAllProgress.progress.total }}<template v-if="addAllProgress.progress.current"> - {{ addAllProgress.progress.current }}</template>
                </p>
                <p v-else-if="addAllProgress.summary.value" class="bulk-summary">
                  Added {{ addAllProgress.summary.value.total - addAllProgress.summary.value.failed }} of {{ addAllProgress.summary.value.total }}<template v-if="addAllProgress.summary.value.failed"> ({{ addAllProgress.summary.value.failed }} failed)</template>
                </p>
                <p v-if="downloadAllProgress.running.value" class="bulk-progress" role="status" aria-live="polite">
                  Downloading {{ downloadAllProgress.progress.completed }} of {{ downloadAllProgress.progress.total }}<template v-if="downloadAllProgress.progress.current"> - {{ downloadAllProgress.progress.current }}</template>
                </p>
                <p v-else-if="downloadAllProgress.summary.value" class="bulk-summary">
                  Downloaded {{ downloadAllProgress.summary.value.total - downloadAllProgress.summary.value.failed }} of {{ downloadAllProgress.summary.value.total }}<template v-if="downloadAllProgress.summary.value.failed"> ({{ downloadAllProgress.summary.value.failed }} failed)</template>
                </p>
                <ul class="theme-list">
                <li v-for="theme in selectedAnime.themes" :key="theme.songId" class="theme-row">
                  <div class="theme-info">
                    <span class="theme-title">{{ theme.songTitle }}</span>
                    <span class="result-meta">{{ theme.artistName }} - {{ formatThemeSlotLabel(theme.themeSlot) }}</span>
                  </div>

                  <template v-if="addedCards[theme.songId]">
                    <div class="added-info">
                      <div class="added-actions">
                        <span class="added-badge">Added</span>
                        <button type="button" class="preview-btn" @click="emit('preview', addedCards[theme.songId]!)">
                          Preview
                        </button>
                        <button type="button" class="remove-btn" @click="removeCard(theme.songId)">Delete</button>
                      </div>
                      <div v-if="hasAnyDownloadableSource(addedCards[theme.songId]!)" class="download-section">
                        <div v-if="hasDefaultDownloadFolder" class="download-actions">
                          <template v-if="canDownload(addedCards[theme.songId]!, 'video')">
                            <DownloadProgress
                              v-if="downloading[downloadKey(theme.songId, 'video')]"
                              label="Downloading video"
                              :request-key="downloadKey(theme.songId, 'video')"
                              :progress="downloadProgress[downloadKey(theme.songId, 'video')]"
                            />
                            <button
                              v-else
                              type="button"
                              class="download-btn"
                              @click="downloadMedia(theme.songId, 'video')"
                            >
                              Download video
                            </button>
                          </template>
                          <template v-if="canDownload(addedCards[theme.songId]!, 'audio')">
                            <DownloadProgress
                              v-if="downloading[downloadKey(theme.songId, 'audio')]"
                              label="Downloading audio"
                              :request-key="downloadKey(theme.songId, 'audio')"
                              :progress="downloadProgress[downloadKey(theme.songId, 'audio')]"
                            />
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
                        <p v-if="downloadError[theme.songId]" class="inline-error">
                          {{ downloadError[theme.songId] }}
                        </p>
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
                        :disabled="adding[theme.songId] || theme.noAnimethemesMatch"
                        @click="addCard(theme)"
                      >
                        Add card
                      </button>
                    </div>
                    <p v-if="theme.noAnimethemesMatch" class="no-match-hint">
                      Not on AnimeThemes.moe, so it cannot be added.
                    </p>
                    <p v-if="theme.clipBlocked && !theme.noAnimethemesMatch" class="clip-blocked-hint">
                      No remote clip - blocked by your <NuxtLink to="/settings">Clip source setting</NuxtLink>. Add a local video path above instead.
                    </p>
                    <p v-if="addError[theme.songId]" class="inline-error">{{ addError[theme.songId] }}</p>
                  </template>
                </li>
                </ul>
              </template>
            </template>
          </div>
        </li>
      </ul>
      <p v-else class="state">No matching anime found.</p>
    </template>
  </div>
</template>

<style scoped>
.add-anime-group {
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

.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-row {
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
}

.result-toggle {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
}

.result-title {
  font-weight: 700;
}

.result-meta {
  color: var(--muted);
  font-size: 13px;
}

.theme-picker {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border);
}

.bulk-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.bulk-progress,
.bulk-summary {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.theme-list {
  list-style: none;
  margin: 8px 0 0;
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
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
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

.theme-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-input {
  min-width: 0;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
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

.download-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>
