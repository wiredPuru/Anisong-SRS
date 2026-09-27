<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party" });

const { state, connected, connect, reportPosition } = usePartyDisplay();

// Browsers block audio until the page is clicked once, so the screen waits
// for that click before following the host at all.
const started = ref(false);
let startedAt = 0;

const { isFullscreen, enter, toggle } = usePartyFullscreen();

function start() {
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
  if (!started.value || Date.now() - startedAt < 600) return;
  if (event.target instanceof Element && event.target.closest(".display-fullscreen")) return;
  void toggle();
}

function onKeydown(event: KeyboardEvent) {
  if (!started.value || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
  if (event.key !== "f" && event.key !== "F") return;
  event.preventDefault();
  void toggle();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  clearTimeout(idleTimer);
});
</script>

<template>
  <main
    class="display"
    :class="{ 'is-started': started, 'is-idle': started && !pointerActive }"
    @mousemove="onPointerMove"
    @dblclick="onDoubleClick"
  >
    <button v-if="!started" type="button" class="display-start" @click="start">
      <MascotKai pose="wave" size="hero" />
      <span class="kai-banner kai-banner-pass display-start-banner">Click to start</span>
      <span class="display-hint">Starting lets this screen play sound for the game.</span>
    </button>

    <template v-else-if="state?.item">
      <PartyDisplayPlayer
        :token="state.item.token"
        :upcoming="state.upcoming"
        :kind="state.item.kind"
        :playing="state.playing"
        :start-at="state.startAt"
        :seek-to="state.seekTo"
        :seek-seq="state.seekSeq"
        :start-fraction="state.startFraction"
        :effects="state.effects"
        :revealed="state.phase === 'revealed'"
        :lightning="state.lightning"
        @position="reportPosition"
      />
      <p class="display-count">{{ state.item.number }} / {{ state.item.total }}</p>
      <PartyRevealOverlay v-if="state.answer" :answer="state.answer" />
    </template>

    <div v-else class="display-waiting">
      <MascotKai pose="sleepy" size="hero" />
      <h1 class="kai-banner kai-banner-neutral">Waiting for the host</h1>
      <p class="display-hint">
        {{ connected ? "The game starts on this screen once the host begins." : "Connecting to the party server..." }}
      </p>
    </div>

    <template v-if="started && state">
      <PartyDisplayOverlays
        :timer="state.timer"
        :guessing="state.phase === 'guessing'"
        :scoreboard="state.scoreboard"
        :banner="state.banner"
      />
      <PartyLobbyMusic :music="state.music" :song-playing="Boolean(state.item && state.playing)" />
    </template>

    <button
      v-if="started"
      type="button"
      class="display-fullscreen"
      :aria-label="isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'"
      :title="isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path v-if="isFullscreen" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        <path v-else d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </svg>
    </button>
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

.display-fullscreen {
  position: absolute;
  right: clamp(12px, 2vw, 24px);
  bottom: clamp(12px, 2vh, 24px);
  z-index: var(--z-chrome);
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

.display-fullscreen svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.display.is-idle .display-fullscreen:not(:focus-visible) {
  opacity: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .display-fullscreen {
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

.display-hint {
  margin: 0;
  color: var(--muted);
  font-size: clamp(14px, 1.6vw, 22px);
}

.display-count {
  position: absolute;
  top: clamp(12px, 2vh, 24px);
  right: clamp(12px, 2vw, 24px);
  margin: 0;
  padding: 6px 16px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--glass-surface-panel);
  font-family: var(--font-display);
  font-size: clamp(14px, 1.4vw, 22px);
}
</style>
