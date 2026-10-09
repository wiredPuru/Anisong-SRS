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

const { autoplayNext, toggle: toggleAutoplay } = useAutoplayNext();

// Autoplay also carries the playlist on by itself. Each song advances at most
// once, so an ended clip and a later trigger for the same song cannot skip two.
let advancedFrom = -1;
function advanceOnce() {
  if (!autoplayNext.value || advancedFrom === presentationKey.value) return;
  advancedFrom = presentationKey.value;
  next();
}

const playLimit = useListenPlayLimit(autoplayNext, presentationKey, advanceOnce);

const hideVideo = ref(false);
const hideInfo = ref(false);
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
const canGoBack = computed(() => finished.value || index.value > 0);

function onLocalPathUpdated({ kind, localPath }: { kind: "video" | "audio"; localPath: string }) {
  patchCurrent(kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath });
}

function onLocalPathCleared({ kind }: { kind: "video" | "audio" }) {
  patchCurrent(kind === "video" ? { localVideoPath: null } : { localAudioPath: null });
}

function onPlaybackStarted() {
  autoReveal.onPlaybackStarted();
  playLimit.onPlaybackStarted();
}

function onPlaybackPaused() {
  autoReveal.onPlaybackPaused();
  playLimit.onPlaybackPaused();
}

const playerPaneRef = ref<HTMLElement | null>(null);
const stageStyle = usePlayerFrameBox(playerPaneRef, presentationKey);

const DETAILS_STORAGE_KEY = "gaqSrs:listenDetails";
const showDetails = ref(false);

