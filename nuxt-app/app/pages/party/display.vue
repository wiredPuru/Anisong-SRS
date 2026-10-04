<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party" });

const { state, connected, connect, reportPosition } = usePartyDisplay();

// Browsers block audio until the page is clicked once, so the screen waits
// for that click before following the host at all.
const started = ref(false);
let startedAt = 0;
const player = ref<{ unlock: () => void } | null>(null);
const lobbyMusic = ref<{ unlock: () => void } | null>(null);
const idleEffects = { blur: 0, pixelate: 0, decay: false, decaySeconds: 0, muted: false, picture: "video" as const };

const { isFullscreen, enter, toggle } = usePartyFullscreen();
const { scores, pops } = usePartySettledScores(state);
const { editing: arranging } = usePartyLayout();
const roundRows = computed(() => {
  const rows = scores.value?.token ? scores.value.roundPoints : [];
  return arranging.value && !rows.length && !pops.value.length ? SAMPLE_ROUND : rows;
});
// The player shows the real hints card while a lightning hint round is guessing.
const hintsOnScreen = computed(() => Boolean(state.value?.item && state.value.lightning?.hints && state.value.phase === "guessing"));

function start() {
  // Both media elements must receive play() while this click is still active.
  player.value?.unlock();
  lobbyMusic.value?.unlock();
  started.value = true;
  startedAt = Date.now();
  // The same click that unlocks audio is the gesture full screen needs.
  void enter();
  connect();
}

const IDLE_MS = 2000;
const pointerActive = ref(false);
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function onPointerMove() {
  pointerActive.value = true;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => (pointerActive.value = false), IDLE_MS);
}

function onDoubleClick(event: MouseEvent) {
  // A double-click on "Click to start" would otherwise leave full screen the
  // moment its first click entered it.
  if (!started.value || arranging.value || Date.now() - startedAt < 600) return;
  if (event.target instanceof Element && event.target.closest(".display-buttons, .layout-toolbar")) return;
  void toggle();
}

function onKeydown(event: KeyboardEvent) {
  if (!started.value || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
  const key = event.key.toLowerCase();
  if (key === "f") {
    event.preventDefault();
    void toggle();
  } else if (key === "l") {
    event.preventDefault();
    arranging.value = !arranging.value;
  } else if (key === "escape" && arranging.value) {
    event.preventDefault();
    arranging.value = false;
  }
}

// A short two-note chime when a phone buzzes in. Generated, so there is no
// sound file to ship, and only after Start, when the page may play audio.
let chime: AudioContext | null = null;
function playBuzzChime() {
  try {
    chime ??= new AudioContext();
    const at = chime.currentTime;
    for (const [offset, frequency] of [[0, 880], [0.12, 1320]] as const) {
      const osc = chime.createOscillator();
      const gain = chime.createGain();
      osc.type = "square";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.15, at + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, at + offset + 0.2);
      osc.connect(gain).connect(chime.destination);
      osc.start(at + offset);
      osc.stop(at + offset + 0.22);
    }
  } catch {
    // No Web Audio: the name on screen is enough.
  }
}

watch(() => state.value?.buzz.answering ?? null, (name, previous) => {
  if (started.value && name && name !== previous) playBuzzChime();
});

const shortUrl = (url: string) => url.replace(/^https?:\/\//, "");

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  clearTimeout(idleTimer);
});
</script>

