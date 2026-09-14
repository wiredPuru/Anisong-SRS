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
  artistId: number;
  artistName: string;
  animeId: number;
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

const importPanelOpen = ref(false);
const importAniListUsername = ref("");
const importMalUsername = ref("");
const listImport = useCompletedListImport();
const { loading: importLoading, results: importResults } = listImport;
const importBlankHint = ref(false);
const importAniListError = computed(() => listImport.sources.aniList.error);
const importMalError = computed(() => listImport.sources.mal.error);
// An upstream outage gets its own line: the provider's own message ("... is
// temporarily unavailable") reads like an app fault and leaves the user with
// nothing to do next.
const importAniListOutage = computed(() => listImport.sources.aniList.unavailable);
const importMalOutage = computed(() => listImport.sources.mal.unavailable);
// Results and errors outlive the form, so the panel stays while any are showing.
const showImportPanel = computed(
  () =>
    importPanelOpen.value ||
    importBlankHint.value ||
    importResults.value !== null ||
    Object.values(listImport.sources).some((source) => source.status !== "idle"),
);
const importSummary = computed(() => {
  if (importResults.value === null) return null;
  return {
    aniList: listImport.sources.aniList.status === "done" ? listImport.sources.aniList.results.length : null,
    mal: listImport.sources.mal.status === "done" ? listImport.sources.mal.results.length : null,
    total: importResults.value.length,
  };
});

async function runImport() {
  const aniList = importAniListUsername.value.trim();
  const mal = importMalUsername.value.trim();
  importBlankHint.value = !aniList && !mal;
  if (importBlankHint.value) return;
  await listImport.run({ aniList, mal });
}

const importSummaryText = computed(() => {
  const summary = importSummary.value;
  if (!summary) return "";

  const parts: string[] = [];
  if (summary.aniList !== null) parts.push(`${summary.aniList} from AniList`);
  if (summary.mal !== null) parts.push(`${summary.mal} from MyAnimeList`);

  const perSource = parts.length ? ` (${parts.join(", ")})` : "";
  const deduped = parts.length > 1 ? " Duplicates across both lists are shown once." : "";
  return `Found ${summary.total} anime${perSource}.${deduped}`;
});

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

const loadFirstPageRequests = createLatestRequest();
onScopeDispose(loadFirstPageRequests.invalidate);

