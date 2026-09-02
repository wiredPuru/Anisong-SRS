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
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

interface ManualDeck {
  id: number;
  name: string;
  createdAt: string;
  cardCount: number;
}

const searchInput = ref("");
const searchQuery = ref("");
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchQuery.value = searchInput.value.trim();
  }, 250);
}

const cards = ref<CardWithDetails[]>([]);
const initialPending = ref(true);
const initialError = ref(false);
const nextPage = ref(1);
const totalPages = ref(1);
const loadingMore = ref(false);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

async function loadFirstPage() {
  initialPending.value = true;
  initialError.value = false;
  try {
    const res = await $fetch<{ cards: CardWithDetails[]; page: number; totalPages: number }>("/api/cards", {
      query: { page: 1, q: searchQuery.value || undefined },
    });
    cards.value = res.cards;
    nextPage.value = 2;
    totalPages.value = res.totalPages;
  } catch {
    initialError.value = true;
  } finally {
    initialPending.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value || nextPage.value > totalPages.value) return;
  loadingMore.value = true;
  try {
    const res = await $fetch<{ cards: CardWithDetails[]; page: number; totalPages: number }>("/api/cards", {
      query: { page: nextPage.value, q: searchQuery.value || undefined },
    });
    cards.value.push(...res.cards);
    nextPage.value += 1;
    totalPages.value = res.totalPages;
  } finally {
    loadingMore.value = false;
  }
}

function replaceCard(updated: CardWithDetails) {
  const idx = cards.value.findIndex((c) => c.id === updated.id);
  if (idx !== -1) cards.value[idx] = updated;
}

watch(searchQuery, () => {
  loadFirstPage();
});

watch(sentinelRef, (el, oldEl) => {
  if (oldEl) observer?.unobserve(oldEl);
  if (el) observer?.observe(el);
});

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) loadMore();
  });
  loadFirstPage();
});

onUnmounted(() => {
  observer?.disconnect();
});

const { data: mediaLibraryData } = await useFetch<{
  libraryPaths: string[];
  defaultDownloadFolder: string | null;
  playbackMode: "auto" | "audioOnly";
}>("/api/media-library");
const hasDefaultDownloadFolder = computed(() => Boolean(mediaLibraryData.value?.defaultDownloadFolder));
const audioOnly = computed(() => mediaLibraryData.value?.playbackMode === "audioOnly");

const { data: manualDecksData } = await useFetch<{ decks: ManualDeck[] }>("/api/decks", {
  query: { type: "created" },
});
const manualDecks = computed(() => manualDecksData.value?.decks ?? []);

const { data: membershipsData, refresh: refreshMemberships } = await useFetch<{
  memberships: Record<number, number[]>;
}>("/api/decks/memberships");

const openDecksPanelId = ref<number | null>(null);
const togglingMembership = reactive<Record<string, boolean>>({});
const deckToggleError = ref<string | null>(null);

async function toggleDeckMembership(cardId: number, deckId: number, checked: boolean) {
  const key = `${cardId}-${deckId}`;
  deckToggleError.value = null;
  togglingMembership[key] = true;
  try {
    await $fetch("/api/decks/cards", {
      method: checked ? "POST" : "DELETE",
      body: { deckId, cardId },
    });
  } catch (err) {
    deckToggleError.value = extractErrorMessage(err, "Failed to update deck membership.");
  } finally {
    await refreshMemberships();
    togglingMembership[key] = false;
  }
}

const editingId = ref<number | null>(null);
const editVideoPath = ref("");
const editAudioPath = ref("");
const editSaving = ref(false);
const editError = ref<string | null>(null);
const clearingField = reactive<Record<string, boolean>>({});
const removeCardError = reactive<Record<number, string | null>>({});

const previewCard = ref<CardWithDetails | null>(null);

const pendingCardPreview = useState<CardWithDetails | null>("pendingCardPreview", () => null);
watch(
  pendingCardPreview,
  (card) => {
    if (card) {
      previewCard.value = card;
      pendingCardPreview.value = null;
    }
  },
  { immediate: true },
);

const {
  downloading,
  downloadProgress,
  downloadError,
  downloadKey,
  canDownload,
  hasAnyDownloadableSource,
  downloadMedia: downloadMediaBase,
} = useCardDownloads();

async function downloadMedia(c: CardWithDetails, kind: "video" | "audio") {
  const updated = await downloadMediaBase<CardWithDetails>(c.id, c.id, kind);
  if (updated) {
    replaceCard(updated);
    if (editingId.value === c.id) {
      editVideoPath.value = updated.localVideoPath ?? "";
      editAudioPath.value = updated.localAudioPath ?? "";
    }
  }
}

function progressPercent(cardId: number, kind: "video" | "audio"): number {
  const progress = downloadProgress[downloadKey(cardId, kind)];
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}

function sourceBadges(c: CardWithDetails): string[] {
  const badges: string[] = [];
  if (c.localVideoPath) badges.push("Local video");
  if (c.localAudioPath) badges.push("Local audio");
  if (c.animethemesVideoUrl) badges.push("Remote video");
  if (c.animethemesAudioUrl) badges.push("Remote audio");
  return badges;
}

