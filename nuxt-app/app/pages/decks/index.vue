<script setup lang="ts">
interface ArtistDeck {
  id: number;
  name: string;
  cardCount: number;
}

interface AnimeDeck {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  coverImageUrl: string | null;
  cardCount: number;
}

interface ManualDeck {
  id: number;
  name: string;
  createdAt: string;
  cardCount: number;
}

type DeckType = "artist" | "anime" | "created";

interface DeckItem {
  id: number;
  label: string;
  sublabel: string | null;
  coverImageUrl: string | null;
  cardCount: number;
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
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
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

const page = computed(() => {
  const raw = Number(route.query.page);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
});

const { data, pending, error, refresh } = await useFetch<{
  decks: ArtistDeck[] | AnimeDeck[] | ManualDeck[];
  page: number;
  totalPages: number;
}>("/api/decks", { query: computed(() => ({ type: activeType.value, page: page.value })) });

const { data: membershipsData, refresh: refreshMemberships } = await useFetch<{
  memberships: Record<number, number[]>;
}>("/api/decks/memberships");

function isCardInDeck(cardId: number): boolean {
  if (selectedId.value === null) return false;
  return (membershipsData.value?.memberships[cardId] ?? []).includes(selectedId.value);
}

function goToPage(p: number) {
  router.push({ query: { ...route.query, page: p } });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const deckItems = computed<DeckItem[]>(() => {
  if (!data.value) return [];
  if (activeType.value === "artist") {
    return (data.value.decks as ArtistDeck[]).map((d) => ({
      id: d.id,
      label: d.name,
      sublabel: null,
      coverImageUrl: null,
      cardCount: d.cardCount,
    }));
  }
  if (activeType.value === "created") {
    return (data.value.decks as ManualDeck[]).map((d) => ({
      id: d.id,
      label: d.name,
      sublabel: `Created ${formatDate(d.createdAt)}`,
      coverImageUrl: null,
      cardCount: d.cardCount,
    }));
  }
  return (data.value.decks as AnimeDeck[]).map((d) => ({
    id: d.id,
    label: d.titleEnglish,
    sublabel: d.titleRomaji,
    coverImageUrl: d.coverImageUrl,
    cardCount: d.cardCount,
  }));
});

const selectedDeckCover = computed<string | null>(() => {
  if (selectedId.value === null) return null;
  return deckItems.value.find((item) => item.id === selectedId.value)?.coverImageUrl ?? null;
});

const cardPage = computed(() => {
  const raw = Number(route.query.cardPage);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
});

const {
  data: deckDetail,
  pending: detailPending,
  error: detailError,
  execute: fetchDeckDetail,
} = await useFetch<{ deckLabel: string; cards: DeckCard[]; page: number; totalPages: number }>(
  "/api/decks/cards",
  {
    query: computed(() => ({ type: activeType.value, id: selectedId.value, page: cardPage.value })),
    immediate: selectedId.value !== null,
  },
);

watch([selectedId, cardPage], ([id]) => {
  if (id !== null) {
    fetchDeckDetail();
  }
});

function goToCardPage(p: number) {
  router.push({ query: { ...route.query, cardPage: p } });
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

const newDeckName = ref("");
const isCreatingDeck = ref(false);
const createDeckError = ref<string | null>(null);

async function createDeck() {
  const name = newDeckName.value.trim();
  if (!name) return;

  createDeckError.value = null;
  isCreatingDeck.value = true;
  try {
    await $fetch("/api/decks", { method: "POST", body: { name } });
    newDeckName.value = "";
    await refresh();
  } catch (err) {
    createDeckError.value = extractErrorMessage(err, "Failed to create deck.");
  } finally {
    isCreatingDeck.value = false;
  }
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
    await refresh();
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
    await refresh();
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
  await fetchDeckDetail();
}

const removingCardId = ref<number | null>(null);
const removeCardError = ref<string | null>(null);

async function removeCardFromManualDeck(cardId: number) {
  if (selectedId.value === null) return;

  removeCardError.value = null;
  removingCardId.value = cardId;
  try {
    await $fetch("/api/decks/cards", { method: "DELETE", body: { deckId: selectedId.value, cardId } });
    await fetchDeckDetail();
  } catch (err) {
    removeCardError.value = extractErrorMessage(err, "Failed to remove card from deck.");
  } finally {
    removingCardId.value = null;
  }
}

const addCardQuery = ref("");
const addCardResults = ref<DeckCard[]>([]);
const addCardPending = ref(false);
const addCardError = ref<string | null>(null);
const addingCardId = ref<number | null>(null);

let addCardDebounce: ReturnType<typeof setTimeout> | null = null;

async function runAddCardSearch() {
  const q = addCardQuery.value.trim();
  if (q.length < 2) {
    addCardResults.value = [];
    addCardPending.value = false;
    return;
  }

  addCardPending.value = true;
  addCardError.value = null;
  try {
    const res = await $fetch<{ cards: DeckCard[] }>("/api/search", { query: { q } });
    addCardResults.value = res.cards;
  } catch (err) {
    addCardError.value = extractErrorMessage(err, "Search failed.");
  } finally {
    addCardPending.value = false;
  }
}

function onAddCardInput() {
  if (addCardDebounce) clearTimeout(addCardDebounce);
  addCardDebounce = setTimeout(runAddCardSearch, 250);
}

function resetAddCardSearch() {
  addCardQuery.value = "";
  addCardResults.value = [];
  addCardError.value = null;
}

async function addCardToCurrentDeck(cardId: number) {
  if (selectedId.value === null) return;

  addCardError.value = null;
  addingCardId.value = cardId;
  try {
    await $fetch("/api/decks/cards", { method: "POST", body: { deckId: selectedId.value, cardId } });
    await Promise.all([fetchDeckDetail(), refreshMemberships()]);
  } catch (err) {
    addCardError.value = extractErrorMessage(err, "Failed to add card to deck.");
  } finally {
    addingCardId.value = null;
  }
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
  router.push({ query: { type } });
}

function selectDeck(id: number) {
  exportSummary.value = null;
  exportError.value = null;
  resetAddCardSearch();
  router.push({ query: { type: activeType.value, id } });
}

function backToDecks() {
  resetAddCardSearch();
  router.push({ query: { type: activeType.value } });
}
</script>

<template>
  <main class="decks">
    <h1>Decks</h1>
    <p class="hint">Cards grouped by artist or by anime title.</p>
    <NuxtLink to="/study?type=all" class="study-link">Study all decks</NuxtLink>
    <NuxtLink to="/stats" class="study-link stats-link">Review stats</NuxtLink>

    <template v-if="selectedId === null">
      <div class="toggle">
        <button
          type="button"
          class="toggle-btn"
          :class="{ active: activeType === 'artist' }"
          @click="setType('artist')"
        >
          By Artist
        </button>
        <button
          type="button"
          class="toggle-btn"
          :class="{ active: activeType === 'anime' }"
          @click="setType('anime')"
        >
          By Title
        </button>
        <button
          type="button"
          class="toggle-btn"
          :class="{ active: activeType === 'created' }"
          @click="setType('created')"
        >
          Created
        </button>
      </div>

      <form v-if="activeType === 'created'" class="export-form create-deck-form" @submit.prevent="createDeck">
        <input
          v-model="newDeckName"
          type="text"
          placeholder="New deck name"
          :disabled="isCreatingDeck"
          class="path-input"
        />
        <button type="submit" class="export-btn" :disabled="isCreatingDeck || !newDeckName.trim()">
          {{ isCreatingDeck ? "Creating..." : "New deck" }}
        </button>
      </form>
      <p v-if="createDeckError" class="export-error create-deck-error">{{ createDeckError }}</p>

      <div v-if="pending" class="state">Loading...</div>
      <div v-else-if="error" class="state state-error">Couldn't load decks. Try refreshing.</div>
      <template v-else>
        <ul v-if="deckItems.length" class="deck-list">
          <li
            v-for="item in deckItems"
            :key="item.id"
            class="deck-row"
            :class="{ 'deck-row-clickable': editingDeckId !== item.id }"
            @click="editingDeckId === item.id ? undefined : selectDeck(item.id)"
          >
            <img v-if="item.coverImageUrl" :src="item.coverImageUrl" alt="" class="cover-thumb" />
            <template v-if="activeType === 'created' && editingDeckId === item.id">
              <div class="deck-rename-form" @click.stop>
                <input v-model="editDeckName" type="text" :disabled="isRenamingDeck" class="path-input" />
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
            </template>
            <template v-else>
              <div class="deck-info">
                <span class="deck-label">{{ item.label }}</span>
                <span v-if="item.sublabel" class="deck-sublabel">{{ item.sublabel }}</span>
              </div>
              <span class="deck-count">{{ item.cardCount }} card{{ item.cardCount === 1 ? "" : "s" }}</span>
              <div v-if="activeType === 'created'" class="deck-manual-actions" @click.stop>
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
          </li>
        </ul>
        <p v-else-if="activeType === 'created'" class="state">
          No manual decks yet. Create one above.
        </p>
        <p v-else class="state">No decks yet. <NuxtLink to="/cards/new">Add a card</NuxtLink> to start one.</p>
        <p v-if="renameDeckError" class="export-error create-deck-error">{{ renameDeckError }}</p>
        <p v-if="deleteDeckError" class="export-error create-deck-error">{{ deleteDeckError }}</p>
        <Pager :page="data?.page ?? 1" :total-pages="data?.totalPages ?? 1" @change="goToPage" />
      </template>
    </template>

    <template v-else>
      <button type="button" class="back-btn" @click="backToDecks">&larr; Back to decks</button>

      <div v-if="detailPending" class="state">Loading...</div>
      <div v-else-if="detailError" class="state state-error">Couldn't load this deck. Try refreshing.</div>
      <template v-else-if="deckDetail">
        <div class="deck-detail-header">
          <div class="deck-detail-title">
            <img v-if="selectedDeckCover" :src="selectedDeckCover" alt="" class="cover-thumb cover-thumb-lg" />
            <h2>{{ deckDetail.deckLabel }}</h2>
          </div>
          <NuxtLink
            v-if="activeType !== 'created'"
            :to="`/study?type=${activeType}&id=${selectedId}`"
            class="study-link"
          >
            Study this deck
          </NuxtLink>
        </div>

        <div v-if="activeType === 'created'" class="add-card-block">
          <h3>Add cards</h3>
          <input
            v-model="addCardQuery"
            type="text"
            placeholder="Search cards to add..."
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
          <p v-else-if="addCardQuery.trim().length >= 2" class="state">No matching cards.</p>
        </div>

        <ul v-if="deckDetail.cards.length" class="deck-card-list">
          <li v-for="c in deckDetail.cards" :key="c.id" class="deck-card-row">
            <div class="deck-card-row-main">
              <img
                v-if="activeType === 'anime' && c.animeCoverImageUrl"
                :src="c.animeCoverImageUrl"
                alt=""
                class="cover-thumb"
              />
              <div class="deck-card-row-text">
                <span class="song-title">{{ c.songTitle }}</span>
                <span class="deck-sublabel">{{ c.artistName }} - {{ c.animeTitleEnglish }} ({{ c.themeSlot }})</span>
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
          </li>
        </ul>
        <p v-else class="state">No cards in this deck.</p>
        <p v-if="removeCardError" class="export-error">{{ removeCardError }}</p>
        <Pager :page="deckDetail.page" :total-pages="deckDetail.totalPages" @change="goToCardPage" />

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
    </template>

    <CardPreviewModal
      :card="previewCard"
      :open="previewCard !== null"
      @close="previewCard = null"
      @updated="onPreviewCardUpdated"
    />
  </main>
</template>

<style scoped>
.decks {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
}

.hint {
  margin: 0 0 16px;
  color: var(--muted);
}

.study-link {
  display: inline-block;
  margin-bottom: 24px;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  text-decoration: none;
}

.stats-link {
  margin-left: 8px;
  background: var(--accent-secondary);
  color: var(--accent-secondary-ink);
}

h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
}

.deck-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.deck-detail-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  margin-bottom: 16px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
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

.deck-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deck-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.deck-row-clickable {
  cursor: pointer;
}

.deck-row-clickable:hover {
  border-color: var(--accent);
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

.deck-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.deck-label {
  font-weight: 700;
}

.deck-sublabel {
  color: var(--muted);
  font-size: 14px;
}

.deck-count {
  flex: none;
  color: var(--muted);
  font-size: 14px;
}

.create-deck-form {
  margin-bottom: 20px;
}

.create-deck-error {
  margin-top: -8px;
  margin-bottom: 16px;
}

.deck-manual-actions {
  display: flex;
  flex: none;
  gap: 8px;
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
  align-items: center;
  gap: 8px;
  flex: 1;
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
</style>
