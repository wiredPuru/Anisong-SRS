<script setup lang="ts">
import type { StudyFilters } from "~/utils/studyFilters";
import type { StudyScope } from "~/composables/useStudySession";
import { buildSourceLinks } from "~/utils/sourceLinks";
import { scopeToQuery, type ScopePick } from "~/utils/scopePick";

const route = useRoute();

type ScopeResult = { valid: true; scope: StudyScope } | { valid: false };

// The same ?type=&id= links /study reads; a bare /listen plays every card.
const scopeResult = computed<ScopeResult>(() => {
  const type = route.query.type;
  if (type === undefined || type === "all") return { valid: true, scope: { type: "all" } };
  if (type === "artist" || type === "anime" || type === "created") {
    const idRaw = route.query.id;
    const id = Number(idRaw);
    if (typeof idRaw === "string" && idRaw.trim() !== "" && Number.isFinite(id)) {
      return { valid: true, scope: { type, id } };
    }
  }
  return { valid: false };
});
const scope = computed<StudyScope | null>(() => (scopeResult.value.valid ? scopeResult.value.scope : null));

// Resolved before the session is created: its first fetch fires during setup
// and prefetches against these values.
const { data: settings } = await useFetch<{
  defaultDownloadFolder: string | null;
  playbackMode: "auto" | "audioOnly";
  autoDownload: boolean;
  clipSource: "anisongdb" | "both" | "animethemes";
}>("/api/media-library");

const hasDefaultDownloadFolder = computed(() => Boolean(settings.value?.defaultDownloadFolder));
const audioOnly = computed(() => settings.value?.playbackMode === "audioOnly");
const autoDownload = computed(() => settings.value?.autoDownload ?? false);
const clipSource = computed(() => settings.value?.clipSource ?? "anisongdb");

