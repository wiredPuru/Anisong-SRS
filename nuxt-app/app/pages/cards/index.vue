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
  animeAniListId: number;
  animeAnimethemesSlug: string | null;
  animethemesVideoSlug: string | null;
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

const missingAnimeThemesMatch = ref(false);

function applyMissingAnimeThemesParam(raw: unknown) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  missingAnimeThemesMatch.value = value === "1";
}

applyMissingAnimeThemesParam(route.query.missingAnimeThemes);

watch(() => route.query.missingAnimeThemes, applyMissingAnimeThemesParam);

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
      query: {
        page: 1,
        q: searchQuery.value || undefined,
        missingAnimeThemes: missingAnimeThemesMatch.value ? "1" : undefined,
      },
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
      query: {
        page: nextPage.value,
        q: searchQuery.value || undefined,
        missingAnimeThemes: missingAnimeThemesMatch.value ? "1" : undefined,
      },
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

// Describes the active filter(s) for the "Delete all N matching" confirm
// label, since searchQuery alone can't describe a toggle-only filter.
const matchingFilterDescription = computed(() => {
  const parts: string[] = [];
  if (searchQuery.value) parts.push(`matching "${searchQuery.value}"`);
  if (missingAnimeThemesMatch.value) parts.push("with no AnimeThemes.moe match");
  return parts.join(" ");
});

watch([searchQuery, missingAnimeThemesMatch], () => {
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
  clipSource: "anisongdb" | "both" | "animethemes";
}>("/api/media-library");
const hasDefaultDownloadFolder = computed(() => Boolean(mediaLibraryData.value?.defaultDownloadFolder));
const audioOnly = computed(() => mediaLibraryData.value?.playbackMode === "audioOnly");
const autoDownload = computed(() => mediaLibraryData.value?.autoDownload ?? false);
const clipSource = computed(() => mediaLibraryData.value?.clipSource ?? "anisongdb");

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
    ids = (
      await $fetch<{ ids: number[] }>("/api/cards/ids", {
        query: { q, missingAnimeThemes: missingAnimeThemesMatch.value ? "1" : undefined },
      })
    ).ids;
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
</script>

<template>
  <main class="cards">
    <header class="cards-header">
      <div class="header-title">
        <h1>Cards</h1>
        <span class="header-count">{{ totalCards }} total</span>
      </div>
      <div class="search-area">
        <input
          v-model="searchInput"
          type="text"
          placeholder="Search to find or add a card..."
          class="search-input"
          @input="onSearchInput"
        />
        <button
          type="button"
          class="filter-toggle"
          :class="{ active: missingAnimeThemesMatch }"
          :aria-pressed="missingAnimeThemesMatch"
          @click="missingAnimeThemesMatch = !missingAnimeThemesMatch"
        >
          No AnimeThemes match
        </button>
      </div>
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
          <ActivityStatus :request-key="`${searchQuery}|${missingAnimeThemesMatch}`" label="Loading your cards" />
        </div>
        <div v-else-if="initialError" class="state state-error">Couldn't load cards. Try refreshing.</div>
        <template v-else>
          <div
            v-if="(searchQuery || missingAnimeThemesMatch) && totalCards > 0 && !checkedIds.size && !bulkDeleteError"
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
                Delete all {{ totalCards }} {{ totalCards === 1 ? "card" : "cards" }} {{ matchingFilterDescription }}?
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
          <CardTable
            v-if="cards.length"
            :cards="cards"
            :selected-id="selectedId"
            :checked-ids="checkedIds"
            @select="selectCard"
            @check-click="onRowCheckClick"
            @toggle-all="toggleCheckAllLoaded"
          />
          <p v-else-if="searchQuery" class="state">No cards match "{{ searchQuery }}".</p>
          <p v-else-if="missingAnimeThemesMatch" class="state">No cards without an AnimeThemes.moe match.</p>
          <p v-else class="state state-empty">
            <MascotKai pose="laptop" />
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
        <CardInspector
          :card="selectedCard"
          :audio-only="audioOnly"
          :has-default-download-folder="hasDefaultDownloadFolder"
          :auto-download="autoDownload"
          :clip-source="clipSource"
          :manual-decks="manualDecks"
          :memberships="membershipsData?.memberships ?? {}"
          :toggling-membership="togglingMembership"
          :membership-error="deckToggleError"
          @updated="replaceCard"
          @deleted="dropDeletedCards([$event])"
          @toggle-deck="toggleDeckMembership"
        />
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

.search-area {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.search-input {
  display: block;
  width: 100%;
  flex: 1;
  min-width: 0;
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

/* Border and glow rather than a fill for the active state, matching the
   convention feature 24 set so the control stays glass under ambient mode. */
.filter-toggle {
  flex: none;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.filter-toggle.active {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 14px var(--accent-glow);
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

.edit-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
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
}
</style>
