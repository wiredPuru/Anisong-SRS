<script setup lang="ts">
import { formatThemeSlotLabel } from "~/utils/themeSlotAnswer";
import type { ClipSource } from "~/utils/clipSource";
import { listenCard, listenTrackUnavailableReason, type ListenQueueEntry, type ListenTrack } from "~/utils/listenRequests";

const props = defineProps<{
  queueKey: number;
  clipSource: ClipSource;
  pendingKeys: string[];
  pendingRequests: ListenQueueEntry[];
  focusQueue?: boolean;
  currentKey?: string;
  notice: string | null;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  request: [track: ListenTrack, mode: "now" | "next", queueKey: number];
  remove: [entryId: number];
  clear: [];
}>();
const openedQueue = props.queueKey;
const { offlineMode } = useNetworkMode();
const search = useListenSongSearch(offlineMode);
const input = ref<HTMLInputElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const queueSection = ref<HTMLElement | null>(null);
const groups = computed(() => [
  { id: "library", title: "My library", tracks: search.library.value, loading: search.libraryLoading.value, error: search.libraryError.value },
  { id: "catalog", title: "Online catalog", tracks: search.catalog.value, loading: search.catalogLoading.value, error: search.catalogError.value },
].map((group) => ({ ...group, rows: group.tracks.map((track) => ({
  track, card: listenCard({ entryId: 1, origin: "request", track }), reason: listenTrackUnavailableReason(track, props.clipSource),
})) })));

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation();
  if (event.key === "Escape") { event.preventDefault(); emit("close"); return; }
  if (event.key !== "Tab" || !panel.value) return;
  const targets = [...panel.value.querySelectorAll<HTMLElement>("button:not(:disabled), input, a[href], [tabindex='0']")];
  const first = targets[0], last = targets.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function choose(track: ListenTrack, mode: "now" | "next") {
  if (props.disabled || listenTrackUnavailableReason(track, props.clipSource)) return;
  emit("request", track, mode, openedQueue);
}
function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    emit("close");
  } else if (event.key === "Tab" && !panel.value?.contains(document.activeElement)) {
    event.preventDefault();
    input.value?.focus();
  }
}
watch(() => props.pendingKeys, () => {
  if (!panel.value?.contains(document.activeElement) || document.activeElement?.matches(":disabled")) input.value?.focus();
}, { flush: "post" });
onMounted(() => {
  if (props.focusQueue) queueSection.value?.focus();
  else input.value?.focus();
  window.addEventListener("keydown", onWindowKeydown, true);
});
onUnmounted(() => window.removeEventListener("keydown", onWindowKeydown, true));
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')" @keydown="onKeydown">
      <section ref="panel" class="search-panel" role="dialog" aria-modal="true" aria-labelledby="listen-search-title">
        <header>
          <div>
            <h2 id="listen-search-title">Search songs</h2>
            <p>Your requests play first, then your deck continues.</p>
          </div>
          <button type="button" class="close-btn" aria-label="Close song search" @click="emit('close')">&times;</button>
        </header>
        <label class="search-label" for="listen-song-query">Song title</label>
        <input id="listen-song-query" ref="input" v-model="search.query.value" type="search" autocomplete="off" placeholder="Find a song to play" aria-describedby="listen-search-hint">
        <p id="listen-search-hint" class="hint">Enter at least two characters. Searching keeps the music playing.</p>
        <p class="notice" role="status" aria-live="polite">{{ notice }}</p>
        <div class="search-results">
          <div ref="queueSection" tabindex="-1">
            <ListenRequestQueue :entries="pendingRequests" @remove="emit('remove', $event)" @clear="emit('clear')" />
          </div>
          <section v-for="group in groups" :key="group.id" class="result-group" :aria-labelledby="`listen-${group.id}-title`" :aria-busy="group.loading">
            <h3 :id="`listen-${group.id}-title`">{{ group.title }}</h3>
            <p v-if="group.id === 'catalog' && search.onlineOnly.value" class="hint">
              Online catalog search needs online mode. <NuxtLink to="/settings?section=library">Open Settings</NuxtLink>
            </p>
            <p v-else-if="group.id === 'catalog' && offlineMode === null" class="hint">Checking network mode.</p>
            <template v-else-if="search.hasQuery.value">
              <p v-if="group.loading && !group.rows.length" class="hint" role="status">Searching {{ group.title.toLowerCase() }}...</p>
              <p v-else-if="!group.error && !group.rows.length" class="hint">No matching songs.</p>
              <ul v-if="group.rows.length" class="song-results">
                <li v-for="row in group.rows" :key="row.track.key" class="song-row">
                  <div class="song-copy">
                    <strong>{{ row.card.songTitle }}</strong>
                    <span>{{ row.card.artistName }}</span>
                    <span>{{ row.card.animeTitleRomaji }} &middot; {{ formatThemeSlotLabel(row.card.themeSlot) }}</span>
                    <span v-if="row.reason" class="unavailable">{{ row.reason }}</span>
                    <span v-else-if="currentKey === row.track.key" class="playing">Playing</span>
                  </div>
                  <div class="song-actions">
                    <button type="button" :disabled="disabled || Boolean(row.reason)" @click="choose(row.track, 'now')">Play now</button>
                    <button type="button" class="primary" :disabled="disabled || Boolean(row.reason) || pendingKeys.includes(row.track.key)" @click="choose(row.track, 'next')">
                      {{ pendingKeys.includes(row.track.key) ? 'Queued' : 'Play next' }}
                    </button>
                  </div>
                </li>
              </ul>
              <p v-if="group.error" class="error" role="alert">
                {{ group.error }}
                <button type="button" @click="group.id === 'library' ? search.retryLibrary() : search.retryCatalog()">Retry</button>
              </p>
              <button v-if="group.id === 'library' && search.hasMore.value && !group.error" type="button" class="load-more" :disabled="group.loading" @click="search.loadMore()">
                {{ group.loading ? 'Loading songs...' : 'Load more library songs' }}
              </button>
            </template>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: var(--z-above-immersive); background: var(--scrim); display: grid; place-items: center; padding: 1rem; }
