<script setup lang="ts">
import type { PartyHostState } from "~/composables/usePartyHost";
import { isOfflineModeError } from "~/utils/networkMode";
import { animeCardsSearchPath, artistDeckPath } from "~/utils/deckLinks";
import { deckRowLabel, type DeckRowNames, type DeckScopeType } from "~/utils/scopePick";

interface SongResult {
  cardId: number;
  animeTitle: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
  downloaded: boolean;
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
  rows: { id: number; label: string; cardCount: number; linkPath: string | null }[];
}

const GROUPS: { type: DeckScopeType; heading: string }[] = [
  { type: "anime", heading: "Anime" },
  { type: "artist", heading: "Artists" },
  { type: "created", heading: "Your decks" },
];
const GROUP_LIMIT = 5;

// Where a group row opens in the main app. A created deck is a party list
// here, not a title or an artist, so it gets no link.
function groupLinkPath(type: DeckScopeType, deck: GroupResult): string | null {
  if (type === "artist") return artistDeckPath(deck.id);
  if (type === "anime") return animeCardsSearchPath(deck.titleRomaji || deckRowLabel(type, deck));
  return null;
}

interface ShowResult {
  aniListId: number;
  titleEnglish: string;
  titleRomaji: string;
  inLibrary: boolean;
}
interface ShowTheme {
  songId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string;
  videoUrl: string | null;
  audioUrl: string | null;
  playable: boolean;
  cardId: number | null;
  downloaded: boolean;
}

type Position = "next" | "end";

const props = defineProps<{ state: PartyHostState }>();

