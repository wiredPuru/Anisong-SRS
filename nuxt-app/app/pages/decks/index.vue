<script setup lang="ts">
interface ArtistDeck {
  id: number;
  name: string;
  cardCount: number;
  passRate: number | null;
  dueCount: number;
}

interface AnimeDeck {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  coverImageUrl: string | null;
  cardCount: number;
  passRate: number | null;
  dueCount: number;
}

interface ManualDeck {
  id: number;
  name: string;
  createdAt: string;
  cardCount: number;
  passRate: number | null;
}

type DeckType = "artist" | "anime" | "created";

interface DeckItem {
  id: number;
  label: string;
  sublabel: string | null;
  coverImageUrl: string | null;
  cardCount: number;
  passRate: number | null;
  dueCount: number | null;
}

interface DeckCard {
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
  artistId: number;
  artistName: string;
  animeId: number;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

interface AniListResult {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

const route = useRoute();
const router = useRouter();

const activeType = computed<DeckType>(() => {
  if (route.query.type === "anime") return "anime";
  if (route.query.type === "created") return "created";
  return "artist";
});

const selectedId = computed<number | null>(() => {
  const raw = route.query.id;
  if (typeof raw !== "string") return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
});

// Every row in an artist deck names that same artist, so linking it back to
// the page you are already on is noise - those names stay plain text and only
// the cross-link to the other grouping is clickable.
function isCurrentDeck(type: "artist" | "anime", id: number): boolean {
  return activeType.value === type && selectedId.value === id;
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

const searchPlaceholder = computed(() => {
  if (activeType.value === "artist") return "Search artists...";
  if (activeType.value === "anime") return "Search anime titles...";
  return "Search deck names...";
});

const rawDecks = ref<(ArtistDeck | AnimeDeck | ManualDeck)[]>([]);
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
    const res = await $fetch<{
      decks: ArtistDeck[] | AnimeDeck[] | ManualDeck[];
      page: number;
      totalPages: number;
    }>("/api/decks", { query: { type: activeType.value, page: 1, q: searchQuery.value || undefined } });
    rawDecks.value = res.decks;
    nextPage.value = 2;
    totalPages.value = res.totalPages;
  } catch {
    initialError.value = true;
  } finally {
    initialPending.value = false;
  }
}

async function loadMoreDecks() {
  if (loadingMore.value || nextPage.value > totalPages.value) return;
  loadingMore.value = true;
  try {
    const res = await $fetch<{
      decks: ArtistDeck[] | AnimeDeck[] | ManualDeck[];
      page: number;
      totalPages: number;
    }>("/api/decks", { query: { type: activeType.value, page: nextPage.value, q: searchQuery.value || undefined } });
    rawDecks.value.push(...res.decks);
    nextPage.value += 1;
    totalPages.value = res.totalPages;
  } finally {
    loadingMore.value = false;
  }
}

watch([activeType, searchQuery], () => {
  loadFirstPage();
});

watch(sentinelRef, (el, oldEl) => {
  if (oldEl) observer?.unobserve(oldEl);
  if (el) observer?.observe(el);
});

onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) loadMoreDecks();
  });
  loadFirstPage();
});

onUnmounted(() => {
  observer?.disconnect();
});

const { data: membershipsData, refresh: refreshMemberships } = await useFetch<{
  memberships: Record<number, number[]>;
}>("/api/decks/memberships");

