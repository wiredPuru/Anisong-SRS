<script setup lang="ts">
import type { PartyHostState } from "~/composables/usePartyHost";
import { deckRowLabel, type DeckRowNames, type DeckScopeType } from "~/utils/scopePick";

interface SongResult {
  cardId: number;
  animeTitle: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
}

interface CatalogResult {
  annSongId: number;
  animeTitle: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
}

interface GroupResult extends DeckRowNames {
  id: number;
  cardCount: number;
}

interface Group {
  type: DeckScopeType;
  heading: string;
  rows: { id: number; label: string; cardCount: number }[];
}

const GROUPS: { type: DeckScopeType; heading: string }[] = [
  { type: "anime", heading: "Anime" },
  { type: "artist", heading: "Artists" },
  { type: "created", heading: "Your decks" },
];
const GROUP_LIMIT = 5;

interface ShowResult {
  aniListId: number;
  titleEnglish: string;
  titleRomaji: string;
}
interface ShowTheme {
  songId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string;
  videoUrl: string | null;
  audioUrl: string | null;
  playable: boolean;
}

type Position = "next" | "end";

const props = defineProps<{ state: PartyHostState }>();

const query = ref("");
const groups = ref<Group[]>([]);
const shows = ref<ShowResult[]>([]);
const songs = ref<SongResult[]>([]);
const catalogSongs = ref<CatalogResult[]>([]);
const searching = ref(false);
const note = ref<string | null>(null);
const busy = ref(false);
const requests = createLatestRequest();
let debounce: ReturnType<typeof setTimeout> | null = null;

