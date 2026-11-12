<script setup lang="ts">
import type { LiteHostSong } from "~/composables/usePartyLite";
import type { StudyFilters } from "~/utils/studyFilters";

const props = defineProps<{ displayUrl: string }>();
const emit = defineEmits<{ logout: []; "session-lost": [] }>();

const { state, connected, sessionLost, commandError, send } = usePartyLiteHost();
watch(sessionLost, (lost) => {
  if (lost) emit("session-lost");
});

const filtersOpen = ref(false);
const addOpen = ref(false);
const copied = ref(false);

const liteDisplayUrl = computed(() => props.displayUrl.replace(/\/party\/display$/, "/party/lite/display"));
const filters = computed<StudyFilters>(() => state.value?.source.filters ?? EMPTY_STUDY_FILTERS);
const chips = computed(() => describeFilters(filters.value));
const current = computed(() => state.value?.current ?? null);
const position = computed(() => {
  const report = state.value?.position;
  return report && report.token === current.value?.token ? report : null;
});
const progress = computed(() => {
  const report = position.value;
  return report?.duration ? Math.min(100, (report.time / report.duration) * 100) : 0;
});
const sourceTitle = computed(() => {
  const source = state.value?.source;
  if (!source) return "";
  const count = `${state.value!.matchCount} ${state.value!.matchCount === 1 ? "song matches" : "songs match"}`;
  return source.endless ? `Endless · ${count}` : `Hand picks only · ${count}`;
});
const scopeLabel = computed(() => {
  const source = state.value?.source;
  if (!source || source.scope.type === "all") return "All my cards";
  return source.label ?? "One deck";
});