function isCardInDeck(cardId: number): boolean {
  if (selectedId.value === null) return false;
  return (membershipsData.value?.memberships[cardId] ?? []).includes(selectedId.value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const deckItems = computed<DeckItem[]>(() => {
  if (activeType.value === "artist") {
    return (rawDecks.value as ArtistDeck[]).map((d) => ({
      id: d.id,
      label: d.name,
      sublabel: null,
      coverImageUrl: null,
      cardCount: d.cardCount,
      passRate: d.passRate,
      dueCount: d.dueCount,
    }));
  }
  if (activeType.value === "created") {
    return (rawDecks.value as ManualDeck[]).map((d) => ({
      id: d.id,
      label: d.name,
      sublabel: `Created ${formatDate(d.createdAt)}`,
      coverImageUrl: null,
      cardCount: d.cardCount,
      passRate: d.passRate,
      dueCount: null,
    }));
  }
  return (rawDecks.value as AnimeDeck[]).map((d) => ({
    id: d.id,
    label: d.titleEnglish,
    sublabel: d.titleRomaji,
    coverImageUrl: d.coverImageUrl,
    cardCount: d.cardCount,
    passRate: d.passRate,
    dueCount: d.dueCount,
  }));
});

function formatPassRate(passRate: number | null): string | null {
  return passRate === null ? null : `${Math.round(passRate * 100)}%`;
}

// Artist/Created decks have no single cover image, unlike Anime decks
// (Anime.coverImageUrl). These give their tile a stable, hashed accent tint
// instead of the empty box that used to render there.
const DECK_TINT_TOKENS = ["--accent", "--accent-secondary", "--pass", "--warning"];

function deckTint(id: number): string {
  return DECK_TINT_TOKENS[id % DECK_TINT_TOKENS.length]!;
}

function deckInitial(label: string): string {
  return label.trim().charAt(0).toUpperCase() || "?";
}

const selectedDeckCover = computed<string | null>(() => {
  if (selectedId.value === null) return null;
  return deckItems.value.find((item) => item.id === selectedId.value)?.coverImageUrl ?? null;
});

const cardSearchInput = ref("");
const cardSearchQuery = ref("");
let cardSearchDebounce: ReturnType<typeof setTimeout> | null = null;

function onCardSearchInput() {
  if (cardSearchDebounce) clearTimeout(cardSearchDebounce);
  cardSearchDebounce = setTimeout(() => {
    cardSearchQuery.value = cardSearchInput.value.trim();
  }, 250);
}

const deckLabel = ref("");
const deckCards = ref<DeckCard[]>([]);
const cardsInitialPending = ref(true);
const cardsInitialError = ref(false);
const cardsNextPage = ref(1);
const cardsTotalPages = ref(1);
const cardsLoadingMore = ref(false);
const cardsSentinelRef = ref<HTMLElement | null>(null);
let cardsObserver: IntersectionObserver | null = null;

async function loadFirstDeckCardsPage() {
  if (selectedId.value === null) return;
  cardsInitialPending.value = true;
  cardsInitialError.value = false;
  try {
    const res = await $fetch<{ deckLabel: string; cards: DeckCard[]; page: number; totalPages: number }>(
      "/api/decks/cards",
      {
        query: {
          type: activeType.value,
          id: selectedId.value,
          page: 1,
          q: cardSearchQuery.value || undefined,
        },
      },
    );
    deckLabel.value = res.deckLabel;
    deckCards.value = res.cards;
    cardsNextPage.value = 2;
    cardsTotalPages.value = res.totalPages;
  } catch {
    cardsInitialError.value = true;
  } finally {
    cardsInitialPending.value = false;
  }
}

async function loadMoreDeckCards() {
  if (cardsLoadingMore.value || cardsNextPage.value > cardsTotalPages.value || selectedId.value === null) return;
  cardsLoadingMore.value = true;
  try {
    const res = await $fetch<{ deckLabel: string; cards: DeckCard[]; page: number; totalPages: number }>(
      "/api/decks/cards",
      {
        query: {
          type: activeType.value,
          id: selectedId.value,
          page: cardsNextPage.value,
          q: cardSearchQuery.value || undefined,
        },
      },
    );
    deckCards.value.push(...res.cards);
    cardsNextPage.value += 1;
    cardsTotalPages.value = res.totalPages;
  } finally {
    cardsLoadingMore.value = false;
  }
}

function replaceDeckCard(updated: DeckCard) {
  const idx = deckCards.value.findIndex((c) => c.id === updated.id);
  if (idx !== -1) deckCards.value[idx] = updated;
}

watch([selectedId, cardSearchQuery], ([id]) => {
  if (id !== null) {
    loadFirstDeckCardsPage();
  }
});

watch(cardsSentinelRef, (el, oldEl) => {
  if (oldEl) cardsObserver?.unobserve(oldEl);
  if (el) cardsObserver?.observe(el);
});

onMounted(() => {
  cardsObserver = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) loadMoreDeckCards();
  });
  if (selectedId.value !== null) loadFirstDeckCardsPage();
});

