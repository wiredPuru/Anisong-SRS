<script setup lang="ts">
import type { StudyFilters } from "~/utils/studyFilters";
import type { StudyScope } from "~/composables/useStudySession";
import { buildSourceLinks } from "~/utils/sourceLinks";
import { scopeToQuery, type ScopePick } from "~/utils/scopePick";
import type { HotkeyActionId } from "~/utils/hotkeys";

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
  japaneseBreakdown: boolean;
  clipSource: "anisongdb" | "both" | "animethemes";
}>("/api/media-library");

const hasDefaultDownloadFolder = computed(() => Boolean(settings.value?.defaultDownloadFolder));
const audioOnly = computed(() => settings.value?.playbackMode === "audioOnly");
const japaneseBreakdown = computed(() => settings.value?.japaneseBreakdown ?? false);
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
  nextCard,
  queueKey,
  index,
  total,
  finished,
  loading,
  error,
  skippedCount,
  capped,
  offlineHidden,
  presentationKey,
  next,
  previous,
  restart,
  patchCard,
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
const listenMix = useListenMix();

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

function onLocalPathUpdated({ cardId, kind, localPath }: { cardId: number; kind: "video" | "audio"; localPath: string }) {
  patchCard(cardId, kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath });
}

function onLocalPathCleared({ cardId, kind }: { cardId: number; kind: "video" | "audio" }) {
  patchCard(cardId, kind === "video" ? { localVideoPath: null } : { localAudioPath: null });
}

// What the outgoing picture was showing when the handoff happened, so a song
// that was revealed does not re-veil while it is still on screen.
const frozenVeil = ref({ video: false, cover: false });
const playback = useListenPlayback({
  advance: next,
  onHandoff: () => { frozenVeil.value = { video: videoHidden.value, cover: coverHidden.value }; },
  playLengthRemaining: () => playLimit.remainingExactSeconds(),
});
watchEffect(() => playback.configure({
  mix: listenMix.enabled.value,
  autoplay: autoplayNext.value,
  audioOnly: effectiveAudioOnly.value,
  randomStart: randomStart.value,
  playLength: playLimit.seconds.value,
  mixSeconds: listenMix.seconds.value,
  mixCurve: listenMix.curve.value,
}));
watch([presentationKey, queueKey, currentCard, nextCard], () => playback.synchronize({
  key: presentationKey.value,
  queue: queueKey.value,
  card: currentCard.value,
  nextCard: nextCard.value,
}), { immediate: true });

// With Mix the next song starts at the planned handoff, a few seconds before
// the old one would have ended.
const nextInSeconds = computed(() => {
  const left = playLimit.remainingSeconds.value;
  if (left === null) return null;
  const mixing = playback.managedMode.value && listenMix.enabled.value && playback.slots.value.some((s) => s.role === "standby");
  return mixing ? secondsUntilHandoff(left, listenMix.seconds.value) : left;
});

function onPlaybackStarted() {
  autoReveal.onPlaybackStarted();
  playLimit.onPlaybackStarted();
  void playback.foregroundResumed();
}

function onPlaybackPaused() {
  autoReveal.onPlaybackPaused();
  playLimit.onPlaybackPaused();
  playback.foregroundPaused();
}

const playerPaneRef = ref<HTMLElement | null>(null);
const stageStyle = usePlayerFrameBox(playerPaneRef, presentationKey);

const DETAILS_STORAGE_KEY = "gaqSrs:listenDetails";
const showDetails = ref(false);

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

// J flips to the Japanese breakdown. Only one of it and Details is open at a
// time, and it only exists when its Settings toggle is on.
const showJapanese = ref(false);
const japaneseOpen = computed(() => showJapanese.value && japaneseBreakdown.value);
watch(showDetails, (open) => {
  if (open) showJapanese.value = false;
});
watch(showJapanese, (open) => {
  if (open) showDetails.value = false;
});
function toggleJapanese() {
  if (japaneseBreakdown.value) showJapanese.value = !showJapanese.value;
}

// A new song always opens on the picture, even if the last one was flipped.
watch(presentationKey, () => {
  showDetails.value = false;
  showJapanese.value = false;
});

const { isTypingTarget } = useHotkeyGuard();
const hotkeys = useHotkeys();
const { hint: hotkeyHint } = hotkeys;