const query = ref("");
const groups = ref<Group[]>([]);
const shows = ref<ShowResult[]>([]);
const songs = ref<SongResult[]>([]);
const catalogSongs = ref<CatalogResult[]>([]);
const searching = ref(false);
const { offlineMode } = useNetworkMode();
const onlineOnlyHidden = ref(false);
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
    onlineOnlyHidden.value = false;
    searching.value = false;
    return;
  }
  searching.value = true;
  // Library groups still search; the catalog and AniList shows need online mode.
  onlineOnlyHidden.value = offlineMode.value === true;
  const onlineOnly = <T extends { results: unknown[] }>(path: string): Promise<T> =>
    onlineOnlyHidden.value
      ? Promise.resolve({ results: [] } as unknown as T)
      : $fetch<T>(path, { query: { q: text } }).catch((err: unknown) => {
        if (isOfflineModeError(err)) onlineOnlyHidden.value = true;
        return { results: [] } as unknown as T;
      });
  try {
    const [found, songRes, catalogRes, showRes] = await Promise.all([
      Promise.all(
        GROUPS.map(async ({ type, heading }): Promise<Group> => {
          const res = await $fetch<{ decks: GroupResult[] }>("/api/party/host/decks", { query: { type, q: text } }).catch(() => ({ decks: [] }));
          const rows = res.decks
            .filter((deck) => deck.cardCount > 0)
            .slice(0, GROUP_LIMIT)
            .map((deck) => ({ id: deck.id, label: deckRowLabel(type, deck), cardCount: deck.cardCount, linkPath: groupLinkPath(type, deck) }));
          return { type, heading, rows };
        }),
      ),
      $fetch<{ results: SongResult[] }>("/api/party/host/card-search", { query: { q: text } }).catch(() => ({ results: [] })),
      onlineOnly<{ results: CatalogResult[] }>("/api/party/host/catalog-search"),
      onlineOnly<{ results: ShowResult[] }>("/api/party/host/anime-search"),
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

// Per card: "running" while saving, else the last error. A finished download
// flips the row's own flag, wherever that song is listed.
const downloads = ref<Record<number, string>>({});
async function downloadCard(cardId: number) {
  if (downloads.value[cardId] === "running") return;
  downloads.value = { ...downloads.value, [cardId]: "running" };
  try {
    await $fetch("/api/party/host/download", { method: "POST", body: { cardId } });
    for (const list of [songs.value, openSongs.value, showThemes.value]) {
      for (const row of list) if (row.cardId === cardId) row.downloaded = true;
    }
    const { [cardId]: _done, ...rest } = downloads.value;
    downloads.value = rest;
  } catch (error) {
    const message = (error as { data?: { statusMessage?: string } }).data?.statusMessage;
    downloads.value = { ...downloads.value, [cardId]: message ?? "Couldn't download that." };
  }
}

function onInput() {
  openKey.value = null;
  openShow.value = null;
  note.value = null;
  activeKey.value = null;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(search, 250);
}

// Songs still to come can be moved; the one on screen stays where it is.
const upcomingIds = computed(() => new Set(props.state.queue.slice(props.state.index + 1).map((item) => item.cardId)));
const currentId = computed(() => props.state.queue[props.state.index]?.cardId ?? null);
const hasResults = computed(() => shows.value.length > 0 || groups.value.length > 0 || songs.value.length > 0 || catalogSongs.value.length > 0);

// Every row the arrow keys can land on, in screen order. A song row cues next
// on Enter; a show or deck row only opens, so Enter never queues a whole list.
interface NavRow {
  key: string;
  run: () => void;
}
const navRows = computed<NavRow[]>(() => {
  const rows: NavRow[] = [];
  for (const show of shows.value) {
    rows.push({ key: `show:${show.aniListId}`, run: () => toggleShow(show) });
    if (openShow.value !== show.aniListId) continue;
    for (const theme of showThemes.value) {
      if (theme.playable) rows.push({ key: `theme:${theme.songId}`, run: () => addShowThemes([theme], "next", theme.songTitle) });
    }
  }
  for (const group of groups.value) {
    for (const row of group.rows) {
      rows.push({ key: `group:${group.type}:${row.id}`, run: () => toggleGroup(group.type, row) });
      if (openKey.value !== `${group.type}:${row.id}`) continue;
      for (const result of openSongs.value) {
        if (currentId.value !== result.cardId) rows.push({ key: `deck:${result.cardId}`, run: () => addCards([result.cardId], "next", result.songTitle) });
      }
    }
  }
  for (const result of songs.value) {
    if (currentId.value !== result.cardId) rows.push({ key: `song:${result.cardId}`, run: () => addCards([result.cardId], "next", result.songTitle) });
  }
  for (const result of catalogSongs.value) {
    if (currentId.value !== -result.annSongId) rows.push({ key: `cat:${result.annSongId}`, run: () => addCatalog(result, "next") });
  }
  return rows;
});

const activeKey = ref<string | null>(null);
const rowDomId = (key: string) => `queue-search-${key.replace(/[^a-z0-9-]/gi, "-")}`;
const activeDomId = computed(() => (activeKey.value && navRows.value.some((row) => row.key === activeKey.value) ? rowDomId(activeKey.value) : undefined));

function onKeydown(event: KeyboardEvent) {
  const rows = navRows.value;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (!rows.length) return;
    event.preventDefault();
    const at = rows.findIndex((row) => row.key === activeKey.value);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = at < 0 ? (step > 0 ? 0 : rows.length - 1) : (at + step + rows.length) % rows.length;
    activeKey.value = rows[next]!.key;
    nextTick(() => document.getElementById(rowDomId(activeKey.value!))?.scrollIntoView({ block: "nearest" }));
  } else if (event.key === "Enter") {
    const row = rows.find((candidate) => candidate.key === activeKey.value);
    if (!row) return;
    event.preventDefault();
    row.run();
  } else if (event.key === "Escape" && activeKey.value) {
    event.preventDefault();
    activeKey.value = null;
  }
}

function sendCommand(body: object) {
  return $fetch<{ loaded?: number; moved?: number }>("/api/party/host/command", { method: "POST", body });
}

function placedNote(label: string, loaded: number, moved: number, position: Position): string {
  const total = loaded + moved;
  if (!total) return "Nothing to add: that's the song playing now, or it has no playable clip.";
  const what = total === 1 ? `"${label}"` : `${total} songs from "${label}"`;
  if (position === "next") return `${what} cued next.`;
  if (!loaded) return `${what} moved to the end.`;
  if (!moved) return `${what} added to the end.`;
  return `${what} at the end (${moved} moved, ${loaded} added).`;
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
      :aria-activedescendant="activeDomId"
      @input="onInput"
      @keydown.stop="onKeydown"
    />
    <p v-if="note" class="search-note" role="status">{{ note }}</p>
    <p v-else-if="searching && !hasResults" class="search-note">Searching...</p>
    <p v-else-if="query.trim().length >= 2 && !searching && !hasResults" class="search-note">Nothing matches that.</p>

    <OfflineNotice v-if="onlineOnlyHidden && query.trim().length >= 2" message="Songs outside your library and AniList shows need online mode." :settings-href="null">
      <template #action>
        <PartyMainAppLink path="/settings?section=library" label="Settings">Open Settings</PartyMainAppLink>
      </template>
    </OfflineNotice>

    <div v-if="hasResults" class="search-results">
      <section v-if="shows.length" class="search-group">
        <h3 class="group-heading">Shows</h3>
        <ul class="group-list">
          <li v-for="show in shows" :key="show.aniListId" class="search-item">
            <div class="search-row" :id="rowDomId(`show:${show.aniListId}`)" :class="{ active: activeKey === `show:${show.aniListId}` }">
              <button type="button" class="search-text search-open" :aria-expanded="openShow === show.aniListId" @click="toggleShow(show)">
                <span class="search-anime">{{ openShow === show.aniListId ? "▾" : "▸" }} {{ show.titleEnglish }}</span>
                <span class="search-song">{{ show.titleRomaji }} &middot; click for its songs</span>
                <span v-if="show.inLibrary" class="search-chip">✓ In library</span>
              </button>
              <PartyMainAppLink :path="animeCardsSearchPath(show.titleRomaji)" :label="show.titleEnglish" />
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
              <li v-for="theme in showThemes" :key="theme.songId" class="search-row" :id="rowDomId(`theme:${theme.songId}`)" :class="{ active: activeKey === `theme:${theme.songId}` }">
                <span class="search-text">
                  <span class="search-anime">{{ theme.songTitle }}</span>
                  <span class="search-song"><PartyMainAppLink :path="artistLinkPath(null, theme.artistName)" :label="theme.artistName">{{ theme.artistName }}</PartyMainAppLink> &middot; {{ formatThemeSlotLabel(theme.themeSlot) }}{{ theme.playable ? "" : " (no allowed clip)" }}</span>
                </span>
                <span class="search-actions">
                  <button type="button" class="search-btn" :disabled="busy || !theme.playable" @click="addShowThemes([theme], 'next', theme.songTitle)">Cue next</button>
                  <button type="button" class="search-btn" :disabled="busy || !theme.playable" @click="addShowThemes([theme], 'end', theme.songTitle)">Add</button>
                </span>
                <PartyLibraryChips
                  v-if="theme.cardId !== null"
                  class="row-chips"
                  :downloaded="theme.downloaded"
                  :status="downloads[theme.cardId]"
                  @download="downloadCard(theme.cardId)"
                />
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section v-for="group in groups" :key="group.type" class="search-group">
        <h3 class="group-heading">{{ group.heading }}</h3>
        <ul class="group-list">
          <li v-for="row in group.rows" :key="row.id" class="search-item">
            <div class="search-row" :id="rowDomId(`group:${group.type}:${row.id}`)" :class="{ active: activeKey === `group:${group.type}:${row.id}` }">
              <button type="button" class="search-text search-open" :aria-expanded="openKey === `${group.type}:${row.id}`" @click="toggleGroup(group.type, row)">
                <span class="search-anime">{{ openKey === `${group.type}:${row.id}` ? "▾" : "▸" }} {{ row.label }}</span>
                <span class="search-song">{{ row.cardCount }} song{{ row.cardCount === 1 ? "" : "s" }} &middot; click to pick songs</span>
              </button>
              <PartyMainAppLink v-if="row.linkPath" :path="row.linkPath" :label="row.label" />
              <span class="search-actions">
                <button type="button" class="search-btn" :disabled="busy" @click="addGroup(group.type, row, 'next')">Cue next</button>
                <button type="button" class="search-btn" :disabled="busy" @click="addGroup(group.type, row, 'end')">Add all</button>
              </span>
            </div>
            <ul v-if="openKey === `${group.type}:${row.id}`" class="group-list nested">
              <li v-if="openLoading" class="search-row"><span class="search-song">Loading songs...</span></li>
              <li v-for="result in openSongs" :key="result.cardId" class="search-row" :id="rowDomId(`deck:${result.cardId}`)" :class="{ active: activeKey === `deck:${result.cardId}` }">
                <span class="search-text">
                  <span class="search-anime">{{ result.songTitle }}</span>
                  <span class="search-song"><PartyMainAppLink :path="artistLinkPath(null, result.artistName)" :label="result.artistName">{{ result.artistName }}</PartyMainAppLink> &middot; {{ formatThemeSlotLabel(result.themeSlot) }}</span>
                </span>
                <span v-if="currentId === result.cardId" class="search-queued">Playing now</span>
                <span v-else class="search-actions">
                  <span v-if="upcomingIds.has(result.cardId)" class="search-queued">In queue</span>
                  <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'next', result.songTitle)">Cue next</button>
                  <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'end', result.songTitle)">Add</button>
                </span>
                <PartyLibraryChips class="row-chips" :downloaded="result.downloaded" :status="downloads[result.cardId]" @download="downloadCard(result.cardId)" />
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section v-if="songs.length" class="search-group">
        <h3 class="group-heading">Songs</h3>
        <ul class="group-list">
          <li v-for="result in songs" :key="result.cardId" class="search-row" :id="rowDomId(`song:${result.cardId}`)" :class="{ active: activeKey === `song:${result.cardId}` }">
            <span class="search-text">
              <span class="search-anime">{{ result.songTitle }}</span>
              <span class="search-song">
                <PartyMainAppLink :path="animeCardsSearchPath(result.animeTitle)" :label="result.animeTitle">{{ result.animeTitle }}</PartyMainAppLink>
                &middot;
                <PartyMainAppLink :path="artistLinkPath(null, result.artistName)" :label="result.artistName">{{ result.artistName }}</PartyMainAppLink>
                &middot; {{ formatThemeSlotLabel(result.themeSlot) }}
              </span>
            </span>
            <span v-if="currentId === result.cardId" class="search-queued">Playing now</span>
            <span v-else class="search-actions">
              <span v-if="upcomingIds.has(result.cardId)" class="search-queued">In queue</span>
              <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'next', result.songTitle)">Cue next</button>
              <button type="button" class="search-btn" :disabled="busy" @click="addCards([result.cardId], 'end', result.songTitle)">Add</button>
            </span>
            <PartyLibraryChips class="row-chips" :downloaded="result.downloaded" :status="downloads[result.cardId]" @download="downloadCard(result.cardId)" />
          </li>
        </ul>
      </section>

      <section v-if="catalogSongs.length" class="search-group">
        <h3 class="group-heading">Not in your library</h3>
        <ul class="group-list">
          <li v-for="result in catalogSongs" :key="result.annSongId" class="search-row" :id="rowDomId(`cat:${result.annSongId}`)" :class="{ active: activeKey === `cat:${result.annSongId}` }">
            <span class="search-text">
              <span class="search-anime">{{ result.songTitle }}</span>
              <span class="search-song">
                <PartyMainAppLink :path="animeCardsSearchPath(result.animeTitle)" :label="result.animeTitle">{{ result.animeTitle }}</PartyMainAppLink>
                &middot;
                <PartyMainAppLink :path="artistLinkPath(null, result.artistName)" :label="result.artistName">{{ result.artistName }}</PartyMainAppLink>
                &middot; {{ formatThemeSlotLabel(result.themeSlot) }}
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
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.search-row.active {
  background: var(--surface-raised);
  box-shadow: inset 3px 0 0 var(--accent);
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

.row-chips {
  flex-basis: 100%;
  margin-top: 0;
}

.search-chip {
  align-self: flex-start;
  margin-top: 3px;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}
</style>
