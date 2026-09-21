<script setup lang="ts">
import type { BulkStep } from "../../composables/useBulkMediaProgress";

interface ArtistCandidate {
  source: "anisongdb" | "animethemes";
  id: number;
  name: string;
  slug: string | null;
}

interface ArtistThemeResult {
  songId: number;
  themeSlot: string;
  songTitle: string;
  videoUrl: string | null;
  audioUrl: string | null;
  clipBlocked: boolean;
  noAnimethemesMatch: boolean;
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
  unavailableAnimeCount: number;
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

const results = ref<ArtistCandidate[] | null>(null);
const searching = ref(false);
const searchError = ref<string | null>(null);
let generation = 0;

const modalOpen = ref(false);
const selectedArtist = ref<ArtistCandidate | null>(null);
const artistImport = ref<ArtistImportResult | null>(null);
const importing = ref(false);
const importRequests = createLatestRequest();
const catalogActivity = useImportProgress();
onScopeDispose(importRequests.invalidate);
const importError = ref<string | null>(null);

const addedCards = reactive<Record<number, CardWithDetails>>({});
const adding = reactive<Record<number, boolean>>({});
const addError = reactive<Record<number, string | null>>({});

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
    const res = await $fetch<{ results: ArtistCandidate[] }>("/api/lookup/artist-search", { query: { q } });
    if (gen !== generation) return;
    results.value = res.results;
  } catch (err) {
    if (gen !== generation) return;
    searchError.value = extractErrorMessage(err, "Artist search failed.");
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

async function openArtist(candidate: ArtistCandidate) {
  const isCurrent = importRequests.start();
  selectedArtist.value = candidate;
  modalOpen.value = true;
  artistImport.value = null;
  importError.value = null;
  importing.value = true;

  try {
    const res = await catalogActivity.run<ArtistImportResult>("/api/lookup/artist-import", { candidate });
    if (!isCurrent()) return;
    artistImport.value = res;
    await preloadAddedCards(res.animeGroups.flatMap((group) => group.themes.map((theme) => theme.songId)), isCurrent);
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

function addThemeRowClick(theme: ArtistThemeResult) {
  if (addedCards[theme.songId] || adding[theme.songId] || theme.clipBlocked || theme.noAnimethemesMatch) return;
  addTheme(theme);
}

async function addTheme(theme: ArtistThemeResult) {
  addError[theme.songId] = null;
  adding[theme.songId] = true;

  try {
    const res = await $fetch<{ card: CardWithDetails }>("/api/cards", {
      method: "POST",
      body: {
        songId: theme.songId,
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

const addAllProgress = useBulkMediaProgress();

async function addAllThemes() {
  if (!artistImport.value) return;

  const steps: BulkStep[] = [];
  for (const group of artistImport.value.animeGroups) {
    for (const theme of group.themes) {
      // A blocked or unmatched theme's row already shows it can't be added;
      // attempting it here would just report a predictable failure instead of
      // a skip.
      if (addedCards[theme.songId] || theme.clipBlocked || theme.noAnimethemesMatch) continue;
      steps.push({
        label: theme.songTitle,
        run: async () => {
          await addTheme(theme);
          return !addError[theme.songId];
        },
      });
    }
  }
  await addAllProgress.runSteps(steps);
}

const downloadAllProgress = useBulkMediaProgress();

function hasDownloadableAdded(): boolean {
  if (!artistImport.value) return false;
  return artistImport.value.animeGroups.some((group) =>
    group.themes.some((theme) => {
      const card = addedCards[theme.songId];
      return card ? hasAnyDownloadableSource(card) : false;
    }),
  );
}

async function downloadAllMedia() {
  if (!artistImport.value) return;

  const steps: BulkStep[] = [];
  for (const group of artistImport.value.animeGroups) {
    for (const theme of group.themes) {
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
  }
  await downloadAllProgress.runSteps(steps);
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

function resetModalState() {
  importRequests.invalidate();
  catalogActivity.cancel();
  selectedArtist.value = null;
  artistImport.value = null;
  importError.value = null;
  importing.value = false;
  addAllProgress.reset();
  downloadAllProgress.reset();
  for (const key of Object.keys(adding)) delete adding[Number(key)];
  for (const key of Object.keys(addError)) delete addError[Number(key)];
  for (const key of Object.keys(addedCards)) delete addedCards[Number(key)];
  for (const key of Object.keys(downloading)) delete downloading[key];
  for (const key of Object.keys(downloadProgress)) delete downloadProgress[key];
  for (const key of Object.keys(downloadError)) delete downloadError[key];
}

function closeModal() {
  modalOpen.value = false;
}

watch(modalOpen, (open) => {
  if (!open) resetModalState();
});

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (event.key === "Escape") closeModal();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="props.query.trim().length >= 2" class="add-artist-group">
    <h2 class="group-title">Artists</h2>
    <div v-if="searching" class="state">
      <ActivityStatus :request-key="props.query" label="Searching for artists" />
    </div>
    <p v-else-if="searchError" class="inline-error">{{ searchError }}</p>
    <template v-else-if="results">
      <ul v-if="results.length" class="result-list">
        <li v-for="result in results" :key="result.id" class="result-row">
          <button type="button" class="result-toggle" @click="openArtist(result)">
            <span class="result-title">{{ result.name }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="state">No matching artists found.</p>
    </template>
  </div>

  <div v-if="modalOpen" class="backdrop" @click.self="closeModal">
    <div class="panel">
      <button type="button" class="close-btn" aria-label="Close" @click="closeModal">✕</button>

      <h2>{{ selectedArtist?.name }}</h2>

      <div v-if="importing" class="state">
        <ActivityStatus
          :label="`Fetching catalog for ${selectedArtist?.name ?? 'artist'}`"
          :request-key="selectedArtist?.id"
          :progress="catalogActivity.progress.value"
          :revision="catalogActivity.revision.value"
        />
      </div>
      <p v-else-if="importError" class="inline-error">{{ importError }}</p>

      <template v-else-if="artistImport">
        <p v-if="artistImport.unavailableAnimeCount" class="inline-error">
          Metadata is temporarily unavailable for {{ artistImport.unavailableAnimeCount }} anime. Available results are shown below. Please try again later.
        </p>
        <p v-if="!artistImport.animeGroups.length" class="state">No importable anime found for this artist.</p>
        <div v-else class="anime-groups">
          <div class="bulk-actions">
            <button type="button" class="add-btn" :disabled="addAllProgress.running.value" @click="addAllThemes">
              {{ addAllProgress.running.value ? "Adding..." : "Add all" }}
            </button>
            <button
              v-if="hasDefaultDownloadFolder && hasDownloadableAdded()"
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
          <div v-for="group in artistImport.animeGroups" :key="group.anime.id" class="anime-group">
            <h3 class="anime-group-title">{{ group.anime.titleRomaji }}</h3>
            <p v-if="group.anime.titleEnglish && group.anime.titleEnglish !== group.anime.titleRomaji" class="subtitle">
              {{ group.anime.titleEnglish }}
            </p>

            <ul class="theme-list">
              <li
                v-for="theme in group.themes"
                :key="theme.songId"
                class="theme-row"
                :class="{ 'row-clickable': !addedCards[theme.songId] && !theme.clipBlocked && !theme.noAnimethemesMatch }"
                @click="addThemeRowClick(theme)"
              >
                <div class="theme-info">
                  <span class="theme-title">{{ theme.songTitle }}</span>
                  <span class="theme-meta">{{ theme.themeSlot }}</span>
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
                    <button
                      type="button"
                      class="add-btn"
                      :disabled="adding[theme.songId] || theme.clipBlocked || theme.noAnimethemesMatch"
                      @click.stop="addTheme(theme)"
                    >
                      {{ adding[theme.songId] ? "Adding..." : "Add" }}
                    </button>
                  </div>
                  <p v-if="theme.noAnimethemesMatch" class="no-match-hint">
                    Not on AnimeThemes.moe, so it cannot be added.
                  </p>
                  <p v-else-if="theme.clipBlocked" class="clip-blocked-hint">
                    No clip allowed - blocked by your <NuxtLink to="/settings">Clip source setting</NuxtLink>.
                  </p>
                  <p v-if="addError[theme.songId]" class="inline-error">{{ addError[theme.songId] }}</p>
                </template>
              </li>
            </ul>
          </div>
        </div>
      </template>

      <div class="modal-actions">
        <button type="button" class="cancel-btn" @click="closeModal">Cancel</button>
        <button type="button" class="done-btn" @click="closeModal">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-artist-group {
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

.backdrop {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: var(--z-modal);
}

.panel {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
}

.panel h2 {
  margin: 0 24px 0 0;
  font-size: 20px;
  font-weight: 800;
}

.subtitle {
  margin: -8px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.anime-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.bulk-actions {
  display: flex;
  gap: 10px;
}

.bulk-progress,
.bulk-summary {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.anime-group-title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
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

.theme-meta {
  color: var(--muted);
  font-size: 14px;
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

.download-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.cancel-btn,
.done-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}

.done-btn {
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
}
</style>