onUnmounted(() => {
  cardsObserver?.disconnect();
});

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

function progressPercent(cardId: number, kind: "video" | "audio"): number {
  const progress = downloadProgress[downloadKey(cardId, kind)];
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}

async function downloadMedia(c: DeckCard, kind: "video" | "audio") {
  const updated = await downloadMediaBase<DeckCard>(c.id, c.id, kind);
  if (updated) {
    replaceDeckCard(updated);
  }
}

const newDeckName = ref("");
const isCreatingDeck = ref(false);
const createDeckError = ref<string | null>(null);
const showNewDeckForm = ref(false);

async function createDeck() {
  const name = newDeckName.value.trim();
  if (!name) return;

  createDeckError.value = null;
  isCreatingDeck.value = true;
  try {
    await $fetch("/api/decks", { method: "POST", body: { name } });
    newDeckName.value = "";
    showNewDeckForm.value = false;
    await loadFirstPage();
  } catch (err) {
    createDeckError.value = extractErrorMessage(err, "Failed to create deck.");
  } finally {
    isCreatingDeck.value = false;
  }
}

function cancelNewDeck() {
  showNewDeckForm.value = false;
  newDeckName.value = "";
  createDeckError.value = null;
}

const editingDeckId = ref<number | null>(null);
const editDeckName = ref("");
const isRenamingDeck = ref(false);
const renameDeckError = ref<string | null>(null);

function startRenameDeck(item: DeckItem) {
  editingDeckId.value = item.id;
  editDeckName.value = item.label;
  renameDeckError.value = null;
}

function cancelRenameDeck() {
  editingDeckId.value = null;
  renameDeckError.value = null;
}

async function saveRenameDeck(id: number) {
  const name = editDeckName.value.trim();
  if (!name) return;

  renameDeckError.value = null;
  isRenamingDeck.value = true;
  try {
    await $fetch("/api/decks", { method: "PATCH", body: { id, name } });
    editingDeckId.value = null;
    await loadFirstPage();
  } catch (err) {
    renameDeckError.value = extractErrorMessage(err, "Failed to rename deck.");
  } finally {
    isRenamingDeck.value = false;
  }
}

const deletingDeckId = ref<number | null>(null);
const deleteDeckError = ref<string | null>(null);

async function deleteDeck(id: number) {
  deleteDeckError.value = null;
  deletingDeckId.value = id;
  try {
    await $fetch("/api/decks", { method: "DELETE", body: { id } });
    await loadFirstPage();
  } catch (err) {
    deleteDeckError.value = extractErrorMessage(err, "Failed to delete deck.");
  } finally {
    deletingDeckId.value = null;
  }
}

const exportPath = ref("");
const includeAudio = ref(false);
const isExporting = ref(false);
const exportSummary = ref<string | null>(null);
const exportError = ref<string | null>(null);

async function exportDeck() {
  if (selectedId === null || !exportPath.value.trim()) return;

  exportSummary.value = null;
  exportError.value = null;
  isExporting.value = true;
  try {
    const result = await $fetch<{ exportedTo: string; cardCount: number; audioFileCount: number }>(
      "/api/decks/export",
      {
        method: "POST",
        body: {
          scope: { type: activeType.value, id: selectedId.value },
          destPath: exportPath.value.trim(),
          includeAudio: includeAudio.value,
        },
      },
    );
    exportSummary.value = `Exported ${result.cardCount} card${result.cardCount === 1 ? "" : "s"} (${result.audioFileCount} audio file${result.audioFileCount === 1 ? "" : "s"}) to ${result.exportedTo}`;
  } catch (err) {
    exportError.value = extractErrorMessage(err, "Failed to export deck.");
  } finally {
    isExporting.value = false;
  }
}

const previewCard = ref<DeckCard | null>(null);

async function onPreviewCardUpdated(updated: DeckCard) {
  previewCard.value = updated;
  replaceDeckCard(updated);
}

const removingCardId = ref<number | null>(null);
const removeCardError = ref<string | null>(null);