// Kept apart from Study's own saved filters, so narrowing a party playlist never
// changes what a study session serves. Read during setup so the first fetch is
// already filtered.
const LISTEN_FILTERS_STORAGE_KEY = "gaqSrs:listenFilters";
function loadListenFilters(): StudyFilters {
  if (!import.meta.client) return { ...EMPTY_STUDY_FILTERS };
  try {
    return readStoredFilters(localStorage.getItem(LISTEN_FILTERS_STORAGE_KEY));
  } catch {
    return { ...EMPTY_STUDY_FILTERS };
  }
}
const filters = ref<StudyFilters>(loadListenFilters());
watch(filters, (value) => {
  try {
    localStorage.setItem(LISTEN_FILTERS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Keep the current session usable when persistence is blocked.
  }
});
const activeFilterCount = computed(() => countActiveFilters(filters.value));
const showFilters = ref(false);

function applyFilters(next: StudyFilters) {
  filters.value = next;
  showFilters.value = false;
}

const shuffle = ref(true);

const {
  currentCard,
  index,
  total,
  finished,
  loading,
  error,
  skippedCount,
  capped,
  presentationKey,
  next,
  previous,
  restart,
  patchCurrent,
} = useListenSession(scope, filters, shuffle, audioOnly, clipSource);

// A session-only override of the Playback mode setting. It is snapshotted when
// a new song begins, so the mounted player never sees its audio-only prop
// change mid-playback.
const sessionAudioOnlyOverride = ref<boolean | null>(null);
const effectiveAudioOnly = computed(() => sessionAudioOnlyOverride.value ?? audioOnly.value);
const playerAudioOnly = ref(effectiveAudioOnly.value);
watch(presentationKey, () => {
  playerAudioOnly.value = effectiveAudioOnly.value;
});

const hideVideo = ref(false);
const hideInfo = ref(true);
const hideCover = ref(false);
const randomStart = ref(false);
const ambientMode = ref(false);
// Lifts every veil for the current song only; the next song starts veiled again.
const revealedThisCard = ref(false);
watch(presentationKey, () => {
  revealedThisCard.value = false;
});

function reveal() {
  revealedThisCard.value = true;
}

const autoReveal = useListenAutoReveal(revealedThisCard, presentationKey, reveal);

// An Auto Reveal mode veils what it targets even with that Hide toggle off.
const infoHidden = computed(() => (hideInfo.value || autoReveal.targets.value.info) && !revealedThisCard.value);
const videoHidden = computed(() => (hideVideo.value || autoReveal.targets.value.visual) && !revealedThisCard.value);
const coverHidden = computed(() => (hideCover.value || autoReveal.targets.value.visual) && !revealedThisCard.value);
const anythingVeiled = computed(() => infoHidden.value || videoHidden.value || coverHidden.value);

const AMBIENT_STORAGE_KEY = "gaqSrs:studyAmbientMode";
onMounted(() => {
  try {
    const stored = localStorage.getItem(AMBIENT_STORAGE_KEY);
    ambientMode.value = stored !== null ? stored === "1" : window.innerWidth > 820;
  } catch {
    ambientMode.value = window.innerWidth > 820;
  }
});

const { setAmbientGlass } = useAmbientGlass();
watch(ambientMode, (value) => {
  setAmbientGlass(value);
  try {
    localStorage.setItem(AMBIENT_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage can be unavailable; the toggle still works for this visit.
  }
});
onUnmounted(() => setAmbientGlass(false));

const currentMediaKind = ref<"video" | "audio">("video");
const currentSourceLinks = computed(() => (currentCard.value ? buildSourceLinks(currentCard.value) : []));

const deckLabel = ref<string | null>(null);
async function fetchDeckLabel() {
  const result = scopeResult.value;
  if (!result.valid || result.scope.type === "all") {
    deckLabel.value = null;
    return;
  }
  try {
    const response = await $fetch<{ deckLabel: string }>("/api/decks/cards", {
      query: { type: result.scope.type, id: result.scope.id },
    });
    deckLabel.value = response.deckLabel;
  } catch {
    deckLabel.value = null;
  }
}
watch(scopeResult, fetchDeckLabel, { immediate: true });

const scopeChipLabel = computed(() => (scope.value?.type === "all" ? "All decks" : (deckLabel.value ?? "...")));

function switchScope(pick: ScopePick) {
  return navigateTo({ path: route.path, query: scopeToQuery(pick) });
}
const progress = computed(() => (total.value ? Math.round(((finished.value ? total.value : index.value) / total.value) * 100) : 0));
const canGoBack = computed(() => finished.value || index.value > 0);

function onLocalPathUpdated({ kind, localPath }: { kind: "video" | "audio"; localPath: string }) {
  patchCurrent(kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath });
}

function onLocalPathCleared({ kind }: { kind: "video" | "audio" }) {
  patchCurrent(kind === "video" ? { localVideoPath: null } : { localAudioPath: null });
}

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event) || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.key === "ArrowRight") next();
  else if (event.key === "ArrowLeft") previous();
  else if (key === "i") hideInfo.value = !hideInfo.value;
  else if (key === "v") hideVideo.value = !hideVideo.value;
  else if (key === "c") hideCover.value = !hideCover.value;
  else if (key === "a") ambientMode.value = !ambientMode.value;
  else if (key === "r") reveal();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="listen">
    <h1 class="sr-only">Listen</h1>

    <div v-if="!scopeResult.valid" class="state state-error">
      This listen link isn't valid. Go back to <NuxtLink to="/decks">Decks</NuxtLink> and pick a deck.
    </div>
    <div v-else-if="loading && !currentCard && !finished" class="state">
      <ActivityStatus label="Loading your playlist" />
    </div>
    <div v-else-if="error" class="state state-error">{{ error }}</div>
    <div v-else-if="total === 0" class="state">
      <MascotKai pose="surprised" class="state-mascot" />
      <strong class="state-title">No songs match</strong>
      <span v-if="skippedCount">{{ skippedCount }} {{ skippedCount === 1 ? "song has" : "songs have" }} no playable clip with your Clip source setting.</span>
      <span v-else-if="activeFilterCount">Nothing in this playlist matches your filters.</span>
      <span v-else>There is nothing to play here yet.</span>
      <div v-if="activeFilterCount" class="state-actions">
        <button type="button" class="ghost-btn" @click="showFilters = true">Edit filters</button>
        <button type="button" class="ghost-btn" @click="filters = { ...EMPTY_STUDY_FILTERS }">Clear filters</button>
      </div>
    </div>
    <div v-else-if="finished" class="state">
      <MascotKai pose="cheer" class="state-mascot" />
      <strong class="state-title">Playlist finished</strong>
      <span>{{ total }} {{ total === 1 ? "song" : "songs" }} played.</span>
      <div class="state-actions">
        <button type="button" class="primary-btn" @click="restart">Play again</button>
        <button type="button" class="ghost-btn" @click="previous">Back to the last song</button>
      </div>
    </div>
    <template v-else-if="currentCard">
      <header class="listen-header">
        <div class="header-left">
          <StudyScopePicker :scope="scope" :label="scopeChipLabel" @select="switchScope" />
          <span class="counts">{{ positionLabel(index, total) }}</span>
          <div
            class="progress"
            role="progressbar"
            aria-label="Playlist progress"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="progress-fill" :style="{ width: `${progress}%` }" />
          </div>
        </div>
        <div class="header-right">
          <button type="button" class="header-btn" :class="{ active: activeFilterCount > 0 }" @click="showFilters = true">
            Filters<span v-if="activeFilterCount" class="filters-badge">{{ activeFilterCount }}</span>
          </button>
          <button
            type="button"
            class="header-btn"
            :class="{ active: shuffle }"
            :aria-pressed="shuffle"
            @click="shuffle = !shuffle"
          >
            Shuffle
          </button>
          <button type="button" class="header-btn" :disabled="!anythingVeiled" @click="reveal">Reveal</button>
          <button type="button" class="header-btn" :disabled="!canGoBack" @click="previous">&larr; Previous</button>
          <button type="button" class="header-btn" @click="next">Next &rarr;</button>
        </div>
        <StudyDisplayToggles
          class="header-toggles"
          listen
          :hide-video="hideVideo"
          :hide-info="hideInfo"
          :hide-cover="hideCover"
          :media-kind="currentMediaKind"
          :random-start="randomStart"
          :ambient-mode="ambientMode"
          :audio-only="effectiveAudioOnly"
          :typed-answers="false"
          :typed-answers-locked="false"
          :typed-answer-categories="DEFAULT_TYPED_ANSWER_CATEGORIES"
          v-model:auto-reveal-mode="autoReveal.mode.value"
          :auto-reveal-seconds="autoReveal.seconds.value"
          @toggle-hide-video="hideVideo = !hideVideo"
          @toggle-hide-info="hideInfo = !hideInfo"
          @toggle-hide-cover="hideCover = !hideCover"
          @toggle-random-start="randomStart = !randomStart"
          @toggle-ambient-mode="ambientMode = !ambientMode"
          @toggle-audio-only="sessionAudioOnlyOverride = !effectiveAudioOnly"
          @update:auto-reveal-seconds="autoReveal.setSeconds"
        />
        <p v-if="skippedCount || capped" class="header-note">
          <template v-if="skippedCount">{{ skippedCount }} {{ skippedCount === 1 ? "song was" : "songs were" }} left out: no playable clip with your Clip source setting.</template>
          <template v-if="capped"> Showing the first {{ total + skippedCount }} songs.</template>
        </p>
      </header>
      <div class="listen-grid">
        <div class="player-pane">
          <StudyMediaPlayer
            :key="presentationKey"
            :card="currentCard"
            :hide-video="videoHidden"
            :hide-cover="coverHidden"
            :hide-theme-badge="infoHidden"
            :random-start="randomStart"
            :ambient="ambientMode"
            :has-default-download-folder="hasDefaultDownloadFolder"
            :audio-only="playerAudioOnly"
            :auto-download="autoDownload"
            :clip-source="clipSource"
            @playback-started="autoReveal.onPlaybackStarted"
            @playback-paused="autoReveal.onPlaybackPaused"
            @local-path-updated="onLocalPathUpdated"
            @local-path-cleared="onLocalPathCleared"
            @update:media-kind="currentMediaKind = $event"
          >
            <template #error-actions>
              <button type="button" class="header-btn" @click="next">Next song &rarr;</button>
            </template>
          </StudyMediaPlayer>
        </div>
        <div class="side">
          <div class="side-scroll">
            <div class="info-panel-wrap">
              <StudyAutoRevealCountdown
                v-if="autoReveal.countdownActive.value"
                :seconds="autoReveal.displaySeconds.value"
                :ambient="ambientMode"
              />
              <StudyInfoPanel
                :blurred="infoHidden"
                :inert="infoHidden"
                :ambient="ambientMode"
                :presentation-key="presentationKey"
                :immersive="false"
                :song-title="currentCard.songTitle"
                :song-title-native="currentCard.songTitleNative"
                :artist-name="currentCard.artistName"
                :anime-title-english="currentCard.animeTitleEnglish"
                :anime-title-romaji="currentCard.animeTitleRomaji"
                :anime-title-native="currentCard.animeTitleNative"
                :theme-slot="currentCard.themeSlot"
                :notes="currentCard.notes"
                :source-links="currentSourceLinks"
              />
              <button
                v-if="infoHidden"
                type="button"
                class="info-reveal-target"
                aria-label="Reveal song information"
                @click="reveal"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
    <StudyFiltersModal
      :open="showFilters"
      :filters="filters"
      title="Listen filters"
      hint="Only songs matching every filter are played. Study's own filters and schedule are never changed."
      @close="showFilters = false"
      @apply="applyFilters"
    />
  </main>