// Playback's key is handled independently by StudyMediaPlayer.
const PAGE_ACTIONS: Partial<Record<HotkeyActionId, () => void>> = {
  listenNext: next,
  listenPrevious: previous,
  hideInfo: () => { hideInfo.value = !hideInfo.value; },
  hideVideo: () => { hideVideo.value = !hideVideo.value; },
  hideCover: () => { hideCover.value = !hideCover.value; },
  ambient: () => { ambientMode.value = !ambientMode.value; },
  reveal,
  flipCard: () => { showDetails.value = !showDetails.value; },
  flipJapanese: toggleJapanese,
};

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  const action = hotkeys.actionFor("listen", event);
  const run = action && PAGE_ACTIONS[action];
  if (!run) return;
  hotkeys.claimSpace(event);
  run();
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
      <span v-if="offlineHidden"><OfflineHiddenNote :count="offlineHidden" />. Turn off Playable offline only in Settings to bring them back.</span>
      <span v-else-if="skippedCount">{{ skippedCount }} {{ skippedCount === 1 ? "song has" : "songs have" }} no playable clip with your Clip source setting.</span>
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
            <button
              type="button"
              class="menu-toggle"
              :class="{ on: listenMix.enabled.value }"
              :aria-pressed="listenMix.enabled.value"
              :aria-describedby="'mix-note'"
              title="Crossfade into the next song"
              @click="listenMix.toggle()"
            >
              Mix
            </button>
            <select
              v-if="listenMix.enabled.value"
              :value="listenMix.seconds.value"
              class="menu-select"
              aria-label="Mix fade length"
              :disabled="!autoplayNext"
              :title="autoplayNext ? 'How long songs overlap' : 'Needs Autoplay on'"
              @change="listenMix.setSeconds(Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="length in LISTEN_MIX_LENGTH_OPTIONS" :key="length" :value="length">
                Fade: {{ length }}s
              </option>
            </select>
            <select
              v-if="listenMix.enabled.value"
              :value="listenMix.curve.value"
              class="menu-select"
              aria-label="Mix fade curve"
              :disabled="!autoplayNext"
              :title="autoplayNext ? 'Smooth keeps the loudness steady through the fade' : 'Needs Autoplay on'"
              @change="listenMix.setCurve(($event.target as HTMLSelectElement).value)"
            >
              <option value="smooth">Curve: Smooth</option>
              <option value="linear">Curve: Linear</option>
            </select>
            <p id="mix-note" class="menu-note">
              <template v-if="listenMix.enabled.value && !autoplayNext">Needs Autoplay on</template>
              <template v-else>Crossfade between songs (with Autoplay)</template>
            </p>
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
          <button
            v-if="japaneseBreakdown"
            type="button"
            class="icon-btn"
            :class="{ active: japaneseOpen }"
            aria-label="Japanese breakdown"
            :aria-pressed="japaneseOpen"
            @click="toggleJapanese"
          >
            <span class="jp-glyph" lang="ja" aria-hidden="true">漢</span>
            <span class="tooltip">Japanese breakdown<template v-if="hotkeyHint('flipJapanese')"> &middot; {{ hotkeyHint("flipJapanese") }}</template></span>
          </button>
        </div>
        <p v-if="skippedCount || capped || offlineHidden" class="header-note">
          <OfflineHiddenNote :count="offlineHidden" />
          <template v-if="skippedCount">{{ skippedCount }} {{ skippedCount === 1 ? "song was" : "songs were" }} left out: no playable clip with your Clip source setting.</template>
          <template v-if="capped"> Showing the first {{ total + skippedCount }} songs.</template>
        </p>
      </header>
      <div class="stage" :style="stageStyle">
        <div ref="playerPaneRef" class="player-pane on-picture">
          <ListenMediaPlayer
            hotkey-scope="listen"
            :presentation-key="presentationKey"
            :card="currentCard"
            :managed-mode="playback.managedMode.value"
            :tail-hide-video="frozenVeil.video"
            :tail-hide-cover="frozenVeil.cover"
            :slots="playback.slots.value"
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
            @attach="playback.attach"
            @report="playback.report"
            @local-path-updated="onLocalPathUpdated"
            @local-path-cleared="onLocalPathCleared"
            @update:media-kind="currentMediaKind = $event"
          >
            <template #error-actions>
              <button type="button" class="transport-btn" @click="next">Next song &rarr;</button>
            </template>
          </ListenMediaPlayer>
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
                :artist-href="artistDeckPath(currentCard.artistId)"
                artist-new-tab
                :anime-title-english="currentCard.animeTitleEnglish"
                :anime-title-romaji="currentCard.animeTitleRomaji"
                :anime-title-native="currentCard.animeTitleNative"
                :anime-year="currentCard.animeYear"
                :anime-studios="currentCard.animeStudios"
                :anime-tags="currentCard.animeTags"
                :anime-href="animeCardsSearchPath(currentCard.animeTitleRomaji)"
                anime-new-tab
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
          <StudyDetailsCard
            v-if="japaneseBreakdown"
            :open="japaneseOpen"
            :cover-image-url="currentCard.animeCoverImageUrl"
            :hidden="infoHidden"
          >
            <StudyJapaneseBreakdown
              :anime-title-native="currentCard.animeTitleNative"
              :song-title-native="currentCard.songTitleNative"
              :blurred="infoHidden"
              :source-card-id="currentCard.id"
            />
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
            :on-details="showDetails || japaneseOpen"
            @reveal="reveal"
            @watch-video="showDetails = false; showJapanese = false"
          >
            <div class="transport" role="group" aria-label="Playlist">
              <button
                v-if="anythingVeiled && !infoHidden"
                type="button"
                class="transport-btn"
                @click="reveal"
              >
                Reveal <kbd v-if="hotkeyHint('reveal')">{{ hotkeyHint("reveal") }}</kbd>
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
              <span v-if="nextInSeconds !== null" class="next-in" aria-live="off">
                Next in <strong>{{ nextInSeconds }}s</strong>
              </span>
              <span class="position">{{ positionLabel(index, total) }}</span>
              <button type="button" class="transport-btn next" @click="next">
                Next <kbd v-if="hotkeyHint('listenNext')">{{ hotkeyHint("listenNext") }}</kbd>
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
.menu-note {
  margin: 0;
  padding: 0 4px;
  font-size: 0.75rem;
  color: var(--muted);
}

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

.jp-glyph {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}
</style>