async function removeCardFromManualDeck(cardId: number) {
  if (selectedId.value === null) return;

  removeCardError.value = null;
  removingCardId.value = cardId;
  try {
    await $fetch("/api/decks/cards", { method: "DELETE", body: { deckId: selectedId.value, cardId } });
    deckCards.value = deckCards.value.filter((c) => c.id !== cardId);
  } catch (err) {
    removeCardError.value = extractErrorMessage(err, "Failed to remove card from deck.");
  } finally {
    removingCardId.value = null;
  }
}

const addCardQuery = ref("");
const addCardResults = ref<DeckCard[]>([]);
const addAnimeResults = ref<AniListResult[] | null>(null);
const addCardPending = ref(false);
const addCardError = ref<string | null>(null);
const addingCardId = ref<number | null>(null);
const addAnimeModalTarget = ref<AniListResult | null>(null);

let addCardDebounce: ReturnType<typeof setTimeout> | null = null;
let addCardSearchGeneration = 0;

async function runAddCardSearch() {
  const q = addCardQuery.value.trim();
  const generation = ++addCardSearchGeneration;

  if (q.length < 2) {
    addCardResults.value = [];
    addAnimeResults.value = null;
    addCardPending.value = false;
    return;
  }

  addCardPending.value = true;
  addCardError.value = null;
  addAnimeResults.value = null;
  try {
    const res = await $fetch<{ cards: DeckCard[] }>("/api/search", { query: { q } });
    if (generation !== addCardSearchGeneration) return;
    addCardResults.value = res.cards;
  } catch (err) {
    if (generation !== addCardSearchGeneration) return;
    addCardError.value = extractErrorMessage(err, "Search failed.");
    addCardPending.value = false;
    return;
  }

  if (addCardResults.value.length === 0) {
    try {
      const res = await $fetch<{ results: AniListResult[] }>("/api/lookup/anilist-search", { query: { q } });
      if (generation === addCardSearchGeneration) addAnimeResults.value = res.results;
    } catch {
      // AniList unreachable folds into the plain "no matching cards" state below,
      // same as the nav bar's global search fallback.
    }
  }
  if (generation === addCardSearchGeneration) addCardPending.value = false;
}

function onAddCardInput() {
  if (addCardDebounce) clearTimeout(addCardDebounce);
  addCardDebounce = setTimeout(runAddCardSearch, 250);
}

function resetAddCardSearch() {
  addCardQuery.value = "";
  addCardResults.value = [];
  addAnimeResults.value = null;
  addCardError.value = null;
}

async function addCardToCurrentDeck(cardId: number) {
  if (selectedId.value === null) return;

  addCardError.value = null;
  addingCardId.value = cardId;
  try {
    await $fetch("/api/decks/cards", { method: "POST", body: { deckId: selectedId.value, cardId } });
    await Promise.all([loadFirstDeckCardsPage(), refreshMemberships()]);
  } catch (err) {
    addCardError.value = extractErrorMessage(err, "Failed to add card to deck.");
  } finally {
    addingCardId.value = null;
  }
}

function openAddAnimeModal(result: AniListResult) {
  addAnimeModalTarget.value = result;
}

async function closeAddAnimeModal() {
  addAnimeModalTarget.value = null;
  resetAddCardSearch();
  await Promise.all([loadFirstDeckCardsPage(), refreshMemberships()]);
}

function sourceBadges(c: DeckCard): string[] {
  const badges: string[] = [];
  if (c.localVideoPath) badges.push("Local video");
  if (c.localAudioPath) badges.push("Local audio");
  if (c.animethemesVideoUrl) badges.push("Remote video");
  if (c.animethemesAudioUrl) badges.push("Remote audio");
  return badges;
}

function setType(type: DeckType) {
  editingDeckId.value = null;
  createDeckError.value = null;
  showNewDeckForm.value = false;
  newDeckName.value = "";
  searchInput.value = "";
  searchQuery.value = "";
  router.push({ query: { type } });
}

function resetCardSearch() {
  cardSearchInput.value = "";
  cardSearchQuery.value = "";
}

function selectDeck(id: number) {
  exportSummary.value = null;
  exportError.value = null;
  resetAddCardSearch();
  resetCardSearch();
  router.push({ query: { type: activeType.value, id } });
}

