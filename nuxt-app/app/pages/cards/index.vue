<script setup lang="ts">
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  notes: string | null;
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

const route = useRoute();

function applyQueryParam(raw: unknown) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const next = typeof value === "string" ? value : "";
  searchInput.value = next;
  searchQuery.value = next.trim();
}

// Seeded synchronously here, above the searchQuery watcher, so arriving at
// /cards?q=x loads once from onMounted rather than racing a second fetch.
// The watcher below covers navigating to /cards?q=x while already on /cards
// (the nav bar is on every page), which never remounts this component.
applyQueryParam(route.query.q);

watch(() => route.query.q, applyQueryParam);

const cards = ref<CardWithDetails[]>([]);
const initialPending = ref(true);
const initialError = ref(false);
const nextPage = ref(1);
const totalPages = ref(1);
const totalCards = ref(0);
const loadingMore = ref(false);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

async function loadFirstPage() {
  initialPending.value = true;
  initialError.value = false;
  try {
    const res = await $fetch<{ cards: CardWithDetails[]; page: number; totalPages: number; total: number }>("/api/cards", {
      query: { page: 1, q: searchQuery.value || undefined },
    });
    cards.value = res.cards;
    nextPage.value = 2;
    totalPages.value = res.totalPages;
    totalCards.value = res.total;
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
    const res = await $fetch<{ cards: CardWithDetails[]; page: number; totalPages: number; total: number }>("/api/cards", {
      query: { page: nextPage.value, q: searchQuery.value || undefined },
    });
    cards.value.push(...res.cards);
    nextPage.value += 1;
    totalPages.value = res.totalPages;
    totalCards.value = res.total;
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
const editNotes = ref("");
const editSaving = ref(false);
const editError = ref<string | null>(null);
const clearingField = reactive<Record<string, boolean>>({});
const removeCardError = reactive<Record<number, string | null>>({});

// The inspector rail's subject. Held as an id rather than the card object so
// a list refresh (edit, download, delete) re-resolves to the fresh row
// instead of pinning a stale copy.
const selectedId = ref<number | null>(null);
const selectedCard = computed(() => cards.value.find((c) => c.id === selectedId.value) ?? null);

// The inspector's own player state. Separate from anything the add-candidate
// preview modal does, and reset per card so expanding one card does not carry
// into the next selection.
const inspectorImmersive = ref(false);
watch(selectedId, () => {
  inspectorImmersive.value = false;
});

function onInspectorLocalPathUpdated({ kind, localPath }: { kind: "video" | "audio"; localPath: string }) {
  const current = selectedCard.value;
  if (!current) return;
  replaceCard({
    ...current,
    ...(kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath }),
  });
}

function selectCard(id: number) {
  selectedId.value = selectedId.value === id ? null : id;
}

// Shared by the nav bar's global search hand-off and the three add-candidate
// groups' "Preview" buttons - a card previewed from either path may not be on
// the currently loaded page, so it is spliced to the front instead of
// silently ignored. The inspector rail is the one preview surface for cards
// in the library; nothing on this page opens CardPreviewModal.
function previewInInspector(card: CardWithDetails) {
  if (!cards.value.some((c) => c.id === card.id)) cards.value.unshift(card);
  selectedId.value = card.id;
}

const DAY_MS = 86_400_000;

// "new" for a card that has never been reviewed (still box 1 at its creation
// default), otherwise a relative day count. Compared at day granularity so a
// card due in a few hours still reads "Today" rather than "in 0d".
function dueLabel(c: CardWithDetails): string {
  const due = new Date(c.nextReviewAt).getTime();
  if (!Number.isFinite(due)) return "-";
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const days = Math.round((new Date(due).setHours(0, 0, 0, 0) - startOfToday) / DAY_MS);
  if (days <= 0) return "Today";
  return `in ${days}d`;
}

function isDueNow(c: CardWithDetails): boolean {
  return new Date(c.nextReviewAt).getTime() <= Date.now();
}

// Compact chips for the table, where the column is 140px. The inspector keeps
// sourceBadges()' full "Local video" wording, which has room for it. Local
// wins over remote for a kind the card has both ways, since local is what
// actually plays.
function compactSourceBadges(c: CardWithDetails): string[] {
  const badges: string[] = [];
  if (c.localVideoPath) badges.push("VID");
  else if (c.animethemesVideoUrl) badges.push("VID*");
  if (c.localAudioPath) badges.push("AUD");
  else if (c.animethemesAudioUrl) badges.push("AUD*");
  return badges;
}

const pendingCardPreview = useState<CardWithDetails | null>("pendingCardPreview", () => null);
// NavBar's global search hands a card over to be shown here. The inspector
// replaced the preview modal for cards in the library, so select it in the
// rail instead of opening an overlay. The card may not be on the loaded page,
// so it is spliced to the front when missing rather than silently ignored.
watch(
  pendingCardPreview,
  (card) => {
    if (!card) return;
    previewInInspector(card);
    pendingCardPreview.value = null;
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
  editNotes.value = c.notes ?? "";
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
        notes: editNotes.value.trim() === "" ? null : editNotes.value.trim(),
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
    // The inspector resolves its subject out of cards, so a deleted selection
    // would otherwise silently blank the rail rather than showing its prompt.
    if (selectedId.value === id) selectedId.value = null;
    totalCards.value = Math.max(0, totalCards.value - 1);
  } catch (err) {
    removeCardError[id] = extractErrorMessage(err, "Failed to delete card.");
  }
}
</script>

<template>
  <main class="cards">
    <header class="cards-header">
      <div class="header-title">
        <h1>Cards</h1>
        <span class="header-count">{{ totalCards }} total</span>
      </div>
      <input
        v-model="searchInput"
        type="text"
        placeholder="Search to find or add a card..."
        class="search-input"
        @input="onSearchInput"
      />
    </header>

    <div class="cards-body">
      <div class="list-pane">
        <div v-if="initialPending" class="state">Loading...</div>
        <div v-else-if="initialError" class="state state-error">Couldn't load cards. Try refreshing.</div>
        <template v-else>
          <div v-if="cards.length" class="card-table">
            <div class="table-head">
              <span />
              <span>Song</span>
              <span class="col-anime">Anime</span>
              <span class="col-sources">Sources</span>
              <span>Due</span>
            </div>
            <button
              v-for="c in cards"
              :key="c.id"
              type="button"
              class="card-row"
              :class="{ selected: selectedId === c.id }"
              :aria-pressed="selectedId === c.id"
              @click="selectCard(c.id)"
            >
              <img v-if="c.animeCoverImageUrl" :src="c.animeCoverImageUrl" alt="" class="cover-thumb" />
              <span v-else class="cover-thumb cover-thumb-empty" />
              <span class="cell-song">
                <span class="song-title">{{ c.songTitle }}</span>
                <span class="song-artist">{{ c.artistName }}</span>
              </span>
              <span class="cell-anime">
                {{ c.animeTitleEnglish }} <span class="slot">{{ c.themeSlot }}</span>
              </span>
              <span class="cell-sources">
                <span v-for="badge in compactSourceBadges(c)" :key="badge" class="badge">{{ badge }}</span>
                <span v-if="!compactSourceBadges(c).length" class="badge badge-none">No source</span>
              </span>
              <span class="cell-due" :class="{ 'due-now': isDueNow(c) }">{{ dueLabel(c) }}</span>
            </button>
          </div>
          <p v-else-if="searchQuery" class="state">No cards match "{{ searchQuery }}".</p>
          <p v-else class="state">No cards yet. Search above to find and add one.</p>
          <div v-if="cards.length" ref="sentinelRef" class="scroll-sentinel">
            <span v-if="loadingMore" class="loading-more">Loading more...</span>
          </div>
        </template>

        <CardAddAnimeResults
          :query="searchQuery"
          :has-default-download-folder="hasDefaultDownloadFolder"
          @refresh="loadFirstPage"
          @preview="previewInInspector"
        />

        <CardAddSongResults
          :query="searchQuery"
          :has-default-download-folder="hasDefaultDownloadFolder"
          @refresh="loadFirstPage"
          @preview="previewInInspector"
        />

        <CardAddArtistResults
          :query="searchQuery"
          :has-default-download-folder="hasDefaultDownloadFolder"
          @refresh="loadFirstPage"
          @preview="previewInInspector"
        />
      </div>

      <aside class="inspector">
        <p v-if="!selectedCard" class="inspector-empty">Select a card to see its details.</p>
        <template v-else>
          <!-- The rail is the preview now: a real player rather than a still.
               A card with no source at all has nothing to play, so it keeps
               the plain cover tile. -->
          <StudyMediaPlayer
            v-if="sourceBadges(selectedCard).length"
            :key="selectedCard.id"
            :card="selectedCard"
            :audio-only="audioOnly"
            :has-default-download-folder="hasDefaultDownloadFolder"
            :allow-expand="true"
            v-model:immersive="inspectorImmersive"
            @local-path-updated="onInspectorLocalPathUpdated"
          />
          <div v-else class="inspector-cover">
            <img v-if="selectedCard.animeCoverImageUrl" :src="selectedCard.animeCoverImageUrl" alt="" />
            <span class="inspector-slot">{{ selectedCard.themeSlot }}</span>
          </div>
          <div class="inspector-body">
            <div class="inspector-titles">
              <span class="inspector-song">{{ selectedCard.songTitle }}</span>
              <span class="inspector-meta">{{ selectedCard.artistName }}</span>
              <span class="inspector-meta">{{ selectedCard.animeTitleEnglish }}</span>
            </div>

            <div class="inspector-tiles">
              <div class="tile">
                <span class="tile-value" :class="{ 'due-now': isDueNow(selectedCard) }">{{
                  dueLabel(selectedCard)
                }}</span>
                <span class="tile-label">Due</span>
              </div>
              <div class="tile">
                <span class="tile-value tile-value-box">Box {{ selectedCard.box }}</span>
                <span class="tile-label">Leitner</span>
              </div>
            </div>

            <div v-if="selectedCard.notes" class="inspector-block">
              <span class="block-label">Notes</span>
              <span class="notes-row">{{ selectedCard.notes }}</span>
            </div>

            <div class="inspector-block">
              <span class="block-label">Sources</span>
              <span v-for="badge in sourceBadges(selectedCard)" :key="badge" class="source-row">{{ badge }}</span>
              <span v-if="!sourceBadges(selectedCard).length" class="source-row source-row-none">No source</span>
            </div>

            <div v-if="hasAnyDownloadableSource(selectedCard)" class="download-section">
              <div v-if="hasDefaultDownloadFolder" class="download-actions">
                <template v-for="kind in (['video', 'audio'] as const)" :key="kind">
                  <template v-if="canDownload(selectedCard, kind)">
                    <div v-if="downloading[downloadKey(selectedCard.id, kind)]" class="download-progress">
                      <div class="download-progress-bar">
                        <span :style="{ width: progressPercent(selectedCard.id, kind) + '%' }" />
                      </div>
                      <span class="download-progress-label">{{
                        formatDownloadProgress(downloadProgress[downloadKey(selectedCard.id, kind)])
                      }}</span>
                    </div>
                    <button v-else type="button" class="download-btn" @click="downloadMedia(selectedCard, kind)">
                      Download {{ kind }}
                    </button>
                  </template>
                </template>
              </div>
              <p v-else class="download-hint">
                Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
              </p>
              <p v-if="downloadError[selectedCard.id]" class="edit-error">{{ downloadError[selectedCard.id] }}</p>
            </div>

            <div class="inspector-block">
              <span class="block-label">Decks</span>
              <DeckMembershipPanel
                :card-id="selectedCard.id"
                :decks="manualDecks"
                :memberships="membershipsData?.memberships ?? {}"
                :toggling="togglingMembership"
                :error="deckToggleError"
                @toggle="(deckId, checked) => toggleDeckMembership(selectedCard!.id, deckId, checked)"
              />
            </div>

            <div v-if="editingId === selectedCard.id" class="edit-form">
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
                  :disabled="!selectedCard.localVideoPath || editSaving || clearingField[`${selectedCard.id}-video`]"
                  @click="clearLocalPath(selectedCard, 'video')"
                >
                  {{ clearingField[`${selectedCard.id}-video`] ? "Clearing..." : "Clear" }}
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
                  :disabled="!selectedCard.localAudioPath || editSaving || clearingField[`${selectedCard.id}-audio`]"
                  @click="clearLocalPath(selectedCard, 'audio')"
                >
                  {{ clearingField[`${selectedCard.id}-audio`] ? "Clearing..." : "Clear" }}
                </button>
              </div>
              <div class="notes-field">
                <span class="block-label">Notes</span>
                <textarea
                  v-model="editNotes"
                  rows="3"
                  placeholder="A memory hook for this card"
                  :disabled="editSaving"
                  class="path-input"
                />
              </div>
              <div class="edit-actions">
                <button type="button" class="save-btn" :disabled="editSaving" @click="saveEdit(selectedCard.id)">
                  Save
                </button>
                <button type="button" class="cancel-btn" :disabled="editSaving" @click="cancelEdit">Cancel</button>
              </div>
              <p v-if="editError" class="edit-error">{{ editError }}</p>
            </div>

            <div v-else class="inspector-actions">
              <button type="button" class="edit-btn" @click="startEdit(selectedCard)">Edit card</button>
              <button type="button" class="remove-btn" @click="removeCard(selectedCard.id)">Delete</button>
            </div>
            <p v-if="removeCardError[selectedCard.id]" class="edit-error">{{ removeCardError[selectedCard.id] }}</p>
          </div>
        </template>
      </aside>
    </div>
  </main>
</template>

<style scoped>
/* Fills the content column, like /study after 50b. */
.cards {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.cards-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 28px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
}

.header-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  line-height: 1;
}