function startEdit(c: CardWithDetails) {
  editingId.value = c.id;
  editVideoPath.value = c.localVideoPath ?? "";
  editAudioPath.value = c.localAudioPath ?? "";
  editError.value = null;
}

function cancelEdit() {
  editingId.value = null;
  editError.value = null;
}

async function saveEdit(id: number) {
  editError.value = null;
  editSaving.value = true;
  try {
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", {
      method: "PATCH",
      body: {
        id,
        localVideoPath: editVideoPath.value.trim() === "" ? null : editVideoPath.value.trim(),
        localAudioPath: editAudioPath.value.trim() === "" ? null : editAudioPath.value.trim(),
      },
    });
    editingId.value = null;
    replaceCard(result.card);
  } catch (err) {
    editError.value = extractErrorMessage(err, "Failed to update card.");
  } finally {
    editSaving.value = false;
  }
}

async function clearLocalPath(c: CardWithDetails, kind: "video" | "audio") {
  const key = `${c.id}-${kind}`;
  editError.value = null;
  clearingField[key] = true;
  try {
    const body = kind === "video" ? { id: c.id, localVideoPath: null } : { id: c.id, localAudioPath: null };
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", { method: "PATCH", body });
    if (kind === "video") editVideoPath.value = "";
    else editAudioPath.value = "";
    replaceCard(result.card);
  } catch (err) {
    editError.value = extractErrorMessage(err, "Failed to clear local file.");
  } finally {
    clearingField[key] = false;
  }
}

async function removeCard(id: number) {
  removeCardError[id] = null;
  try {
    await $fetch("/api/cards", { method: "DELETE", body: { id } });
    cards.value = cards.value.filter((c) => c.id !== id);
  } catch (err) {
    removeCardError[id] = extractErrorMessage(err, "Failed to delete card.");
  }
}

async function onPreviewCardUpdated(updated: CardWithDetails) {
  previewCard.value = updated;
  replaceCard(updated);
}
</script>

