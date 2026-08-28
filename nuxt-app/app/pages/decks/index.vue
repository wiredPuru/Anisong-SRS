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
  cardCount: number;
}

type DeckType = "artist" | "anime";

interface DeckItem {
  id: number;
  label: string;
  sublabel: string | null;
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
}

const route = useRoute();
const router = useRouter();

const activeType = computed<DeckType>(() => (route.query.type === "anime" ? "anime" : "artist"));

const selectedId = computed<number | null>(() => {
  const raw = route.query.id;
  if (typeof raw !== "string") return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
});

const { data, pending, error } = await useFetch<{ decks: ArtistDeck[] | AnimeDeck[] }>("/api/decks", {
  query: computed(() => ({ type: activeType.value })),
});

const deckItems = computed<DeckItem[]>(() => {
  if (!data.value) return [];
  if (activeType.value === "artist") {
    return (data.value.decks as ArtistDeck[]).map((d) => ({
      id: d.id,
      label: d.name,
      sublabel: null,
      cardCount: d.cardCount,
    }));
  }
  return (data.value.decks as AnimeDeck[]).map((d) => ({
    id: d.id,
    label: d.titleEnglish,
    sublabel: d.titleRomaji,
    cardCount: d.cardCount,
  }));
});

const {
  data: deckDetail,
  pending: detailPending,
  error: detailError,
  execute: fetchDeckDetail,
} = await useFetch<{ deckLabel: string; cards: DeckCard[] }>("/api/decks/cards", {
  query: computed(() => ({ type: activeType.value, id: selectedId.value })),
  immediate: selectedId.value !== null,
});

watch(selectedId, (id) => {
  if (id !== null) {
    fetchDeckDetail();
  }
});

function sourceBadges(c: DeckCard): string[] {
  const badges: string[] = [];
  if (c.localVideoPath) badges.push("Local video");
  if (c.localAudioPath) badges.push("Local audio");
  if (c.animethemesVideoUrl) badges.push("Remote video");
  if (c.animethemesAudioUrl) badges.push("Remote audio");
  return badges;
}

function setType(type: DeckType) {
  router.push({ query: { type } });
}

function selectDeck(id: number) {
  router.push({ query: { type: activeType.value, id } });
}

function backToDecks() {
  router.push({ query: { type: activeType.value } });
}
</script>

<template>
  <main class="decks">
    <h1>Decks</h1>
    <p class="hint">Cards grouped by artist or by anime title.</p>

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
      </div>

      <div v-if="pending" class="state">Loading...</div>
      <div v-else-if="error" class="state state-error">Couldn't load decks. Try refreshing.</div>
      <template v-else>
        <ul v-if="deckItems.length" class="deck-list">
          <li v-for="item in deckItems" :key="item.id" class="deck-row deck-row-clickable" @click="selectDeck(item.id)">
            <div class="deck-info">
              <span class="deck-label">{{ item.label }}</span>
              <span v-if="item.sublabel" class="deck-sublabel">{{ item.sublabel }}</span>
            </div>
            <span class="deck-count">{{ item.cardCount }} card{{ item.cardCount === 1 ? "" : "s" }}</span>
          </li>
        </ul>
        <p v-else class="state">No decks yet. <NuxtLink to="/cards/new">Add a card</NuxtLink> to start one.</p>
      </template>
    </template>

    <template v-else>
      <button type="button" class="back-btn" @click="backToDecks">&larr; Back to decks</button>

      <div v-if="detailPending" class="state">Loading...</div>
      <div v-else-if="detailError" class="state state-error">Couldn't load this deck. Try refreshing.</div>
      <template v-else-if="deckDetail">
        <h2>{{ deckDetail.deckLabel }}</h2>
        <ul v-if="deckDetail.cards.length" class="deck-card-list">
          <li v-for="c in deckDetail.cards" :key="c.id" class="deck-card-row">
            <span class="song-title">{{ c.songTitle }}</span>
            <span class="deck-sublabel">{{ c.artistName }} - {{ c.animeTitleEnglish }} ({{ c.themeSlot }})</span>
            <div class="badges">
              <span v-for="badge in sourceBadges(c)" :key="badge" class="badge">{{ badge }}</span>
            </div>
          </li>
        </ul>
        <p v-else class="state">No cards in this deck.</p>
      </template>
    </template>
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
  margin: 0 0 24px;
  color: var(--muted);
}

h2 {
  margin: 0 0 16px;
  font-size: 22px;
  font-weight: 800;
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
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.song-title {
  font-weight: 700;
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
</style>