async function search() {
  const text = query.value.trim();
  const isCurrent = requests.start();
  if (text.length < 2) {
    groups.value = [];
    shows.value = [];
    songs.value = [];
    catalogSongs.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  try {
    const [found, songRes, catalogRes, showRes] = await Promise.all([
      Promise.all(
        GROUPS.map(async ({ type, heading }): Promise<Group> => {
          const res = await $fetch<{ decks: GroupResult[] }>("/api/party/host/decks", { query: { type, q: text } }).catch(() => ({ decks: [] }));
          const rows = res.decks
            .filter((deck) => deck.cardCount > 0)
            .slice(0, GROUP_LIMIT)
            .map((deck) => ({ id: deck.id, label: deckRowLabel(type, deck), cardCount: deck.cardCount }));
          return { type, heading, rows };
        }),
      ),
      $fetch<{ results: SongResult[] }>("/api/party/host/card-search", { query: { q: text } }).catch(() => ({ results: [] })),
      $fetch<{ results: CatalogResult[] }>("/api/party/host/catalog-search", { query: { q: text } }).catch(() => ({ results: [] })),
      $fetch<{ results: ShowResult[] }>("/api/party/host/anime-search", { query: { q: text } }).catch(() => ({ results: [] })),
    ]);
    if (!isCurrent()) return;
    groups.value = found.filter((group) => group.rows.length);
    shows.value = showRes.results.slice(0, GROUP_LIMIT);
    songs.value = songRes.results;
    const libraryKeys = new Set(songRes.results.map((r) => `${r.songTitle}|${r.themeSlot}`.toLowerCase()));
    catalogSongs.value = catalogRes.results.filter((r) => !libraryKeys.has(`${r.songTitle}|${r.themeSlot}`.toLowerCase()));
  } finally {
    if (isCurrent()) searching.value = false;
  }
}

// One open group at a time; its songs load on first open.
const openKey = ref<string | null>(null);
const openSongs = ref<SongResult[]>([]);
const openLoading = ref(false);
async function toggleGroup(type: DeckScopeType, row: { id: number }) {
  const key = `${type}:${row.id}`;
  if (openKey.value === key) {
    openKey.value = null;
    return;
  }
  openKey.value = key;
  openSongs.value = [];
  openLoading.value = true;
  try {
    const res = await $fetch<{ results: SongResult[] }>("/api/party/host/deck-songs", { query: { type, id: row.id } });
    if (openKey.value === key) openSongs.value = res.results;
  } catch {
    if (openKey.value === key) note.value = "Couldn't load that list's songs.";
  } finally {
    if (openKey.value === key) openLoading.value = false;
  }
}

// A show from AniList opens into every theme it has, like the /cards search.
const openShow = ref<number | null>(null);
const showThemes = ref<ShowTheme[]>([]);
const showLoading = ref(false);
async function toggleShow(show: ShowResult) {
  if (openShow.value === show.aniListId) {
    openShow.value = null;
    return;
  }
  openShow.value = show.aniListId;
  showThemes.value = [];
  showLoading.value = true;
  try {
    const res = await $fetch<{ themes: ShowTheme[] }>("/api/party/host/anime-themes", { method: "POST", body: { aniListId: show.aniListId } });
    if (openShow.value === show.aniListId) showThemes.value = res.themes;
  } catch {
    if (openShow.value === show.aniListId) note.value = "Couldn't look that show up.";
  } finally {
    if (openShow.value === show.aniListId) showLoading.value = false;
  }
}

async function addShowThemes(themes: ShowTheme[], position: Position, label: string) {
  const playable = themes.filter((theme) => theme.playable);
  if (!playable.length) {
    note.value = "None of those have a clip the Clip source setting allows.";
    return;
  }
  try {
    const res = await $fetch<{ cardIds: number[] }>("/api/party/host/anime-cards", {
      method: "POST",
      body: { themes: playable.map(({ songId, videoUrl, audioUrl }) => ({ songId, videoUrl, audioUrl })) },
    });
    await addCards(res.cardIds, position, label);
  } catch {
    note.value = "Couldn't add that.";
  }
}

function onInput() {
  openKey.value = null;
  openShow.value = null;
  note.value = null;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(search, 250);
}

// Songs still to come can be moved; the one on screen stays where it is.
const upcomingIds = computed(() => new Set(props.state.queue.slice(props.state.index + 1).map((item) => item.cardId)));
const currentId = computed(() => props.state.queue[props.state.index]?.cardId ?? null);
const hasResults = computed(() => shows.value.length > 0 || groups.value.length > 0 || songs.value.length > 0 || catalogSongs.value.length > 0);

function sendCommand(body: object) {
  return $fetch<{ loaded?: number; moved?: number }>("/api/party/host/command", { method: "POST", body });
}

function placedNote(label: string, loaded: number, moved: number, position: Position): string {
  const total = loaded + moved;
  if (!total) return "Nothing to add: that's the song playing now, or it has no playable clip.";
  const what = total === 1 ? `"${label}"` : `${total} songs from "${label}"`;
  return position === "next" ? `${what} cued next.` : `${what} added to the end.`;
}

// The server places the songs in one step, moving any already waiting.
async function addCards(cardIds: number[], position: Position, label: string) {
  if (busy.value || !cardIds.length) return;
  busy.value = true;
  note.value = null;
  try {
    const res = await sendCommand({ type: "load", cardIds, append: true, position });
    note.value = placedNote(label, res.loaded ?? 0, res.moved ?? 0, position);
  } catch {
    note.value = "That didn't go through.";
  } finally {
    busy.value = false;
  }
}

async function addCatalog(result: CatalogResult, position: Position) {
  if (busy.value) return;
  busy.value = true;
  note.value = null;
  try {
    const res = await $fetch<{ loaded: number; moved: number }>("/api/party/host/catalog-add", {
      method: "POST",
      body: { annSongIds: [result.annSongId], position },
    });
    note.value = placedNote(result.songTitle, res.loaded, res.moved, position);
  } catch {
    note.value = "That didn't go through.";
  } finally {
    busy.value = false;
  }
}

async function addGroup(type: DeckScopeType, row: { id: number; label: string }, position: Position) {
  try {
    const preview = await $fetch<{ cardIds: number[] }>("/api/party/host/queue-preview", {
      method: "POST",
      body: { scope: { type, id: row.id }, shuffle: false },
    });
    await addCards(preview.cardIds, position, row.label);
  } catch {
    note.value = "Couldn't load that list.";
  }
}
</script>

<template>
  <div class="queue-search">
    <input
      v-model="query"
      type="search"
      class="search-input"
      placeholder="Search by anime, artist, or song..."
      aria-label="Search anime, artists, or songs to add to the queue"
      autocomplete="off"
      @input="onInput"
      @keydown.stop
    />
    <p v-if="note" class="search-note" role="status">{{ note }}</p>
    <p v-else-if="searching && !hasResults" class="search-note">Searching...</p>
    <p v-else-if="query.trim().length >= 2 && !searching && !hasResults" class="search-note">Nothing matches that.</p>

    <div v-if="hasResults" class="search-results">
      <section v-if="shows.length" class="search-group">
        <h3 class="group-heading">Shows</h3>
        <ul class="group-list">
          <li v-for="show in shows" :key="show.aniListId" class="search-item">
            <div class="search-row">
              <button type="button" class="search-text search-open" :aria-expanded="openShow === show.aniListId" @click="toggleShow(show)">
                <span class="search-anime">{{ openShow === show.aniListId ? "▾" : "▸" }} {{ show.titleEnglish }}</span>
                <span class="search-song">{{ show.titleRomaji }} &middot; click for its songs</span>
              </button>
            </div>
            <ul v-if="openShow === show.aniListId" class="group-list nested">
              <li v-if="showLoading" class="search-row"><span class="search-song">Looking up songs...</span></li>
              <li v-else-if="!showThemes.length" class="search-row"><span class="search-song">No songs found for this show.</span></li>
              <li v-if="showThemes.length > 1" class="search-row">
                <span class="search-text"><span class="search-song">All {{ showThemes.length }} songs</span></span>
                <span class="search-actions">
                  <button type="button" class="search-btn" :disabled="busy" @click="addShowThemes(showThemes, 'next', show.titleEnglish)">Cue next</button>
                  <button type="button" class="search-btn" :disabled="busy" @click="addShowThemes(showThemes, 'end', show.titleEnglish)">Add all</button>
                </span>
              </li>
              <li v-for="theme in showThemes" :key="theme.songId" class="search-row">
                <span class="search-text">
                  <span class="search-anime">{{ theme.songTitle }}</span>
                  <span class="search-song">{{ theme.artistName }} &middot; {{ formatThemeSlotLabel(theme.themeSlot) }}{{ theme.playable ? "" : " (no allowed clip)" }}</span>
                </span>
                <span class="search-actions">
                  <button type="button" class="search-btn" :disabled="busy || !theme.playable" @click="addShowThemes([theme], 'next', theme.songTitle)">Cue next</button>
                  <button type="button" class="search-btn" :disabled="busy || !theme.playable" @click="addShowThemes([theme], 'end', theme.songTitle)">Add</button>
                </span>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section v-for="group in groups" :key="group.type" class="search-group">
        <h3 class="group-heading">{{ group.heading }}</h3>
        <ul class="group-list">
          <li v-for="row in group.rows" :key="row.id" class="search-item">
            <div class="search-row">
              <button type="button" class="search-text search-open" :aria-expanded="openKey === `${group.type}:${row.id}`" @click="toggleGroup(group.type, row)">
                <span class="search-anime">{{ openKey === `${group.type}:${row.id}` ? "▾" : "▸" }} {{ row.label }}</span>
                <span class="search-song">{{ row.cardCount }} song{{ row.cardCount === 1 ? "" : "s" }} &middot; click to pick songs</span>
              </button>
              <span class="search-actions">
                <button type="button" class="search-btn" :disabled="busy" @click="addGroup(group.type, row, 'next')">Cue next</button>
                <button type="button" class="search-btn" :disabled="busy" @click="addGroup(group.type, row, 'end')">Add all</button>
              </span>
            </div>
            <ul v-if="openKey === `${group.type}:${row.id}`" class="group-list nested">
              <li v-if="openLoading" class="search-row"><span class="search-song">Loading songs...</span></li>
              <li v-for="result in openSongs" :key="result.cardId" class="search-row">
                <span class="search-text">
                  <span class="search-anime">{{ result.songTitle }}</span>
                  <span class="search-song">{{ result.artistName }} &middot; {{ formatThemeSlotLabel(result.themeSlot) }}</span>
                </span>
                <span v-if="currentId === result.cardId" class="search-queued">Playing now</span>
                <span v-else class="search-actions">
                  <span v-if="upcomingIds.has(result.cardId)" class="search-queued">In queue</span>
                  <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'next', result.songTitle)">Cue next</button>
                  <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'end', result.songTitle)">Add</button>
                </span>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section v-if="songs.length" class="search-group">
        <h3 class="group-heading">Songs</h3>
        <ul class="group-list">
          <li v-for="result in songs" :key="result.cardId" class="search-row">
            <span class="search-text">
              <span class="search-anime">{{ result.songTitle }}</span>
              <span class="search-song">
                {{ result.animeTitle }} &middot; {{ result.artistName }} &middot; {{ formatThemeSlotLabel(result.themeSlot) }}
              </span>
            </span>
            <span v-if="currentId === result.cardId" class="search-queued">Playing now</span>
            <span v-else class="search-actions">
              <span v-if="upcomingIds.has(result.cardId)" class="search-queued">In queue</span>
              <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'next', result.songTitle)">Cue next</button>
              <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'end', result.songTitle)">Add</button>
            </span>
          </li>
        </ul>
      </section>

      <section v-if="catalogSongs.length" class="search-group">
        <h3 class="group-heading">Not in your library</h3>
        <ul class="group-list">
          <li v-for="result in catalogSongs" :key="result.annSongId" class="search-row">
            <span class="search-text">
              <span class="search-anime">{{ result.songTitle }}</span>
              <span class="search-song">
                {{ result.animeTitle }} &middot; {{ result.artistName }} &middot; {{ formatThemeSlotLabel(result.themeSlot) }}
              </span>
            </span>
            <span v-if="currentId === -result.annSongId" class="search-queued">Playing now</span>
            <span v-else class="search-actions">
              <span v-if="upcomingIds.has(-result.annSongId)" class="search-queued">In queue</span>
              <button type="button" class="search-btn" :disabled="busy" @click="addCatalog(result, 'next')">Cue next</button>
              <button type="button" class="search-btn" :disabled="busy" @click="addCatalog(result, 'end')">Add</button>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.queue-search {
  display: grid;
  gap: 8px;
}

.search-input {
  width: 100%;
  padding: 9px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
}

.search-note {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.search-results {
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.group-heading {
  margin: 0;
  padding: 8px 12px 4px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.group-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-open {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.nested {
  padding-left: 18px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.search-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.search-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.search-anime {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-song {
  color: var(--muted);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-btn {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.search-btn:hover {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.search-queued {
  color: var(--faint);
  font-size: 13px;
}
</style>