<template>
  <main class="cards">
    <div class="header-row">
      <h1>Cards</h1>
      <NuxtLink to="/cards/new" class="add-link">Add card</NuxtLink>
    </div>
    <p class="hint">Flashcards built from looked-up anime songs.</p>

    <input
      v-model="searchInput"
      type="text"
      placeholder="Search by song, artist, or anime title..."
      class="search-input"
      @input="onSearchInput"
    />

    <div v-if="initialPending" class="state">Loading...</div>
    <div v-else-if="initialError" class="state state-error">Couldn't load cards. Try refreshing.</div>
    <template v-else>
      <ul v-if="cards.length" class="card-list">
        <li v-for="c in cards" :key="c.id" class="card-row">
          <img v-if="c.animeCoverImageUrl" :src="c.animeCoverImageUrl" alt="" class="cover-thumb" />
          <div class="card-info">
            <span class="song-title">{{ c.songTitle }}</span>
            <span class="meta">{{ c.artistName }} - {{ c.animeTitleEnglish }} ({{ c.themeSlot }})</span>
            <div class="badges">
              <span v-for="badge in sourceBadges(c)" :key="badge" class="badge">{{ badge }}</span>
              <span v-if="!sourceBadges(c).length" class="badge badge-none">No source</span>
            </div>
            <div v-if="hasAnyDownloadableSource(c)" class="download-section">
              <div v-if="hasDefaultDownloadFolder" class="download-actions">
                <template v-if="canDownload(c, 'video')">
                  <div v-if="downloading[downloadKey(c.id, 'video')]" class="download-progress">
                    <div class="download-progress-bar">
                      <span :style="{ width: progressPercent(c.id, 'video') + '%' }" />
                    </div>
                    <span class="download-progress-label">{{
                      formatDownloadProgress(downloadProgress[downloadKey(c.id, "video")])
                    }}</span>
                  </div>
                  <button v-else type="button" class="download-btn" @click="downloadMedia(c, 'video')">
                    Download video
                  </button>
                </template>
                <template v-if="canDownload(c, 'audio')">
                  <div v-if="downloading[downloadKey(c.id, 'audio')]" class="download-progress">
                    <div class="download-progress-bar">
                      <span :style="{ width: progressPercent(c.id, 'audio') + '%' }" />
                    </div>
                    <span class="download-progress-label">{{
                      formatDownloadProgress(downloadProgress[downloadKey(c.id, "audio")])
                    }}</span>
                  </div>
                  <button v-else type="button" class="download-btn" @click="downloadMedia(c, 'audio')">
                    Download audio
                  </button>
                </template>
              </div>
              <p v-else class="download-hint">
                Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
              </p>
              <p v-if="downloadError[c.id]" class="edit-error">{{ downloadError[c.id] }}</p>
            </div>

            <DeckMembershipPanel
              v-if="openDecksPanelId === c.id && editingId !== c.id"
              :card-id="c.id"
              :decks="manualDecks"
              :memberships="membershipsData?.memberships ?? {}"
              :toggling="togglingMembership"
              :error="deckToggleError"
              @toggle="(deckId, checked) => toggleDeckMembership(c.id, deckId, checked)"
            />
          </div>

          <template v-if="editingId === c.id">
            <div class="edit-form">
              <div class="path-row">
                <input
                  v-model="editVideoPath"
                  type="text"
                  placeholder="Local video path (blank to clear)"
                  :disabled="editSaving"
                  class="path-input"
                />
                <button
                  type="button"
                  class="clear-btn"
                  :disabled="!c.localVideoPath || editSaving || clearingField[`${c.id}-video`]"
                  @click="clearLocalPath(c, 'video')"
                >
                  {{ clearingField[`${c.id}-video`] ? "Clearing..." : "Clear" }}
                </button>
              </div>
              <div class="path-row">
                <input
                  v-model="editAudioPath"
                  type="text"
                  placeholder="Local audio path (blank to clear)"
                  :disabled="editSaving"
                  class="path-input"
                />
                <button
                  type="button"
                  class="clear-btn"
                  :disabled="!c.localAudioPath || editSaving || clearingField[`${c.id}-audio`]"
                  @click="clearLocalPath(c, 'audio')"
                >
                  {{ clearingField[`${c.id}-audio`] ? "Clearing..." : "Clear" }}
                </button>
              </div>
              <DeckMembershipPanel
                :card-id="c.id"
                :decks="manualDecks"
                :memberships="membershipsData?.memberships ?? {}"
                :toggling="togglingMembership"
                :error="deckToggleError"
                @toggle="(deckId, checked) => toggleDeckMembership(c.id, deckId, checked)"
              />
              <div class="edit-actions">
                <button type="button" class="save-btn" :disabled="editSaving" @click="saveEdit(c.id)">Save</button>
                <button type="button" class="cancel-btn" :disabled="editSaving" @click="cancelEdit">Cancel</button>
              </div>
              <p v-if="editError" class="edit-error">{{ editError }}</p>
            </div>
          </template>
          <div v-else class="card-actions">
            <button
              v-if="sourceBadges(c).length"
              type="button"
              class="preview-btn"
              @click="previewCard = c"
            >
              Preview
            </button>
            <button
              type="button"
              class="edit-btn"
              @click="openDecksPanelId = openDecksPanelId === c.id ? null : c.id"
            >
              Decks
            </button>
            <button type="button" class="edit-btn" @click="startEdit(c)">Edit</button>
            <button type="button" class="remove-btn" @click="removeCard(c.id)">Delete</button>
            <p v-if="removeCardError[c.id]" class="edit-error card-actions-error">{{ removeCardError[c.id] }}</p>
          </div>
        </li>
      </ul>
      <p v-else-if="searchQuery" class="state">No cards match "{{ searchQuery }}".</p>
      <p v-else class="state">No cards yet. <NuxtLink to="/cards/new">Add one</NuxtLink>.</p>
      <div v-if="cards.length" ref="sentinelRef" class="scroll-sentinel">
        <span v-if="loadingMore" class="loading-more">Loading more...</span>
      </div>
    </template>

    <CardAddAnimeResults
      :query="searchQuery"
      :has-default-download-folder="hasDefaultDownloadFolder"
      @refresh="loadFirstPage"
      @preview="(card) => (previewCard = card)"
    />

    <CardAddSongResults
      :query="searchQuery"
      :has-default-download-folder="hasDefaultDownloadFolder"
      @refresh="loadFirstPage"
      @preview="(card) => (previewCard = card)"
    />

    <CardAddArtistResults
      :query="searchQuery"
      :has-default-download-folder="hasDefaultDownloadFolder"
      :preview-active="previewCard !== null"
      @refresh="loadFirstPage"
      @preview="(card) => (previewCard = card)"
    />

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
.cards {
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

.add-link {
  flex: none;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 800;
  text-decoration: none;
}

.hint {
  margin: 0 0 24px;
  color: var(--muted);
}

.search-input {
  display: block;
  width: 100%;
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.state a {
  color: var(--accent);
}

.state-error {
  color: var(--fail);
  border-color: var(--fail);
}

.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scroll-sentinel {
  display: flex;
  justify-content: center;
  padding: 20px 0 4px;
  min-height: 1px;
}

.loading-more {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.card-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.cover-thumb {
  flex: none;
  width: 48px;
  height: 68px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--surface-raised);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.song-title {
  font-weight: 700;
}

.meta {
  color: var(--muted);
  font-size: 14px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.badge {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  color: var(--accent-secondary-ink);
  font-size: 12px;
  font-weight: 700;
}

.badge-none {
  background: var(--fail);
  color: var(--fail-ink);
}

.card-actions {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-actions-error {
  flex-basis: 100%;
}

.preview-btn,
.edit-btn,
.save-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.remove-btn,
.cancel-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.save-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
}

.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.clear-btn {
  flex: none;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.clear-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.edit-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}

.download-section {
  margin-top: 6px;
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
}

.download-hint a {
  color: var(--accent);
}
</style>