.search-panel { width: min(50rem, 100%); max-height: 90dvh; display: flex; flex-direction: column; padding: 1.5rem; gap: 0.5rem; border: 1px solid var(--outline); border-radius: var(--radius); background: var(--bg); color: var(--text); box-shadow: var(--shadow-soft); }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
h2, h3, p { margin: 0; }
h2 { font-family: var(--font-display); font-size: 1.4rem; }
header p, .hint { color: var(--muted); font-size: 0.85rem; }
.search-label { font-size: 0.85rem; font-weight: 700; margin-top: 0.5rem; }
input { width: 100%; min-width: 0; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); font: inherit; }
.notice { color: var(--accent); min-height: 1.4em; font-size: 0.85rem; }
.search-results { overflow: auto; min-height: 0; overscroll-behavior: contain; }
.result-group + .result-group { margin-top: 1.25rem; }
h3 { font-size: 0.95rem; padding-bottom: 0.5rem; }
.song-results { list-style: none; margin: 0; padding: 0; }
.song-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.8rem 0; border-top: 1px solid var(--border); }
.song-copy { min-width: 0; display: grid; gap: 0.15rem; overflow-wrap: anywhere; }
.song-copy span { color: var(--muted); font-size: 0.8rem; }
.song-actions { display: flex; flex: none; gap: 0.4rem; }
button { padding: 0.5rem 0.8rem; border: 1px solid var(--border); border-radius: var(--radius-pill); background: var(--surface-raised); color: var(--text); font: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
button.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
button:disabled { opacity: 0.5; cursor: default; }
.close-btn { font-size: 1.2rem; line-height: 1; }
.load-more { margin-top: 0.5rem; }
.error, .song-copy .unavailable { color: var(--fail); }
.song-copy .playing { color: var(--pass); }
a { color: var(--accent); }
@media (max-width: 540px) {
  .search-panel { padding: 1rem; }
  .song-row { align-items: flex-start; flex-direction: column; gap: 0.5rem; }
  .song-actions { align-self: flex-end; }
}
</style>