function backToDecks() {
  resetAddCardSearch();
  resetCardSearch();
  router.push({ query: { type: activeType.value } });
}
</script>

<template>
  <main class="decks">
    <template v-if="selectedId === null">
      <header class="decks-header">
        <h1>Decks</h1>
        <div class="header-controls">
          <div class="tab-seg" role="tablist">
            <button
              type="button"
              class="tab-seg-btn"
              :class="{ active: activeType === 'anime' }"
              @click="setType('anime')"
            >
              By title
            </button>
            <button
              type="button"
              class="tab-seg-btn"
              :class="{ active: activeType === 'artist' }"
              @click="setType('artist')"
            >
              By artist
            </button>
            <button
              type="button"
              class="tab-seg-btn"
              :class="{ active: activeType === 'created' }"
              @click="setType('created')"
            >
              Created
            </button>
          </div>
          <input
            v-model="searchInput"
            type="text"
            :placeholder="searchPlaceholder"
            class="search-input"
            @input="onSearchInput"
          />
          <NuxtLink to="/study?type=all" class="study-all-btn">Study all</NuxtLink>
        </div>
      </header>

      <div class="decks-body">
      <div v-if="initialPending" class="state">Loading...</div>
      <div v-else-if="initialError" class="state state-error">Couldn't load decks. Try refreshing.</div>
      <template v-else>
        <div v-if="deckItems.length || (activeType === 'created' && !searchQuery)" class="deck-grid">
          <div
            v-for="item in deckItems"
            :key="item.id"
            class="deck-tile"
            :class="{ 'deck-tile-clickable': editingDeckId !== item.id }"
            @click="editingDeckId === item.id ? undefined : selectDeck(item.id)"
          >
            <div class="deck-tile-cover">
              <img v-if="item.coverImageUrl" :src="item.coverImageUrl" alt="" />
              <div
                v-else-if="activeType !== 'anime'"
                class="deck-tile-monogram"
                :style="{ '--tint': `var(${deckTint(item.id)})` }"
              >
                <span class="deck-tile-monogram-letter">{{ deckInitial(item.label) }}</span>
                <span v-if="activeType === 'created'" class="deck-tile-monogram-badge" aria-hidden="true">✦</span>
              </div>
              <span v-if="item.dueCount" class="deck-tile-due">{{ item.dueCount }} due</span>
            </div>
            <template v-if="activeType === 'created' && editingDeckId === item.id">
              <div class="deck-rename-form" @click.stop>
                <input v-model="editDeckName" type="text" :disabled="isRenamingDeck" class="path-input" />
                <div class="deck-tile-new-actions">
                  <button
                    type="button"
                    class="export-btn"
                    :disabled="isRenamingDeck || !editDeckName.trim()"
                    @click="saveRenameDeck(item.id)"
                  >
                    Save
                  </button>
                  <button type="button" class="rename-btn" :disabled="isRenamingDeck" @click="cancelRenameDeck">
                    Cancel
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="deck-tile-meta" :title="item.sublabel ?? undefined">
                <span class="deck-tile-label">{{ item.label }}</span>
                <span class="deck-tile-count">
                  {{ item.cardCount }} card{{ item.cardCount === 1 ? "" : "s" }}
                  <template v-if="formatPassRate(item.passRate)"> &middot; {{ formatPassRate(item.passRate) }}</template>
                </span>
              </div>
              <div v-if="activeType === 'created'" class="deck-tile-actions" @click.stop>
                <button type="button" class="rename-btn" @click="startRenameDeck(item)">Rename</button>
                <button
                  type="button"
                  class="remove-btn"
                  :disabled="deletingDeckId === item.id"
                  @click="deleteDeck(item.id)"
                >
                  {{ deletingDeckId === item.id ? "Deleting..." : "Delete" }}
                </button>
              </div>
            </template>
          </div>

          <div v-if="activeType === 'created'" class="deck-tile deck-tile-new-wrap">
            <template v-if="showNewDeckForm">
              <div class="deck-tile-cover deck-tile-cover-empty" />
              <div class="deck-tile-new-form" @click.stop>
                <input
                  v-model="newDeckName"
                  type="text"
                  placeholder="Deck name"
                  :disabled="isCreatingDeck"
                  class="path-input"
                  @keyup.enter="createDeck"
                />
                <div class="deck-tile-new-actions">
                  <button
                    type="button"
                    class="export-btn"
                    :disabled="isCreatingDeck || !newDeckName.trim()"
                    @click="createDeck"
                  >
                    {{ isCreatingDeck ? "Creating..." : "Create" }}
                  </button>
                  <button type="button" class="rename-btn" :disabled="isCreatingDeck" @click="cancelNewDeck">
                    Cancel
                  </button>
                </div>
                <p v-if="createDeckError" class="export-error create-deck-error">{{ createDeckError }}</p>
              </div>
            </template>
            <button v-else type="button" class="deck-tile-new" @click="showNewDeckForm = true">+ New deck</button>
          </div>
        </div>
        <p v-else-if="searchQuery" class="state">No decks match "{{ searchQuery }}".</p>
        <p v-else class="state">No decks yet. <NuxtLink to="/cards">Add a card</NuxtLink> to start one.</p>
        <p v-if="renameDeckError" class="export-error create-deck-error">{{ renameDeckError }}</p>
        <p v-if="deleteDeckError" class="export-error create-deck-error">{{ deleteDeckError }}</p>
        <div v-if="deckItems.length" ref="sentinelRef" class="scroll-sentinel">
          <span v-if="loadingMore" class="loading-more">Loading more...</span>
        </div>
      </template>
      </div>
    </template>

    <template v-else>
      <header class="decks-header">
        <div class="header-title">
          <button type="button" class="back-btn" @click="backToDecks">&larr; Back to decks</button>
        </div>
        <div class="header-controls">
          <input
            v-model="cardSearchInput"
            type="text"
            placeholder="Search this deck's cards..."
            class="search-input"
            @input="onCardSearchInput"
          />
          <NuxtLink
            v-if="activeType !== 'created' && deckLabel"
            :to="`/study?type=${activeType}&id=${selectedId}`"
            class="study-all-btn"
          >
            Study this deck
          </NuxtLink>
        </div>
      </header>

      <div class="decks-body">
      <div v-if="cardsInitialPending" class="state">Loading...</div>
      <div v-else-if="cardsInitialError" class="state state-error">Couldn't load this deck. Try refreshing.</div>
      <template v-else>
        <div class="deck-detail-title">
          <img v-if="selectedDeckCover" :src="selectedDeckCover" alt="" class="cover-thumb cover-thumb-lg" />
          <h2>{{ deckLabel }}</h2>
        </div>

        <div v-if="activeType === 'created'" class="add-card-block">
          <h3>Add cards</h3>
          <input
            v-model="addCardQuery"
            type="text"
            placeholder="Search cards, or a new anime title..."
            class="path-input"
            @input="onAddCardInput"
          />
          <p v-if="addCardPending" class="state">Searching...</p>
          <p v-else-if="addCardError" class="export-error">{{ addCardError }}</p>
          <ul v-else-if="addCardResults.length" class="add-card-results">
            <li v-for="r in addCardResults" :key="r.id" class="add-card-result-row">
              <span class="add-card-result-text">
                {{ r.songTitle }}
                <span class="deck-sublabel">{{ r.artistName }} - {{ r.animeTitleEnglish }}</span>
              </span>
              <button
                v-if="!isCardInDeck(r.id)"
                type="button"
                class="export-btn add-card-btn"
                :disabled="addingCardId === r.id"
                @click="addCardToCurrentDeck(r.id)"
              >
                {{ addingCardId === r.id ? "Adding..." : "Add" }}
              </button>
              <span v-else class="added-badge">Added</span>
            </li>
          </ul>
          <template v-else-if="addAnimeResults">
            <p class="add-card-group-label">Add a new anime</p>
            <ul v-if="addAnimeResults.length" class="add-card-results">
              <li v-for="r in addAnimeResults" :key="r.aniListId" class="add-card-result-row">
                <span class="add-card-result-text">
                  {{ r.titleRomaji }}
                  <span v-if="r.titleEnglish" class="deck-sublabel">{{ r.titleEnglish }}</span>
                </span>
                <button type="button" class="export-btn add-card-btn" @click="openAddAnimeModal(r)">Select</button>
              </li>
            </ul>
            <p v-else class="state">No matching cards or anime found for "{{ addCardQuery.trim() }}".</p>
          </template>
        </div>

        <ul v-if="deckCards.length" class="deck-card-list">
          <li v-for="c in deckCards" :key="c.id" class="deck-card-row">
            <div class="deck-card-row-main">
              <img
                v-if="activeType === 'anime' && c.animeCoverImageUrl"
                :src="c.animeCoverImageUrl"
                alt=""
                class="cover-thumb"
              />
              <div class="deck-card-row-text">
                <span class="song-title">{{ c.songTitle }}</span>
                <span class="deck-sublabel">
                  <NuxtLink
                    v-if="!isCurrentDeck('artist', c.artistId)"
                    :to="artistDeckPath(c.artistId)"
                    class="deck-link"
                    >{{ c.artistName }}</NuxtLink
                  >
                  <template v-else>{{ c.artistName }}</template>
                  -
                  <NuxtLink v-if="!isCurrentDeck('anime', c.animeId)" :to="animeDeckPath(c.animeId)" class="deck-link">{{
                    c.animeTitleEnglish
                  }}</NuxtLink>
                  <template v-else>{{ c.animeTitleEnglish }}</template>
                  ({{ c.themeSlot }})
                </span>
                <div class="badges">
                  <span v-for="badge in sourceBadges(c)" :key="badge" class="badge">{{ badge }}</span>
                </div>
              </div>
              <button
                v-if="sourceBadges(c).length"
                type="button"
                class="preview-btn"
                @click="previewCard = c"
              >
                Preview
              </button>
              <button
                v-if="activeType === 'created'"
                type="button"
                class="remove-btn deck-card-remove-btn"
                :disabled="removingCardId === c.id"
                @click="removeCardFromManualDeck(c.id)"
              >
                {{ removingCardId === c.id ? "Removing..." : "Remove" }}
              </button>
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
              <p v-if="downloadError[c.id]" class="export-error">{{ downloadError[c.id] }}</p>
            </div>
          </li>
        </ul>
        <p v-else-if="cardSearchQuery" class="state">No cards match "{{ cardSearchQuery }}".</p>
        <p v-else class="state">No cards in this deck.</p>
        <p v-if="removeCardError" class="export-error">{{ removeCardError }}</p>
        <div v-if="deckCards.length" ref="cardsSentinelRef" class="scroll-sentinel">
          <span v-if="cardsLoadingMore" class="loading-more">Loading more...</span>
        </div>

        <div v-if="activeType !== 'created'" class="export-block">
          <h3>Export deck</h3>
          <div class="export-form">
            <input
              v-model="exportPath"
              type="text"
              placeholder="/path/to/empty/or/new/folder"
              :disabled="isExporting"
              class="path-input"
            />
            <label class="checkbox-label">
              <input v-model="includeAudio" type="checkbox" :disabled="isExporting" />
              Include audio
            </label>
            <button type="button" class="export-btn" :disabled="isExporting || !exportPath.trim()" @click="exportDeck">
              {{ isExporting ? "Exporting..." : "Export" }}
            </button>
          </div>
          <p v-if="exportSummary" class="export-summary">{{ exportSummary }}</p>
          <p v-if="exportError" class="export-error">{{ exportError }}</p>
        </div>
      </template>
      </div>
    </template>

    <CardPreviewModal
      :card="previewCard"
      :open="previewCard !== null"
      :has-default-download-folder="hasDefaultDownloadFolder"
      :audio-only="audioOnly"
      @close="previewCard = null"
      @updated="onPreviewCardUpdated"
    />

    <DeckAddAnimeModal
      :open="addAnimeModalTarget !== null"
      :target="addAnimeModalTarget"
      :deck-id="selectedId"
      @close="closeAddAnimeModal"
    />
  </main>