</template>

<style scoped>
.listen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.state {
  margin: auto;
  max-width: 420px;
  padding: 24px;
  text-align: center;
  border-radius: var(--radius);
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

.state-title {
  display: block;
  color: var(--text);
  font: 400 24px var(--font-display);
}

.state-mascot {
  margin: 0 auto 8px;
}

.state-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}

.primary-btn,
.ghost-btn,
.header-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn {
  padding: 8px 18px;
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.filters-badge {
  min-width: 18px;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  color: var(--accent-secondary-ink);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.header-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}

.header-btn:hover:not(:disabled),
.ghost-btn:hover {
  color: var(--text);
}

.header-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.listen-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 12px 20px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
}

.header-left {
  flex: 1 1 0;
  gap: 14px;
  min-width: min-content;
}

.header-right {
  gap: 6px;
  flex: 0 1 auto;
  min-width: 0;
  flex-wrap: wrap;
}

.header-note {
  flex: 0 0 100%;
  margin: 0;
  color: var(--faint);
  font-size: 12px;
}

.counts {
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
}

.progress {
  flex: 0 1 230px;
  min-width: 60px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.listen-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(320px, 27vw, 480px);
  align-items: stretch;
}

.player-pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px;
}

.player-pane :deep(.player-card) {
  min-height: 0;
}

.side {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 26px;
  overflow: hidden;
  background: var(--surface-sunken);
  border-left: 1px solid var(--border);
}

.header-toggles {
  flex: 0 0 100%;
}

.info-panel-wrap {
  position: relative;
}

.info-panel-wrap :deep(.auto-reveal-countdown) {
  pointer-events: none;
}

.info-reveal-target {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
}

.side > .side-scroll {
  flex: 0 1 auto;
  min-height: 0;
  margin: -6px;
  padding: 6px;
  overflow-y: auto;
}

@media (max-width: 820px) {
  .header-left {
    flex-wrap: wrap;
  }

  .listen-grid {
    grid-template-columns: 1fr;
  }

  .side {
    overflow: visible;
    border-left: none;
    border-top: 1px solid var(--border);
  }

  .side > .side-scroll {
    overflow: visible;
  }
}
</style>