async function copyDisplayUrl() {
  try {
    await navigator.clipboard.writeText(liteDisplayUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // No clipboard on plain http from another device; the address stays visible to type.
  }
}

function applyFilters(next: StudyFilters) {
  filtersOpen.value = false;
  const source = state.value?.source;
  if (!source) return;
  void send({ type: "source", scope: source.scope, label: source.label, filters: filtersQueryValue(next) });
}

function useAllCards() {
  void send({ type: "source", scope: { type: "all" }, label: null, filters: filtersQueryValue(filters.value) });
}

function useDeck(deck: { id: number; name: string }) {
  addOpen.value = false;
  void send({ type: "source", scope: { type: "created", id: deck.id }, label: deck.name, filters: filtersQueryValue(filters.value) });
}

function seek(event: MouseEvent) {
  const duration = position.value?.duration;
  if (!duration) return;
  const bar = event.currentTarget as HTMLElement;
  const box = bar.getBoundingClientRect();
  void send({ type: "seek", seconds: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * duration });
}

function downloadLabel(song: LiteHostSong): string {
  if (song.download === "local") return "✓ Downloaded";
  if (song.download === "downloading") return `↓ ${song.progress ?? 0}%`;
  if (song.download === "waiting") return "↓ Waiting";
  return "Streaming";
}

// The muted preview follows the display's own reports, so it shows roughly
// what the room sees without being a second source of truth.
const preview = ref<HTMLVideoElement | null>(null);
const PREVIEW_DRIFT_SECONDS = 1.5;
watch([position, () => state.value?.playing, preview], () => {
  const video = preview.value;
  if (!video) return;
  const report = position.value;
  if (report && Math.abs(video.currentTime - report.time) > PREVIEW_DRIFT_SECONDS) video.currentTime = report.time;
  if (state.value?.playing && report) void video.play().catch(() => {});
  else video.pause();
});

function onKeydown(event: KeyboardEvent) {
  if (filtersOpen.value || addOpen.value || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, button, [contenteditable]")) return;
  if (event.key === " ") {
    event.preventDefault();
    void send({ type: state.value?.playing ? "pause" : "play" });
  } else if (event.key === "ArrowRight" || event.key === "n") void send({ type: "next" });
  else if (event.key === "r") void send({ type: "reveal" });
  else if (event.key === "/") {
    event.preventDefault();
    addOpen.value = true;
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="lite-host">
    <header class="top">
      <h1 class="brand">Party · Host</h1>
      <span v-if="!connected" class="offline" role="status">Reconnecting...</span>
      <span class="spacer" />
      <span class="display-url">Display: <b>{{ liteDisplayUrl }}</b></span>
      <button type="button" class="btn small" @click="copyDisplayUrl">{{ copied ? "Copied" : "Copy link" }}</button>
      <button type="button" class="btn small" @click="emit('logout')">Log out</button>
    </header>

    <p v-if="!state" class="loading">Loading...</p>
    <div v-else class="columns">
      <section class="now" aria-label="Now playing">
        <p class="label">Now playing<template v-if="current"> · song {{ state.played }}</template></p>
        <div class="frame">
          <video
            v-if="current?.kind === 'video'"
            :key="current.token"
            ref="preview"
            class="frame-media"
            :src="`/api/party/host/lite/clip?t=${current.token}`"
            muted
            playsinline
            preload="metadata"
          />
          <img
            v-else-if="current?.answer.hasCover"
            class="frame-media frame-cover"
            :src="`/api/party/host/lite/cover?t=${current.token}`"
            alt=""
          />
          <p v-else class="frame-empty">{{ current ? "Audio only" : "Nothing playing" }}</p>
        </div>

        <template v-if="current">
          <h2 class="now-title">{{ current.answer.animeTitle }}</h2>
          <p class="now-sub">{{ current.answer.songTitle }} · {{ current.answer.artistName }} · {{ formatThemeSlotLabel(current.answer.themeSlot) }}</p>
        </template>
        <template v-else>
          <h2 class="now-title">Ready when you are</h2>
          <p class="now-sub">{{ state.upNext.length ? "Press play to start the first song." : "Add songs, or turn Endless on, to fill Up next." }}</p>
        </template>

        <div class="scrub">
          <span class="time">{{ formatClock(position?.time) }}</span>
          <button type="button" class="bar" aria-label="Seek" :disabled="!position?.duration" @click="seek">
            <span class="bar-fill" :style="{ width: `${progress}%` }" />
          </button>
          <span class="time">{{ formatClock(position?.duration) }}</span>
        </div>

        <div class="transport">
          <button type="button" class="btn round" aria-label="Previous song" :disabled="!current" @click="send({ type: 'previous' })">⏮</button>
          <button
            type="button"
            class="btn primary round big"
            :aria-label="state.playing ? 'Pause' : 'Play'"
            :disabled="!current && !state.upNext.length"
            @click="send({ type: state.playing ? 'pause' : 'play' })"
          >
            {{ state.playing ? "❚❚" : "▶" }}
          </button>
          <button type="button" class="btn round" aria-label="Next song" :disabled="!current && !state.upNext.length" @click="send({ type: 'next' })">⏭</button>
        </div>

        <button type="button" class="btn primary wide" :disabled="!current || state.revealed" @click="send({ type: 'reveal' })">
          {{ state.revealed ? "Answer revealed" : "Reveal answer" }}
        </button>
        <p class="note center">
          {{ !current ? "Display shows: waiting screen" : state.revealed ? "Display shows: video and the answer" : "Display shows: video only, answer hidden" }}
        </p>
        <p v-if="commandError" class="error" role="alert">{{ commandError }}</p>
      </section>

      <section class="side">
        <div class="playlist">
          <div class="playlist-head">
            <div class="grow">
              <p class="label">Playlist</p>
              <h2 class="playlist-title">{{ sourceTitle }}</h2>
            </div>
            <label class="switch">
              <span>Endless</span>
              <input type="checkbox" :checked="state.source.endless" @change="send({ type: 'endless', enabled: !state.source.endless })" />
            </label>
            <button type="button" class="btn primary" @click="filtersOpen = true">Edit filters</button>
          </div>
          <div class="chips">
            <span v-for="chip in chips" :key="`${chip.exclude ? '-' : '+'}${chip.label}`" class="chip" :class="chip.exclude ? 'chip-exclude' : 'chip-on'">
              {{ chip.label }}
            </span>
            <span class="chip">{{ scopeLabel }}</span>
            <button v-if="state.source.scope.type !== 'all'" type="button" class="text-btn" @click="useAllCards">Use all my cards</button>
            <span v-if="!chips.length" class="note">No filters: every song can come up.</span>
          </div>
        </div>

        <div class="next-head">
          <p class="label grow">Up next<template v-if="state.source.endless"> · picked from your filters</template></p>
          <button type="button" class="btn small" :disabled="!state.upNext.some((song) => !song.manual)" @click="send({ type: 'rerollAll' })">↻ Reroll all</button>
          <button type="button" class="btn small" @click="addOpen = true">+ Add songs</button>
        </div>

        <ol class="queue">
          <li v-if="current" class="row row-playing">
            <span class="num">{{ state.played }}</span>
            <img v-if="current.answer.hasCover" class="thumb" :src="`/api/party/host/lite/cover?t=${current.token}`" alt="" loading="lazy" />
            <div class="grow">
              <p class="row-title">{{ current.answer.animeTitle }}</p>
              <p class="row-sub">{{ current.answer.songTitle }} · {{ current.answer.artistName }} · {{ formatThemeSlotLabel(current.answer.themeSlot) }}</p>
            </div>
            <span class="badge badge-live">Playing</span>
          </li>
          <li v-for="(song, at) in state.upNext" :key="song.token" class="row">
            <span class="num">{{ state.played + at + 1 }}</span>
            <img v-if="song.answer.hasCover" class="thumb" :src="`/api/party/host/lite/cover?t=${song.token}`" alt="" loading="lazy" />
            <div class="grow">
              <p class="row-title">{{ song.answer.animeTitle }}</p>
              <p class="row-sub">{{ song.answer.songTitle }} · {{ song.answer.artistName }} · {{ formatThemeSlotLabel(song.answer.themeSlot) }}</p>
            </div>
            <span v-if="song.manual" class="badge">Hand pick</span>
            <span class="dl" :class="`dl-${song.download}`">{{ downloadLabel(song) }}</span>
            <button v-if="!song.manual" type="button" class="btn small" @click="send({ type: 'reroll', token: song.token })">↻ Reroll</button>
            <button type="button" class="icon" :aria-label="`Remove ${song.answer.songTitle}`" @click="send({ type: 'remove', token: song.token })">✕</button>
          </li>
        </ol>
        <p v-if="!current && !state.upNext.length" class="note">
          {{ state.matchCount ? "Nothing is waiting. Turn Endless on or add songs." : "No song matches these filters. Loosen them, or add songs by hand." }}
        </p>
        <p v-else-if="state.source.endless" class="note">A new song is picked each time one starts. Songs you add by hand play before the filter picks.</p>
      </section>
    </div>

    <StudyFiltersModal
      :open="filtersOpen"
      :filters="filters"
      api-base="/api/party/host"
      title="Playlist filters"
      hint="Songs are picked at random from every card that matches."
      @close="filtersOpen = false"
      @apply="applyFilters"
    />
    <PartyLiteAddModal
      :open="addOpen"
      :queued-card-ids="[...(current ? [current.cardId] : []), ...state?.upNext.map((song) => song.cardId) ?? []]"
      @close="addOpen = false"
      @add="(cardId, position) => send({ type: 'add', cardId, position })"
      @use-deck="useDeck"
    />
  </main>
</template>

<style scoped>
.lite-host {
  min-height: 100vh;
  background: var(--page-bg);
}

.top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
}

.brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
}

.spacer,
.grow {
  flex: 1;
  min-width: 0;
}

.display-url,
.note,
.time,
.row-sub {
  color: var(--faint);
  font-size: 13px;
}

.display-url b {
  color: var(--text);
  font-weight: 600;
  user-select: all;
}

.offline,
.error {
  color: var(--warning);
  font-size: 13px;
  font-weight: 700;
}

.error {
  color: var(--fail);
  text-align: center;
}

.loading {
  padding: 24px;
  color: var(--muted);
}

.columns {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 28px;
  padding: 10px 24px 32px;
}

.label {
  margin: 0;
  color: var(--faint);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.frame {
  aspect-ratio: 16 / 9;
  margin: 12px 0 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  border: 1px solid var(--border);
  overflow: hidden;
  display: grid;
  place-items: center;
}

.frame-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.frame-cover {
  object-fit: cover;
}

.frame-empty {
  margin: 0;
  color: var(--faint);
}

.now-title,
.playlist-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.2;
}

.playlist-title {
  margin-top: 4px;
  font-size: 20px;
}

.now-sub {
  margin: 2px 0 0;
  color: var(--muted);
}

.scrub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.bar {
  flex: 1;
  height: 18px;
  padding: 6px 0;
  border: 0;
  background: none;
  cursor: pointer;
  position: relative;
}

.bar:disabled {
  cursor: default;
}

.bar::before,
.bar-fill {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
}

.bar::before {
  right: 0;
  background: var(--outline);
}

.bar-fill {
  background: var(--accent);
}

.transport {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  margin: 14px 0 18px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.btn.small {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

.btn.round {
  width: 44px;
  height: 44px;
  padding: 0;
}

.btn.big {
  width: 60px;
  height: 60px;
  font-size: 20px;
}

.btn.wide {
  width: 100%;
  height: 46px;
}

.center {
  margin: 14px 0 0;
  text-align: center;
}

.playlist {
  padding: 18px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.playlist-head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.switch {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--faint);
  font-size: 13px;
  cursor: pointer;
}

.switch input {
  width: 18px;
  height: 18px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.chip {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.chip-on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.chip-exclude {
  border-color: var(--fail);
  color: var(--fail);
  text-decoration: line-through;
}

.text-btn {
  border: 0;
  background: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}

.next-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 22px 4px 8px;
}

.queue {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
}

.row-playing {
  background: var(--surface-raised);
  outline: 1px solid var(--outline);
}

.num {
  width: 22px;
  text-align: right;
  color: var(--faint);
  font-size: 13px;
}

.thumb {
  width: 34px;
  height: 46px;
  object-fit: cover;
  border-radius: var(--radius-xs);
  background: var(--surface-sunken);
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

.badge {
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.badge-live {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
  text-transform: uppercase;
}

.dl {
  min-width: 92px;
  text-align: right;
  color: var(--faint);
  font-size: 12px;
  white-space: nowrap;
}

.dl-local {
  color: var(--pass);
}

.dl-waiting,
.dl-downloading {
  color: var(--warning);
}

.icon {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--faint);
  font-size: 14px;
  cursor: pointer;
}

.icon:hover {
  background: var(--surface-raised);
  color: var(--text);
}

.side .note {
  margin: 12px 4px 0;
}

@media (max-width: 900px) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .display-url {
    display: none;
  }

  .playlist-head {
    flex-wrap: wrap;
  }
}
</style>