</template>

<style scoped>
/* Fills the content column, like /study and /cards after 50b/50c. */
.decks {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.decks-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 28px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
}

.decks-header h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  line-height: 1;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tab-seg-btn {
  padding: 8px 16px;
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.tab-seg-btn:first-child {
  border-left: none;
}

/* Border and glow, never a fill - same reasoning as the old .toggle-btn.active
   had: main.css's ambient-glass block replaces backgrounds with !important,
   so a solid fill would be stripped under ambient mode. */
.tab-seg-btn.active {
  background: var(--surface-raised);
  color: var(--text);
}

.decks-header .search-input {
  width: 230px;
  margin: 0;
}

.study-all-btn {
  flex: none;
  display: inline-block;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.decks-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 28px 28px;
}

h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  line-height: 1;
}

.deck-detail-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.back-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
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

/* auto-fill + a bounded min width, not a fixed column count - fixed columns
   stretch each 2:3 cover to fill the row on a wide window, making rows tall
   enough that only about one fits before the body has to scroll. */
.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px;
}

.deck-tile {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deck-tile-clickable {
  cursor: pointer;
}

.deck-tile-clickable:hover .deck-tile-cover {
  border-color: var(--accent);
}

.deck-tile-cover {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  overflow: hidden;
}

.deck-tile-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.deck-tile-monogram {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--tint) 20%, var(--surface-raised));
}

