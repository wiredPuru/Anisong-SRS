<script setup lang="ts">
import type { PartyBanner, PartyJoinInfo, PartyPlayer, PartyTimer } from "~/composables/usePartyDisplay";

const props = defineProps<{
  timer: PartyTimer | null;
  guessing: boolean;
  scoreboard: PartyPlayer[] | null;
  banner: PartyBanner | null;
  join: PartyJoinInfo | null;
  answering: string | null;
  // Layout mode: empty pieces show samples so they can be placed.
  arranging?: boolean;
}>();

const board = computed(() => props.scoreboard ?? (props.arranging ? SAMPLE_PLAYERS : null));
const joinShown = computed(() => props.join ?? (props.arranging ? SAMPLE_JOIN : null));
const joinAddress = computed(() => joinShown.value?.urls[0]?.replace(/^https?:\/\//, "") ?? null);

const BANNER_MS = 4000;
const TICK_MS = 250;

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, TICK_MS);
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
});

const secondsLeft = computed(() => (props.timer ? Math.max(0, Math.ceil((props.timer.endsAt - now.value) / 1000)) : null));
const showTimer = computed(() => props.guessing && secondsLeft.value !== null);
const showBanner = computed(() => Boolean(props.banner && now.value - props.banner.shownAt < BANNER_MS));
</script>

<template>
  <div class="overlays">
    <PartyLayoutFrame v-if="showTimer || arranging" piece="timer">
      <div class="timer" :class="{ done: showTimer && secondsLeft === 0, urgent: showTimer && secondsLeft !== null && secondsLeft <= 3 }">
        <span v-if="!showTimer">{{ SAMPLE_TIMER_SECONDS }}</span>
        <span v-else-if="secondsLeft">{{ secondsLeft }}</span>
        <span v-else class="timer-done">Time's up!</span>
      </div>
    </PartyLayoutFrame>

    <PartyLayoutFrame v-if="board" piece="scoreboard">
      <aside class="scoreboard" aria-label="Scoreboard">
        <p class="kai-banner kai-banner-neutral scoreboard-title">Scores</p>
        <ol class="scoreboard-list">
          <li v-for="(player, index) in board" :key="player.id" class="scoreboard-row" :class="{ leader: index === 0 && player.score > 0 }">
            <span class="scoreboard-rank">{{ index + 1 }}</span>
            <span class="scoreboard-name">{{ player.name }}</span>
            <span class="scoreboard-score">{{ player.score }}</span>
          </li>
          <li v-if="!board.length" class="scoreboard-empty">No players yet</li>
        </ol>
      </aside>
    </PartyLayoutFrame>

    <div v-if="answering" class="buzz-layer" role="status">
      <p class="kai-banner kai-banner-pass buzz-name">{{ answering }}</p>
      <p class="buzz-label">buzzed in!</p>
    </div>

    <PartyLayoutFrame v-if="joinShown" piece="join">
      <p class="join-chip">
        Join<template v-if="joinAddress"> at <strong>{{ joinAddress }}</strong></template>
      </p>
    </PartyLayoutFrame>

    <div v-if="showBanner && banner" :key="banner.shownAt" class="banner-layer">
      <p class="kai-banner kai-banner-pass banner-text">{{ banner.text }}</p>
    </div>
  </div>
</template>

<style scoped>
.overlays {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.join-chip {
  margin: 0;
  padding: 6px 16px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--glass-surface-panel);
  font-size: clamp(13px, 1.2vw, 20px);
}

.join-chip strong {
  font-family: var(--font-display);
  color: var(--accent);
}

.timer {
  min-width: 2.2em;
  padding: 0.15em 0.5em;
  border: 3px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  font-family: var(--font-display);
  font-size: clamp(32px, 5vw, 88px);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.timer.urgent {
  border-color: var(--fail);
  color: var(--fail);
}

.timer.done {
  border-color: var(--accent);
  color: var(--accent);
}

.timer-done {
  font-size: 0.6em;
}

.scoreboard {
  width: min(360px, 40vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: clamp(12px, 1.6vw, 24px);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  box-shadow: var(--shadow-soft);
}

.scoreboard-title {
  align-self: flex-start;
  font-size: clamp(16px, 1.6vw, 26px);
}

.scoreboard-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scoreboard-row {
  display: grid;
  grid-template-columns: 1.6em 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: clamp(16px, 1.6vw, 28px);
}

.scoreboard-row.leader .scoreboard-name,
.scoreboard-row.leader .scoreboard-score {
  color: var(--accent);
}

.scoreboard-rank {
  color: var(--muted);
}

.scoreboard-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.scoreboard-score {
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
}

.scoreboard-empty {
  color: var(--muted);
}

.buzz-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--scrim);
  animation: banner-in 200ms ease-out;
}

.buzz-layer p {
  margin: 0;
}

.buzz-name {
  max-width: 90%;
  font-size: clamp(40px, 8vw, 140px);
  text-align: center;
  overflow-wrap: anywhere;
}

.buzz-label {
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 52px);
  color: var(--bg);
  text-shadow: var(--text-shadow-overlay);
}

.banner-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
  animation: banner-in 300ms ease-out;
}

.banner-text {
  max-width: 90%;
  font-size: clamp(36px, 7vw, 120px);
  text-align: center;
}

@keyframes banner-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .banner-layer,
  .buzz-layer {
    animation: none;
  }
}
</style>
