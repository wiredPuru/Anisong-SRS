<script setup lang="ts">
interface SongResult {
  cardId: number;
  animeTitle: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
  downloaded: boolean;
}

interface DeckResult {
  id: number;
  name: string;
  cardCount: number;
}

const props = defineProps<{ open: boolean; queuedCardIds: number[] }>();
const emit = defineEmits<{
  close: [];
  add: [cardId: number, position: "next" | "end"];
  "use-deck": [deck: { id: number; name: string }];
}>();

const SEARCH_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 2;

const tab = ref<"songs" | "decks">("songs");
const query = ref("");
const songs = ref<SongResult[]>([]);
const decks = ref<DeckResult[]>([]);
const loading = ref(false);
const failed = ref(false);
const input = ref<HTMLInputElement | null>(null);
const queued = computed(() => new Set(props.queuedCardIds));

let timer: ReturnType<typeof setTimeout> | null = null;
let latest = 0;

async function search() {
  const request = ++latest;
  const q = query.value.trim();
  failed.value = false;
  if (tab.value === "songs" && q.length < MIN_QUERY_LENGTH) {
    songs.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    if (tab.value === "songs") {
      const reply = await $fetch<{ results: SongResult[] }>("/api/party/host/card-search", { query: { q } });
      if (request === latest) songs.value = reply.results;
    } else {
      const reply = await $fetch<{ decks: DeckResult[] }>("/api/party/host/decks", { query: { type: "created", q } });
      if (request === latest) decks.value = reply.decks;
    }
  } catch {
    if (request === latest) failed.value = true;
  } finally {
    if (request === latest) loading.value = false;
  }
}

// A song search rarely names a deck, so each tab starts from an empty box.
watch(tab, () => {
  query.value = "";
  input.value?.focus();
});

watch([query, tab], () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(search, SEARCH_DELAY_MS);
});

watch(() => props.open, async (open) => {
  if (!open) return;
  void search();
  await nextTick();
  input.value?.focus();
});

function onKeydown(event: KeyboardEvent) {
  if (props.open && event.key === "Escape" && !event.isComposing) emit("close");
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="lite-add-title">
      <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">✕</button>
      <h2 id="lite-add-title" class="title">Add songs</h2>

      <input
        ref="input"
        v-model="query"
        class="search"
        type="search"
        :placeholder="tab === 'songs' ? 'Search your library: anime, song, or artist' : 'Search your decks'"
        aria-label="Search"
      />
      <div class="tabs" role="tablist">
        <button type="button" class="tab" :class="{ 'tab-on': tab === 'songs' }" role="tab" :aria-selected="tab === 'songs'" @click="tab = 'songs'">Songs</button>
        <button type="button" class="tab" :class="{ 'tab-on': tab === 'decks' }" role="tab" :aria-selected="tab === 'decks'" @click="tab = 'decks'">Decks</button>
      </div>

      <div class="results">
        <p v-if="failed" class="note error" role="alert">The search didn't work. Try again.</p>
        <template v-else-if="tab === 'songs'">
          <p v-if="query.trim().length < MIN_QUERY_LENGTH" class="note">Type at least {{ MIN_QUERY_LENGTH }} letters to search.</p>
          <p v-else-if="!songs.length && !loading" class="note">No song in your library matches.</p>
          <div v-for="song in songs" :key="song.cardId" class="row">
            <div class="grow">
              <p class="row-title">{{ song.animeTitle }}</p>
              <p class="row-sub">{{ song.songTitle }} · {{ song.artistName }} · {{ formatThemeSlotLabel(song.themeSlot) }}</p>
            </div>
            <span v-if="queued.has(song.cardId)" class="badge">Added ✓</span>
            <template v-else>
              <button type="button" class="btn" @click="emit('add', song.cardId, 'next')">Play next</button>
              <button type="button" class="btn" @click="emit('add', song.cardId, 'end')">+ Queue</button>
            </template>
          </div>
        </template>
        <template v-else>
          <p v-if="!decks.length && !loading" class="note">No deck matches. Decks are made on the Decks page of the main app.</p>
          <div v-for="deck in decks" :key="deck.id" class="row">
            <div class="grow">
              <p class="row-title">{{ deck.name }}</p>
              <p class="row-sub">{{ deck.cardCount }} {{ deck.cardCount === 1 ? "song" : "songs" }}</p>
            </div>
            <button type="button" class="btn" :disabled="!deck.cardCount" @click="emit('use-deck', deck)">Use as playlist</button>
          </div>
        </template>
      </div>

      <p class="note">
        {{ tab === "songs" ? "Hand picks play before the filter picks." : "The playlist then picks only from that deck, with your filters still applied." }}
      </p>
    </div>
  </div>
</template>

<style scoped>
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
  max-width: 720px;
  max-height: min(760px, 88vh);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border-radius: calc(var(--radius) + 8px);
  background: var(--bg);
  border: 1px solid var(--outline);
  box-shadow: var(--shadow-soft);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
}

.search {
  height: 48px;
  padding: 0 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  background: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.tab-on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.results {
  flex: 1;
  min-height: 200px;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 4px;
}

.grow {
  flex: 1;
  min-width: 0;
}

.row-title,
.row-sub {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-title {
  font-weight: 600;
}

.row-sub,
.note {
  color: var(--faint);
  font-size: 13px;
}

.note {
  margin: 0;
}

.error {
  color: var(--fail);
}

.btn {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.badge {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
</style>
