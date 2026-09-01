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
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
}

const props = defineProps<{ open: boolean; target: AniListResult | null; deckId: number | null }>();
const emit = defineEmits<{ close: [] }>();

const importResult = ref<ImportResult | null>(null);
const importing = ref(false);
const importError = ref<string | null>(null);

const adding = reactive<Record<number, boolean>>({});
const addError = reactive<Record<number, string | null>>({});
const attachError = reactive<Record<number, string | null>>({});
const addedCards = reactive<Record<number, CardWithDetails>>({});

const { data: mediaLibraryData } = await useFetch<{ libraryPaths: string[]; defaultDownloadFolder: string | null }>(
  "/api/media-library",
);
const hasDefaultDownloadFolder = computed(() => Boolean(mediaLibraryData.value?.defaultDownloadFolder));

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

async function runImport(aniListId: number) {
  importResult.value = null;
  importError.value = null;
  importing.value = true;
  try {
    importResult.value = await $fetch<ImportResult>("/api/lookup/import", {
      method: "POST",
      body: { aniListId },
    });
  } catch (err) {
    importError.value = extractErrorMessage(err, "Import failed.");
  } finally {
    importing.value = false;
  }
}

watch(
  () => props.target,
  (target) => {
    if (target) runImport(target.aniListId);
  },
  { immediate: true },
);

async function addTheme(theme: ThemeResult) {
  if (props.deckId === null) return;

  addError[theme.songId] = null;
  attachError[theme.songId] = null;
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

    try {
      await $fetch("/api/decks/cards", { method: "POST", body: { deckId: props.deckId, cardId: res.card.id } });
    } catch (err) {
      attachError[theme.songId] = extractErrorMessage(err, "Card added, but couldn't add it to the deck.");
    }
  } catch (err) {
    addError[theme.songId] = extractErrorMessage(err, "Failed to add card.");
  } finally {
    adding[theme.songId] = false;
  }
}

function resetState() {
  importResult.value = null;
  importError.value = null;
  importing.value = false;
  for (const key of Object.keys(adding)) delete adding[Number(key)];
  for (const key of Object.keys(addError)) delete addError[Number(key)];
  for (const key of Object.keys(attachError)) delete attachError[Number(key)];
  for (const key of Object.keys(addedCards)) delete addedCards[Number(key)];
  for (const key of Object.keys(downloading)) delete downloading[key];
  for (const key of Object.keys(downloadProgress)) delete downloadProgress[key];
  for (const key of Object.keys(downloadError)) delete downloadError[key];
}

watch(
  () => props.open,
  (open) => {
    if (!open) resetState();
  },
);

function close() {
  emit("close");
}

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (event.key === "Escape") close();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="close">
    <div class="panel">
      <button type="button" class="close-btn" aria-label="Close" @click="close">✕</button>

      <h2>{{ target?.titleRomaji }}</h2>
      <p v-if="target?.titleEnglish && target.titleEnglish !== target.titleRomaji" class="subtitle">
        {{ target.titleEnglish }}
      </p>

      <div v-if="importing" class="state">Loading themes...</div>
      <p v-if="importError" class="inline-error">{{ importError }}</p>

      <ul v-if="importResult" class="theme-list">
        <li v-if="!importResult.themes.length" class="state">No themes found for this anime on animethemes.moe.</li>
        <li v-for="theme in importResult.themes" :key="theme.songId" class="theme-row">
          <div class="theme-info">
            <span class="theme-title">{{ theme.songTitle }}</span>
            <span class="theme-meta">{{ theme.artistName }} - {{ theme.themeSlot }}</span>
          </div>

          <template v-if="addedCards[theme.songId]">
            <div class="added-info">
              <span v-if="!attachError[theme.songId]" class="added-badge">Added</span>
              <p v-else class="inline-error attach-error">{{ attachError[theme.songId] }}</p>

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
            </div>
          </template>
          <template v-else>
            <div class="theme-actions">
              <button type="button" class="add-btn" :disabled="adding[theme.songId]" @click="addTheme(theme)">
                {{ adding[theme.songId] ? "Adding..." : "Add" }}
              </button>
            </div>
            <p v-if="addError[theme.songId]" class="inline-error">{{ addError[theme.songId] }}</p>
          </template>
        </li>
      </ul>

      <div class="modal-actions">
        <button type="button" class="cancel-btn" @click="close">Cancel</button>
        <button type="button" class="done-btn" @click="close">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 6, 15, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}

.panel {
  position: relative;
  width: 100%;
  max-width: 520px;
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

h2 {
  margin: 0 24px 0 0;
  font-size: 20px;
  font-weight: 800;
}

.subtitle {
  margin: -8px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.state {
  margin: 0;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.inline-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}

.attach-error {
  text-align: right;
  max-width: 200px;
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  flex-wrap: wrap;
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
  display: flex;
  gap: 8px;
  align-items: center;
}

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

.add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.added-badge {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--pass);
  color: var(--pass-ink);
  font-size: 13px;
  font-weight: 700;
}

.added-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
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