.header-count {
  font-size: 13px;
  color: var(--faint);
  white-space: nowrap;
}

/* Two panes edge to edge; the inspector's own left border separates them,
   so there is no gap. */
.cards-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 400px;
  align-items: stretch;
}

.list-pane {
  min-width: 0;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

.inspector {
  min-width: 0;
  overflow-y: auto;
  background: var(--surface-sunken);
  border-left: 1px solid var(--border);
}

.inspector-empty {
  margin: 0;
  padding: 26px;
  color: var(--faint);
  font-size: 13px;
}

/* The player fills the top of the rail as one flush tile, like the artboard's
   preview block - no card padding, no rounded corners, just a bottom edge.
   Skipped while expanded, where it is a fixed full-viewport overlay. */
.inspector > :deep(.player-card:not(.expanded)) {
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  box-shadow: none;
}

.inspector > :deep(.player-card:not(.expanded)) .player-frame {
  border: 0;
  border-radius: 0;
}

.inspector-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  background:
    radial-gradient(120% 120% at 30% 20%, var(--accent-glow), transparent 55%),
    radial-gradient(120% 120% at 80% 80%, var(--accent-secondary-glow), transparent 55%),
    var(--surface);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.inspector-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.85;
}

.inspector-slot {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 3px 10px;
  border-radius: calc(var(--radius-sm) - 1px);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-secondary);
}