.deck-tile-monogram-letter {
  font-family: var(--font-display);
  font-size: 42px;
  font-weight: 400;
  line-height: 1;
  color: var(--tint);
}

.deck-tile-monogram-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 14px;
  color: var(--tint);
}

.deck-tile-due {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 11px;
  font-weight: 900;
}

.deck-tile-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.deck-tile-label {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deck-tile-count {
  font-size: 12px;
  color: var(--faint);
}

.deck-tile-actions {
  display: flex;
  gap: 8px;
}

.deck-tile-new-wrap {
  gap: 0;
}

.deck-tile-new {
  aspect-ratio: 2 / 3;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
  background: none;
  color: var(--faint);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.deck-tile-new:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.deck-tile-cover-empty {
  border-style: dashed;
}

.deck-tile-new-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deck-tile-new-actions {
  display: flex;
  gap: 8px;
}

.deck-grid .scroll-sentinel {
  grid-column: 1 / -1;
}

.deck-card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deck-card-row {
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.deck-card-row-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.deck-card-row-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.deck-card-remove-btn {
  flex: none;
}

.preview-btn {
  flex: none;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.song-title {
  font-weight: 700;
}

.cover-thumb {
  flex: none;
  width: 48px;
  height: 68px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--surface-raised);
}

.download-section {
  margin-top: 10px;
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

.cover-thumb-lg {
  width: 64px;
  height: 90px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.badge {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  color: var(--accent-secondary-ink);
  font-size: 12px;
  font-weight: 700;
}

.deck-sublabel {
  color: var(--muted);
  font-size: 14px;
}

.create-deck-error {
  margin-top: -8px;
  margin-bottom: 16px;
}

.rename-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.rename-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.remove-btn {
  flex: none;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.remove-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.deck-rename-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.export-block {
  margin-top: 24px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.export-block h3 {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 800;
}

.export-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.path-input {
  flex: 1;
  min-width: 220px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.path-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.export-btn {
  flex: none;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 800;
  cursor: pointer;
}

.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.export-summary {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.export-error {
  margin: 10px 0 0;
  color: var(--fail);
  font-size: 14px;
}

.add-card-block {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.add-card-block h3 {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 800;
}

.add-card-group-label {
  margin: 10px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}

.add-card-results {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-card-result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
}

.add-card-result-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.add-card-btn {
  padding: 6px 14px;
  font-size: 13px;
}

.added-badge {
  flex: none;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--pass);
  color: var(--pass-ink);
  font-size: 13px;
  font-weight: 700;
}

/* 50h: same breakpoint as .study-grid. The poster grid (repeat(auto-fill,
   minmax(150px, 1fr))) already reflows on its own - only the headers (list
   and detail share .decks-header/.header-controls) need to wrap here.
   Placed last so it wins the source-order tiebreak. */
@media (max-width: 820px) {
  .decks-header,
  .header-controls {
    flex-wrap: wrap;
  }
}
</style>
