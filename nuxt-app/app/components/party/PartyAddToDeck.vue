<script setup lang="ts">
const props = defineProps<{ cardId: number }>();

interface DeckOption {
  id: number;
  name: string;
}

const open = ref(false);
const query = ref("");
const decks = ref<DeckOption[]>([]);
const loading = ref(false);
const note = ref<string | null>(null);
// A library card has a positive id; a catalog song's is negative and has no card.
const inLibrary = computed(() => props.cardId > 0);

let request = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
async function fetchDecks() {
  const mine = ++request;
  loading.value = true;
  try {
    const result = await $fetch<{ decks: { id: number; name?: string }[] }>("/api/party/host/decks", {
      query: { type: "created", q: query.value.trim() || undefined },
    });
    if (mine === request) decks.value = result.decks.map((deck) => ({ id: deck.id, name: deck.name ?? `#${deck.id}` }));
  } catch {
    if (mine === request) decks.value = [];
  } finally {
    if (mine === request) loading.value = false;
  }
}

function toggle() {
  open.value = !open.value;
  if (open.value) {
    query.value = "";
    void fetchDecks();
  }
}

watch(query, () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(fetchDecks, 250);
});

// The note belongs to the song it was said about.
watch(() => props.cardId, () => {
  note.value = null;
  open.value = false;
});

async function add(deck: DeckOption) {
  try {
    const result = await $fetch<{ deckName: string; added: boolean }>("/api/party/host/deck-add", {
      method: "POST",
      body: { deckId: deck.id, cardId: props.cardId },
    });
    note.value = result.added ? `Added to ${result.deckName}.` : `Already in ${result.deckName}.`;
    open.value = false;
  } catch (err) {
    note.value = extractErrorMessage(err, "Could not add the song.");
  }
}
</script>

<template>
  <span class="add-deck">
    <button type="button" class="link-btn" :disabled="!inLibrary" :title="inLibrary ? 'Add this song to one of your decks' : 'Only songs from your library can go in a deck'" :aria-expanded="open" @click="toggle">
      Add to deck
    </button>
    <span v-if="note" class="add-note" role="status">{{ note }}</span>
    <div v-if="open" class="add-menu">
      <input v-model="query" type="search" class="add-search" placeholder="Search your decks" aria-label="Search your decks" @keydown.stop />
      <ul class="add-list" :aria-busy="loading">
        <li v-for="deck in decks" :key="deck.id">
          <button type="button" class="add-option" @click="add(deck)">{{ deck.name }}</button>
        </li>
        <li v-if="!decks.length && !loading" class="add-empty">No deck matches. Make one on the Decks page.</li>
      </ul>
    </div>
  </span>
</template>

<style scoped>
.add-deck {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.add-note {
  color: var(--muted);
  font-size: 13px;
}

.add-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 5;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.add-search {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
}

.add-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
}

.add-option {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.add-option:hover {
  background: var(--surface-sunken);
}

.add-empty {
  padding: 8px 10px;
  color: var(--muted);
  font-size: 13px;
}
</style>