// Clicking the empty space around the picture flips between it and the details.
function onStageBackgroundClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  // The player card is stretched across the pane, so the sides belong to it.
  if (target === event.currentTarget || target === playerPaneRef.value || target.classList.contains("player-card")) {
    showDetails.value = !showDetails.value;
  }
}
onMounted(() => {
  try {
    showDetails.value = localStorage.getItem(DETAILS_STORAGE_KEY) === "1";
  } catch {
    showDetails.value = false;
  }
});
watch(showDetails, (open) => {
  try {
    localStorage.setItem(DETAILS_STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Not remembered without storage; the drawer still opens and closes.
  }
});

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
  else if (key === "d") showDetails.value = !showDetails.value;
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="listen" :class="{ ambient: ambientMode }">
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
      <header class="listen-header on-picture">
        <div class="header-left">
          <StudyScopePicker :scope="scope" :label="scopeChipLabel" @select="switchScope" />
        </div>
        <div class="header-right">
          <StudyDisplayMenu label="Display">
            <StudyDisplayToggles
              listen
              :hide-video="hideVideo"
              :hide-info="hideInfo"
              :hide-cover="hideCover"
              :media-kind="currentMediaKind"
              :random-start="randomStart"
              :ambient-mode="ambientMode"
              :audio-only="effectiveAudioOnly"
              :autoplay="autoplayNext"
              :typed-answers="false"
              v-model:auto-reveal-mode="autoReveal.mode.value"
              :auto-reveal-seconds="autoReveal.seconds.value"
              @toggle-hide-video="hideVideo = !hideVideo"
              @toggle-hide-info="hideInfo = !hideInfo"
              @toggle-hide-cover="hideCover = !hideCover"
              @toggle-random-start="randomStart = !randomStart"
              @toggle-ambient-mode="ambientMode = !ambientMode"
              @toggle-audio-only="sessionAudioOnlyOverride = !effectiveAudioOnly"
              @toggle-autoplay="toggleAutoplay"
              @update:auto-reveal-seconds="autoReveal.setSeconds"
            />
            <button
              type="button"
              class="menu-toggle"
              :class="{ on: shuffle }"
              :aria-pressed="shuffle"
              @click="shuffle = !shuffle"
            >
              Shuffle
            </button>
              <select
                v-model.number="playLimit.seconds.value"
                class="menu-select"
                aria-label="How much of each song to play"
                :disabled="!autoplayNext"
                :title="autoplayNext ? 'How much of each song to hear before moving on' : 'Needs Autoplay on'"
              >
                <option v-for="length in PLAY_LENGTH_OPTIONS" :key="length" :value="length">
                  {{ length === 0 ? "Play: Full song" : `Play: ${formatPlayLength(length)}` }}
                </option>
              </select>
          </StudyDisplayMenu>
          <button
            type="button"
            class="icon-btn"
            :class="{ active: activeFilterCount > 0 }"
            aria-label="Filters"
            @click="showFilters = true"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" /></svg>
            <span v-if="activeFilterCount" class="icon-badge">{{ activeFilterCount }}</span>
            <span class="tooltip">Filters</span>
          </button>
          <button
            type="button"
            class="icon-btn"
            :class="{ active: showDetails }"
            aria-label="Details"
            :aria-pressed="showDetails"
            @click="showDetails = !showDetails"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /></svg>
            <span class="tooltip">Details &middot; D</span>
          </button>
        </div>
        <p v-if="skippedCount || capped" class="header-note">
          <template v-if="skippedCount">{{ skippedCount }} {{ skippedCount === 1 ? "song was" : "songs were" }} left out: no playable clip with your Clip source setting.</template>
          <template v-if="capped"> Showing the first {{ total + skippedCount }} songs.</template>
        </p>
      </header>
      <div class="stage" :style="stageStyle" @click="onStageBackgroundClick">
        <div ref="playerPaneRef" class="player-pane on-picture">
          <StudyMediaPlayer
            :key="presentationKey"
            :card="currentCard"
            :hide-video="videoHidden"
            :hide-cover="coverHidden"
            hide-theme-badge
            tint-chrome
            :last-played="{ songTitle: currentCard.songTitle, animeTitle: currentCard.animeTitleEnglish }"
            :random-start="randomStart"
            :ambient="ambientMode"
            :has-default-download-folder="hasDefaultDownloadFolder"
            :audio-only="playerAudioOnly"
            :auto-download="autoDownload"
            :autoplay="autoplayNext"
            :play-length="autoplayNext ? playLimit.seconds.value : 0"
            :clip-source="clipSource"
            @playback-started="onPlaybackStarted"
            @playback-paused="onPlaybackPaused"
            @playback-ended="advanceOnce"
            @local-path-updated="onLocalPathUpdated"
            @local-path-cleared="onLocalPathCleared"
            @update:media-kind="currentMediaKind = $event"
          >
            <template #error-actions>
              <button type="button" class="transport-btn" @click="next">Next song &rarr;</button>
            </template>
          </StudyMediaPlayer>
          <StudyDetailsCard
            :open="showDetails"
            :cover-image-url="currentCard.animeCoverImageUrl"
            :hidden="infoHidden"
          >
            <div class="info-panel-wrap">
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
          </StudyDetailsCard>
        </div>
        <div class="np-wrap">
          <StudyNowPlaying
            class="on-picture"
            :theme-slot="currentCard.themeSlot"
            :anime-title-english="currentCard.animeTitleEnglish"
            :anime-title-native="currentCard.animeTitleNative"
            :song-title="currentCard.songTitle"
            :artist-name="currentCard.artistName"
            :cover-image-url="currentCard.animeCoverImageUrl"
            :hidden="infoHidden"
            hidden-line="Click to reveal"
            revealable
            :countdown-seconds="autoReveal.countdownActive.value ? autoReveal.displaySeconds.value : null"
            @reveal="reveal"
          >
            <div class="transport" role="group" aria-label="Playlist">
              <button
                v-if="anythingVeiled && !infoHidden"
                type="button"
                class="transport-btn"
                @click="reveal"
              >
                Reveal <kbd>R</kbd>
              </button>
              <button
                type="button"
                class="transport-btn round"
                aria-label="Previous song"
                :disabled="!canGoBack"
                @click="previous"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 5 9 12l10 7z" /></svg>
              </button>
              <span v-if="playLimit.remainingSeconds.value !== null" class="next-in" aria-live="off">
                Next in <strong>{{ playLimit.remainingSeconds.value }}s</strong>
              </span>
              <span class="position">{{ positionLabel(index, total) }}</span>
              <button type="button" class="transport-btn next" @click="next">
                Next <kbd>&rarr;</kbd>
              </button>
            </div>
          </StudyNowPlaying>
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
.menu-toggle,
.menu-select {
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

.ghost-btn:hover {
  color: var(--text);
}

.menu-toggle,
.menu-select {
  padding: 8px 14px;
  background: var(--surface);
  text-align: left;
}

.menu-toggle.on {
  border-color: var(--accent);
  color: var(--accent);
}

.menu-select:disabled {
  opacity: 0.5;
  cursor: default;
}

/* No strip: the header floats over the page as a few chips and icon
   buttons, so the stage below reads as the whole screen. */
.listen-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 14px 24px 18px;
  /* No wash behind the header: every control carries its own dark pill, and
     on an ultrawide screen a wash would end in a hard edge where the content
     column is capped. */
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
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
  gap: 8px;
}

.header-note {
  flex: 0 0 100%;
  margin: 0;
  color: var(--faint);
  font-size: 12px;
}

/* The video takes the stage; the Now playing bar sits under it, as wide as
   the picture. */
.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 6px 28px 26px;
}

.player-pane {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.player-pane :deep(.player-card) {
  min-height: 0;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.player-pane :deep(.player-frame) {
  border: 0;
  border-radius: 22px;
  box-shadow:
    0 0 110px 20px rgba(var(--amb-rgb, 150, 150, 165), 0.28),
    0 22px 48px rgba(0, 0, 0, 0.5);
}

.np-wrap {
  flex: none;
  align-self: center;
  width: max(min(100%, 820px), var(--frame-w, 100%));
  max-width: 100%;
}

.transport {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.next-in {
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.next-in strong {
  display: inline-block;
  min-width: 2.2em;
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.transport-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 20px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  font: 700 15px var(--font-sans);
  cursor: pointer;
}

.transport-btn.round {
  justify-content: center;
  width: 48px;
  padding: 0;
}

.transport-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
}

.transport-btn.next {
  border-color: transparent;
  background: #ffffff;
  color: #0b0b0d;
}

.transport-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.transport-btn kbd {
  font: inherit;
  font-size: 12px;
  opacity: 0.7;
}

.position {
  padding: 0 6px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.info-panel-wrap {
  position: relative;
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

@media (max-width: 820px) {
  .header-left {
    flex-wrap: wrap;
  }

  .stage {
    padding: 4px 14px 16px;
  }
}
</style>