async function loadFirstPage() {
  const isCurrent = loadFirstPageRequests.start();
  initialPending.value = true;
  initialError.value = false;
  try {
    const res = await $fetch<{ cards: CardWithDetails[]; page: number; totalPages: number; total: number }>("/api/cards", {
      query: { page: 1, q: searchQuery.value || undefined },
    });
    if (!isCurrent()) return;
    cards.value = res.cards;
    nextPage.value = 2;
    totalPages.value = res.totalPages;
    totalCards.value = res.total;
  } catch {
    if (isCurrent()) initialError.value = true;
  } finally {
    if (isCurrent()) initialPending.value = false;
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
  clearChecked();
  confirmingDeleteMatching.value = false;
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
  autoDownload: boolean;
}>("/api/media-library");
const hasDefaultDownloadFolder = computed(() => Boolean(mediaLibraryData.value?.defaultDownloadFolder));
const audioOnly = computed(() => mediaLibraryData.value?.playbackMode === "audioOnly");
const autoDownload = computed(() => mediaLibraryData.value?.autoDownload ?? false);

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
const confirmingRemoveId = ref<number | null>(null);
const removingCard = ref(false);

const {
  containerRef: cardsBodyRef,
  width: inspectorWidth,
  dragging: inspectorDragging,
  onPointerDown: onResizerPointerDown,
  reset: resetInspectorWidth,
} = useResizablePane();

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

function onInspectorLocalPathCleared({ kind }: { kind: "video" | "audio" }) {
  const current = selectedCard.value;
  if (!current) return;
  replaceCard({
    ...current,
    ...(kind === "video" ? { localVideoPath: null } : { localAudioPath: null }),
  });
}

// Multi-select for bulk actions, separate from selectedId (the inspector's
// single subject). Replaced rather than mutated so Vue sees each change.
const checkedIds = ref<Set<number>>(new Set());
let lastCheckedId: number | null = null;

const loadedIds = computed(() => cards.value.map((c) => c.id));
const headerCheckState = computed(() => selectionState(checkedIds.value, loadedIds.value));

// A shift-click applies the clicked box's new state to the whole range, the
// way file managers do, rather than toggling each row in it individually.
function onRowCheckClick(id: number, event: MouseEvent) {
  const turnOn = !checkedIds.value.has(id);
  const range = event.shiftKey ? rangeIds(loadedIds.value, lastCheckedId, id) : [id];
  const next = new Set(checkedIds.value);
  for (const rowId of range) {
    if (turnOn) next.add(rowId);
    else next.delete(rowId);
  }
  checkedIds.value = next;
  lastCheckedId = id;
}

function toggleCheckAllLoaded() {
  const next = new Set(checkedIds.value);
  const clearing = headerCheckState.value === "all";
  for (const id of loadedIds.value) {
    if (clearing) next.delete(id);
    else next.add(id);
  }
  checkedIds.value = next;
}

function clearChecked() {
  checkedIds.value = new Set();
  lastCheckedId = null;
}

// Mirrors BULK_DELETE_MAX in server/utils/cardDelete.ts, which rejects larger batches.
const BULK_DELETE_MAX = 500;
// Mirrors BULK_DECK_ADD_MAX in server/utils/deckMembership.ts.
const BULK_DECK_ADD_MAX = 500;
const confirmingBulkDelete = ref(false);
const bulkDeleting = ref(false);
const bulkDeleteError = ref<string | null>(null);

watch(checkedIds, (ids) => {
  if (ids.size === 0) confirmingBulkDelete.value = false;
});

function dropDeletedCards(ids: readonly number[]) {
  const gone = new Set(ids);
  const before = cards.value.length;
  cards.value = cards.value.filter((c) => !gone.has(c.id));
  totalCards.value = Math.max(0, totalCards.value - (before - cards.value.length));
  if (selectedId.value !== null && gone.has(selectedId.value)) selectedId.value = null;
  checkedIds.value = new Set([...checkedIds.value].filter((id) => !gone.has(id)));
}

// Batches run one after another so a failure stops cleanly: every card already
// removed leaves the list, and the rest stay selected to retry.
async function deleteSelected(ids: readonly number[]) {
  bulkDeleting.value = true;
  bulkDeleteError.value = null;
  try {
    for (const batch of chunkIds(ids, BULK_DELETE_MAX)) {
      const result = await $fetch<{ deleted: number[]; notFound: number[] }>("/api/cards", {
        method: "DELETE",
        body: { ids: batch },
      });
      dropDeletedCards([...result.deleted, ...result.notFound]);
    }
    confirmingBulkDelete.value = false;
  } catch (err) {
    bulkDeleteError.value = extractErrorMessage(err, "Failed to delete cards.");
    confirmingBulkDelete.value = false;
  } finally {
    bulkDeleting.value = false;
    await refreshMemberships();
  }
  // Deleted rows shift every later page's offset, and an emptied list hides the
  // infinite-scroll sentinel, so unloaded cards would otherwise read as "No cards".
  if (totalCards.value > cards.value.length) await loadFirstPage();
}

// Adding to a deck keeps the selection: the cards still exist afterwards, so the
// same set can go straight into a second deck without re-ticking every row.
const addToDeckId = ref<number | null>(null);
const addingToDeck = ref(false);
const addToDeckError = ref<string | null>(null);
const addToDeckNotice = ref<string | null>(null);

watch(checkedIds, (ids) => {
  if (ids.size === 0) addToDeckNotice.value = null;
});

async function addSelectedToDeck() {
  const deckId = addToDeckId.value;
  const ids = [...checkedIds.value];
  if (deckId === null || !ids.length) return;

  addingToDeck.value = true;
  addToDeckError.value = null;
  addToDeckNotice.value = null;
  let added = 0;
  try {
    for (const batch of chunkIds(ids, BULK_DECK_ADD_MAX)) {
      const result = await $fetch<{ added: number[]; notFound: number[] }>("/api/decks/cards", {
        method: "POST",
        body: { deckId, cardIds: batch },
      });
      added += result.added.length;
    }
    const name = manualDecks.value.find((d) => d.id === deckId)?.name ?? "the deck";
    addToDeckNotice.value = `Added ${added} ${added === 1 ? "card" : "cards"} to ${name}.`;
  } catch (err) {
    addToDeckError.value = extractErrorMessage(err, "Failed to add cards to deck.");
  } finally {
    addingToDeck.value = false;
    // The inspector's DeckMembershipPanel reads this map, so it would show stale
    // checkboxes for a card that just joined a deck.
    await refreshMemberships();
  }
}

const confirmingDeleteMatching = ref(false);

// Ids are fetched at Confirm time so cards infinite scroll never loaded are
// included.
async function deleteAllMatching() {
  const q = searchQuery.value;
  bulkDeleteError.value = null;
  bulkDeleting.value = true;
  let ids: number[];
  try {
    ids = (await $fetch<{ ids: number[] }>("/api/cards/ids", { query: { q } })).ids;
  } catch (err) {
    bulkDeleteError.value = extractErrorMessage(err, "Failed to find matching cards.");
    bulkDeleting.value = false;
    confirmingDeleteMatching.value = false;
    return;
  }
  await deleteSelected(ids);
  confirmingDeleteMatching.value = false;
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
  removingCard.value = true;
  try {
    await $fetch("/api/cards", { method: "DELETE", body: { id } });
    // Also closes the inspector, which resolves its subject out of cards and
    // would otherwise silently blank the rail rather than showing its prompt.
    dropDeletedCards([id]);
  } catch (err) {
    removeCardError[id] = extractErrorMessage(err, "Failed to delete card.");
  } finally {
    removingCard.value = false;
    confirmingRemoveId.value = null;
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
      <button
        type="button"
        class="import-toggle"
        :class="{ active: importPanelOpen }"
        :aria-expanded="importPanelOpen"
        @click="importPanelOpen = !importPanelOpen"
      >
        Import list
      </button>
    </header>

    <div v-if="showImportPanel" class="import-panel">
      <div v-if="importPanelOpen" class="import-form">
        <input v-model="importAniListUsername" type="text" placeholder="AniList username" class="import-input" />
        <input v-model="importMalUsername" type="text" placeholder="MyAnimeList username" class="import-input" />
        <button type="button" class="import-btn" :disabled="importLoading" @click="runImport">
          {{ importLoading ? "Importing..." : "Import" }}
        </button>
      </div>
      <p v-if="importBlankHint" class="import-status">Enter an AniList or MyAnimeList username first.</p>
      <template v-for="(source, provider) in listImport.sources" :key="provider">
        <p v-if="source.status === 'pending'" class="import-status">
          <ActivityStatus
            :label="`Fetching your ${source.label} Completed list`"
            :request-key="provider"
            :progress="listImport.activities[provider].progress.value"
            :revision="listImport.activities[provider].revision.value"
          />
        </p>
        <p v-else-if="source.status === 'done'" class="import-status" role="status">
          {{ source.label }} complete: {{ source.results.length }} anime found.
        </p>
      </template>
      <p v-if="importAniListOutage" class="inline-error">
        AniList's API is down at their end, so Completed lists can't be fetched right now.
        Import from MyAnimeList instead - searching and adding anime are unaffected.
      </p>
      <p v-else-if="importAniListError" class="inline-error">AniList: {{ importAniListError }}</p>
      <p v-if="importMalOutage" class="inline-error">
        MyAnimeList isn't responding right now, so Completed lists can't be fetched.
        Searching and adding anime are unaffected.
      </p>
      <p v-else-if="importMalError" class="inline-error">MyAnimeList: {{ importMalError }}</p>
      <template v-if="importResults !== null">
        <p v-if="importResults.length" class="import-status">{{ importSummaryText }}</p>
        <p v-else-if="!importLoading && !importAniListError && !importMalError" class="import-status">
          No completed anime found. That list may be empty, or set to private.
        </p>
        <CardImportListResults
          v-if="importResults.length"
          :results="importResults"
          :has-default-download-folder="hasDefaultDownloadFolder"
          @refresh="loadFirstPage"
          @preview="previewInInspector"
        />
      </template>
    </div>

    <div
      ref="cardsBodyRef"
      class="cards-body"
      :class="{ resizing: inspectorDragging }"
      :style="{ '--inspector-width': `${inspectorWidth}px` }"
    >
      <div class="list-pane">
        <div v-if="initialPending" class="state">
          <ActivityStatus :request-key="searchQuery" label="Loading your cards" />
        </div>
        <div v-else-if="initialError" class="state state-error">Couldn't load cards. Try refreshing.</div>
        <template v-else>
          <div
            v-if="searchQuery && totalCards > 0 && !checkedIds.size && !bulkDeleteError"
            class="selection-bar"
          >
            <span class="selection-count">{{ totalCards }} matching</span>
            <button
              v-if="!confirmingDeleteMatching"
              type="button"
              class="remove-btn"
              :disabled="bulkDeleting"
              @click="confirmingDeleteMatching = true"
            >
              Delete all {{ totalCards }} matching
            </button>
            <template v-else>
              <span class="confirm-label">
                Delete all {{ totalCards }} {{ totalCards === 1 ? "card" : "cards" }} matching "{{ searchQuery }}"?
                This also removes their downloaded files.
              </span>
              <button type="button" class="confirm-btn" :disabled="bulkDeleting" @click="deleteAllMatching">
                {{ bulkDeleting ? "Deleting..." : "Confirm" }}
              </button>
              <button
                type="button"
                class="selection-clear-btn"
                :disabled="bulkDeleting"
                @click="confirmingDeleteMatching = false"
              >
                Cancel
              </button>
            </template>
          </div>
          <div v-if="checkedIds.size || bulkDeleteError" class="selection-bar">
            <span class="selection-count">{{ checkedIds.size }} selected</span>
            <template v-if="!confirmingBulkDelete">
              <template v-if="manualDecks.length">
                <select
                  v-model="addToDeckId"
                  class="deck-select"
                  aria-label="Deck to add the selected cards to"
                  :disabled="addingToDeck || bulkDeleting"
                >
                  <option :value="null">Add to deck...</option>
                  <option v-for="d in manualDecks" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
                <button
                  type="button"
                  class="selection-clear-btn"
                  :disabled="addToDeckId === null || addingToDeck || bulkDeleting"
                  @click="addSelectedToDeck"
                >
                  {{ addingToDeck ? "Adding..." : "Add to deck" }}
                </button>
              </template>
              <span v-else class="deck-hint">
                No manual decks yet - <NuxtLink to="/decks?type=created">create one on the Decks page</NuxtLink>.
              </span>
              <button
                type="button"
                class="selection-clear-btn"
                :disabled="bulkDeleting || addingToDeck"
                @click="clearChecked"
              >
                Clear selection
              </button>
              <button
                type="button"
                class="remove-btn"
                :disabled="!checkedIds.size || bulkDeleting || addingToDeck"
                @click="confirmingBulkDelete = true"
              >
                Delete
              </button>
            </template>
            <template v-else>
              <span class="confirm-label">
                Delete {{ checkedIds.size }} {{ checkedIds.size === 1 ? "card" : "cards" }}? This also removes their
                downloaded files.
              </span>
              <button
                type="button"
                class="confirm-btn"
                :disabled="bulkDeleting"
                @click="deleteSelected([...checkedIds])"
              >
                {{ bulkDeleting ? "Deleting..." : "Confirm" }}
              </button>
              <button
                type="button"
                class="selection-clear-btn"
                :disabled="bulkDeleting"
                @click="confirmingBulkDelete = false"
              >
                Cancel
              </button>
            </template>
            <p v-if="bulkDeleteError" class="edit-error selection-error">{{ bulkDeleteError }}</p>
            <p v-if="addToDeckError" class="edit-error selection-error">{{ addToDeckError }}</p>
            <p v-else-if="addToDeckNotice" class="selection-notice">{{ addToDeckNotice }}</p>
          </div>
          <div v-if="cards.length" class="card-table">
            <div class="row-line">
              <label class="row-check">
                <input
                  type="checkbox"
                  :checked="headerCheckState === 'all'"
                  :indeterminate="headerCheckState === 'some'"
                  aria-label="Select all loaded cards"
                  @change="toggleCheckAllLoaded"
                />
              </label>
              <div class="table-head">
                <span />
                <span>Song</span>
                <span class="col-anime">Anime</span>
                <span class="col-sources">Sources</span>
                <span>Due</span>
              </div>
            </div>
            <div v-for="c in cards" :key="c.id" class="row-line">
              <label class="row-check">
                <input
                  type="checkbox"
                  :checked="checkedIds.has(c.id)"
                  :aria-label="`Select ${c.songTitle}`"
                  @click="onRowCheckClick(c.id, $event)"
                />
              </label>
              <button
                type="button"
                class="card-row"
                :class="{ selected: selectedId === c.id, checked: checkedIds.has(c.id) }"
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
          </div>
          <p v-else-if="searchQuery" class="state">No cards match "{{ searchQuery }}".</p>
          <p v-else class="state state-empty">
            <MascotTemi size="companion" />
            <span>No cards yet. Search above to find and add one.</span>
          </p>
          <div v-if="cards.length" ref="sentinelRef" class="scroll-sentinel">
            <span v-if="loadingMore" class="loading-more">
              <ActivityStatus label="Loading more cards" />
            </span>
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

      <div
        class="pane-resizer"
        :class="{ dragging: inspectorDragging }"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize card details panel"
        @pointerdown="onResizerPointerDown"
        @dblclick="resetInspectorWidth"
      />

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
            :auto-download="autoDownload"
            :allow-expand="true"
            v-model:immersive="inspectorImmersive"
            @local-path-updated="onInspectorLocalPathUpdated"
            @local-path-cleared="onInspectorLocalPathCleared"
          />
          <div v-else class="inspector-cover">
            <img v-if="selectedCard.animeCoverImageUrl" :src="selectedCard.animeCoverImageUrl" alt="" />
            <span class="inspector-slot">{{ selectedCard.themeSlot }}</span>
          </div>
          <div class="inspector-body">
            <div class="inspector-titles">
              <span class="inspector-song">{{ selectedCard.songTitle }}</span>
              <NuxtLink :to="artistDeckPath(selectedCard.artistId)" class="inspector-meta deck-link">{{
                selectedCard.artistName
              }}</NuxtLink>
              <NuxtLink :to="animeDeckPath(selectedCard.animeId)" class="inspector-meta deck-link">{{
                selectedCard.animeTitleEnglish
              }}</NuxtLink>
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
                    <DownloadProgress
                      v-if="downloading[downloadKey(selectedCard.id, kind)]"
                      :label="`Downloading ${kind}`"
                      :request-key="downloadKey(selectedCard.id, kind)"
                      :progress="downloadProgress[downloadKey(selectedCard.id, kind)]"
                    />
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

            <div v-else-if="confirmingRemoveId === selectedCard.id" class="inspector-actions">
              <span class="confirm-label">Delete this card? This also removes its downloaded files.</span>
              <button type="button" class="confirm-btn" :disabled="removingCard" @click="removeCard(selectedCard.id)">
                {{ removingCard ? "Deleting..." : "Confirm" }}
              </button>
              <button
                type="button"
                class="selection-clear-btn"
                :disabled="removingCard"
                @click="confirmingRemoveId = null"
              >
                Cancel
              </button>
            </div>
            <div v-else class="inspector-actions">
              <button type="button" class="edit-btn" @click="startEdit(selectedCard)">Edit card</button>
              <button type="button" class="remove-btn" @click="confirmingRemoveId = selectedCard.id">Delete</button>
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
  display: grid;
  grid-template-columns: 1fr minmax(0, 520px) 1fr;
  align-items: center;
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
  grid-template-columns: minmax(0, 1fr) 0 var(--inspector-width, 400px);
  align-items: stretch;
}

.cards-body.resizing {
  cursor: col-resize;
  user-select: none;
}

/* Zero-width grid column; the hit area straddles the inspector's border so
   the layout doesn't shift by the handle's width. */
.pane-resizer {
  position: relative;
  z-index: 1;
  width: 9px;
  margin-left: -4px;
  cursor: col-resize;
  touch-action: none;
}

.pane-resizer::after {
  content: "";
  position: absolute;
  inset: 0 3px;
  background: transparent;
  transition: background 0.15s;
}

.pane-resizer:hover::after,
.pane-resizer.dragging::after {
  background: var(--accent);
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

.inspector-actions .confirm-label {
  flex-basis: 100%;
}

.inspector-actions button:disabled {
  opacity: 0.5;
  cursor: default;
}

.import-panel {
  margin: 16px 24px;
}

.import-toggle {
  justify-self: end;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
}

.import-toggle:hover,
.import-toggle:focus-visible,
.import-toggle.active {
  border-color: var(--border);
  color: var(--text);
}

.import-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.import-input {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.import-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.import-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.import-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.inline-error {
  margin: 8px 0 0;
  color: var(--fail);
  font-size: 13px;
}

.import-status {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.import-status-hint {
  color: var(--faint);
}

.search-input {
  display: block;
  width: 100%;
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

.state-empty {
  display: flex;
  align-items: center;
  gap: 16px;
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

.selection-bar {
  position: sticky;
  top: -16px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: -16px -20px 12px;
  padding: 12px 20px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.selection-count {
  font-weight: 700;
  color: var(--accent-secondary);
  margin-right: auto;
}

.selection-clear-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.confirm-label {
  color: var(--fail);
  font-size: 13px;
  font-weight: 700;
}

.confirm-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--fail);
  color: var(--fail-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.selection-bar button:disabled {
  opacity: 0.5;
  cursor: default;
}

.selection-error {
  flex-basis: 100%;
}

.selection-notice {
  flex-basis: 100%;
  margin: 0;
  color: var(--pass);
  font-size: 13px;
  font-weight: 700;
}

.deck-select {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 700;
}

.deck-select:disabled {
  opacity: 0.5;
  cursor: default;
}

.deck-hint {
  color: var(--muted);
  font-size: 13px;
}

.deck-hint a {
  color: var(--accent);
}

.row-line {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.row-check {
  display: flex;
  justify-content: center;
  cursor: pointer;
}

.row-check input {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
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

.card-row.checked {
  background: color-mix(in srgb, var(--accent-secondary) 8%, var(--surface));
}

.card-row.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
}

.cover-thumb {
  width: 34px;
  height: 48px;
  border-radius: var(--radius-xs);
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
  border-radius: var(--radius-pill);
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
    grid-template-columns: 1fr;
  }

  .import-toggle {
    justify-self: start;
  }

  .cards-body {
    grid-template-columns: 1fr;
  }

  .pane-resizer {
    display: none;
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