.inspector-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.inspector-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inspector-song {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  line-height: 1.2;
}

.inspector-meta {
  font-size: 14px;
  color: var(--muted);
}

.inspector-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tile {
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tile-value {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  color: var(--muted);
}

.tile-value.due-now {
  color: var(--accent);
}

.tile-value-box {
  color: var(--pass);
}

.tile-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--faint);
}

.inspector-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--faint);
}

.source-row {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
}

.source-row-none {
  color: var(--fail);
  border-color: var(--fail);
}

/* Free text rather than a badge, so it wraps and keeps the line breaks the
   user typed instead of the single-line treatment .source-row gets. */
.notes-row {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.inspector-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.inspector-actions .preview-btn,
.inspector-actions .edit-btn {
  flex: 1;
}

.search-input {
  display: block;
  width: 300px;
  max-width: 100%;
  margin: 0;
  padding: 9px 14px;
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

/* Dense table: one grid line per card, actions demoted to the inspector.
   The same template-columns string is on the header row and every card row -
   keep them in step. */
.card-table {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.table-head,
.card-row {
  display: grid;
  grid-template-columns: 46px 1fr 200px 140px 92px;
  gap: 14px;
  align-items: center;
}

.table-head {
  padding: 0 14px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--faint);
}

.card-row {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid transparent;
  font-family: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.card-row:hover {
  border-color: var(--border);
}

.card-row.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
}

.cover-thumb {
  width: 34px;
  height: 48px;
  border-radius: 3px;
  object-fit: cover;
}

.cover-thumb-empty {
  display: block;
  background: var(--surface-raised);
}

.cell-song {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.song-title {
  font-size: 15px;
  font-weight: 700;
}

.song-artist,
.cell-anime {
  font-size: 13px;
  color: var(--muted);
}

.cell-anime .slot {
  color: var(--faint);
}

.cell-song > span,
.cell-anime {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-sources {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.cell-due {
  font-size: 13px;
  color: var(--muted);
}

.cell-due.due-now {
  color: var(--accent);
  font-weight: 700;
}

.badge {
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-secondary);
  white-space: nowrap;
}

.badge-none {
  color: var(--fail);
  border-color: var(--fail);
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

.notes-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

textarea.path-input {
  resize: vertical;
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

/* 50h: same breakpoint and stacking pattern as .study-grid. Placed last so
   it wins the source-order tiebreak over the earlier same-specificity base
   rules above. */
@media (max-width: 820px) {
  .cards-header {
    flex-wrap: wrap;
  }

  .cards-body {
    grid-template-columns: 1fr;
  }

  .inspector {
    border-left: none;
    border-top: 1px solid var(--border);
  }

  .table-head,
  .card-row {
    grid-template-columns: 46px 1fr 92px;
  }

  .cell-anime,
  .col-anime,
  .cell-sources,
  .col-sources {
    display: none;
  }
}
</style>