<template>
  <main
    class="display"
    :class="{ 'is-started': started, 'is-idle': started && !pointerActive && !arranging }"
    @mousemove="onPointerMove"
    @dblclick="onDoubleClick"
  >
    <button v-if="!started" type="button" class="display-start" @click="start">
      <MascotKai pose="wave" size="hero" />
      <span class="kai-banner kai-banner-pass display-start-banner">Click to start</span>
      <span class="display-hint">Starting lets this screen play sound for the game.</span>
    </button>

    <PartyDisplayPlayer
      ref="player"
      v-show="started && Boolean(state?.item)"
      :token="state?.item?.token ?? ''"
      :upcoming="state?.upcoming ?? []"
      :kind="state?.item?.kind ?? 'video'"
      :playing="state?.playing ?? false"
      :start-at="state?.startAt ?? 0"
      :seek-to="state?.seekTo ?? null"
      :seek-seq="state?.seekSeq ?? 0"
      :start-fraction="state?.startFraction ?? 0"
      :effects="state?.effects ?? idleEffects"
      :revealed="state?.phase === 'revealed'"
      :lightning="state?.lightning ?? null"
      @position="reportPosition"
    />

    <template v-if="started && state?.item">
      <PartyLayoutFrame piece="count">
        <p class="display-count">{{ state.item.number }} / {{ state.item.total }}</p>
      </PartyLayoutFrame>
      <PartyLayoutFrame v-if="state.answer" piece="reveal">
        <PartyRevealOverlay :answer="state.answer" />
      </PartyLayoutFrame>
      <PartyRoundSummary v-if="state.summary" :summary="state.summary" />
    </template>

    <div v-else-if="started" class="display-waiting">
      <MascotKai pose="sleepy" size="hero" />
      <h1 class="kai-banner kai-banner-neutral">Waiting for the host</h1>
      <p class="display-hint">
        {{ connected ? "The game starts on this screen once the host begins." : "Connecting to the party server..." }}
      </p>
      <div v-if="state?.join" class="display-join">
        <p class="display-join-label">Join on your phone</p>
        <p v-for="url in state.join.urls" :key="url" class="display-join-url">{{ shortUrl(url) }}</p>
      </div>
    </div>

    <template v-if="started && state">
      <PartyLayoutFrame piece="round">
        <PartyRoundPoints :rows="roundRows" :pops="pops" />
      </PartyLayoutFrame>
      <PartyDisplayOverlays
        :timer="state.timer"
        :guessing="state.phase === 'guessing'"
        :scoreboard="scores?.scoreboard ?? null"
        :banner="state.banner"
        :join="state.item && !state.answer ? state.join : null"
        :answering="state.item ? state.buzz.answering : null"
        :arranging="arranging"
      />
    </template>

    <!-- Stand-ins for pieces with nothing on screen, only while arranging. -->
    <template v-if="started && arranging">
      <PartyLayoutFrame v-if="!state?.item" piece="count">
        <p class="display-count">{{ SAMPLE_COUNT.number }} / {{ SAMPLE_COUNT.total }}</p>
      </PartyLayoutFrame>
      <PartyLayoutFrame v-if="!state?.answer" piece="reveal">
        <PartyRevealOverlay :answer="SAMPLE_ANSWER" />
      </PartyLayoutFrame>
      <PartyLayoutFrame v-if="!hintsOnScreen" piece="hints">
        <PartyLightningHintsCard :hints="SAMPLE_HINTS" />
      </PartyLayoutFrame>
    </template>

    <PartyLobbyMusic
      ref="lobbyMusic"
      :music="started && state ? state.music : { enabled: false, volume: 0 }"
      :song-playing="Boolean(state?.item && state.playing)"
    />

    <PartyLayoutToolbar v-if="started && arranging" @done="arranging = false" />

    <div v-if="started" class="display-buttons">
      <button
        v-if="!arranging"
        type="button"
        class="display-button"
        aria-label="Arrange the screen (L)"
        title="Arrange the screen (L)"
        @click="arranging = true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      </button>
      <button
        type="button"
        class="display-button"
        :aria-label="isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'"
        :title="isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'"
        @click="toggle"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="isFullscreen" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          <path v-else d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
    </div>
  </main>
</template>

<style scoped>
.display {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.display.is-started {
  height: 100vh;
}

.display.is-idle {
  cursor: none;
}

.display-buttons {
  position: absolute;
  right: clamp(12px, 2vw, 24px);
  bottom: clamp(12px, 2vh, 24px);
  z-index: var(--z-chrome);
  display: flex;
  gap: 12px;
}

.display-button {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--glass-surface-panel);
  color: var(--text);
  cursor: pointer;
  transition: opacity 0.3s ease;
}

.display-button svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.display.is-idle .display-button:not(:focus-visible) {
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .display-button {
    transition: none;
  }
}

.display-start,
.display-waiting {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px;
  text-align: center;
}

.display-start {
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
}

.display-start-banner,
.display-waiting h1 {
  font-size: clamp(24px, 4vw, 56px);
}

.display-join {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: clamp(14px, 2vw, 28px) clamp(20px, 3vw, 44px);
  border: 3px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
}

.display-join p {
  margin: 0;
}

.display-join-label {
  color: var(--muted);
  font-size: clamp(14px, 1.6vw, 24px);
  font-weight: 700;
}

.display-join-url {
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 48px);
}

.display-hint {
  margin: 0;
  color: var(--muted);
  font-size: clamp(14px, 1.6vw, 22px);
}

.display-count {
  margin: 0;
  padding: 6px 16px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--glass-surface-panel);
  font-family: var(--font-display);
  font-size: clamp(14px, 1.4vw, 22px);
}
</style>
