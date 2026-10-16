<script setup lang="ts">
import type { PartyBanner, PartyJoinInfo, PartyScoreRow, PartySongClock, PartyTimer } from "~/composables/usePartyDisplay";

const props = defineProps<{
  timer: PartyTimer | null;
  // Time left in the song, shown when no host timer is running.
  songClock?: PartySongClock | null;
  guessing: boolean;
  scoreboard: PartyScoreRow[] | null;
  rules: string | null;
  banner: PartyBanner | null;
  join: PartyJoinInfo | null;
  answering: string | null;
  // Layout mode: empty pieces show samples so they can be placed.
  arranging?: boolean;
}>();

const board = computed(() => props.scoreboard ?? (props.arranging ? SAMPLE_PLAYERS : null));
const rulesShown = computed(() => props.rules?.trim() || (props.arranging ? SAMPLE_RULES : null));
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

const hostSecondsLeft = computed(() => (props.timer ? Math.max(0, Math.ceil((props.timer.endsAt - now.value) / 1000)) : null));
const songSecondsLeft = computed(() => {
  const clock = props.songClock;
  if (!clock) return null;
  const left = clock.playing ? clock.left - (now.value - clock.at) / 1000 : clock.left;
  return Math.max(0, Math.ceil(left));
});
const usingHostTimer = computed(() => props.guessing && hostSecondsLeft.value !== null);
const secondsLeft = computed(() => (usingHostTimer.value ? hostSecondsLeft.value : songSecondsLeft.value));
const showTimer = computed(() => secondsLeft.value !== null && (usingHostTimer.value || secondsLeft.value > 0));
const { isHidden } = usePartyLayout();
const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const buzzName = computed(() => props.answering ?? (props.arranging ? SAMPLE_BUZZER : null));
const bannerText = computed(() => (showBanner.value && props.banner ? props.banner.text : props.arranging ? SAMPLE_BANNER : null));
const showBanner = computed(() => Boolean(props.banner && now.value - props.banner.shownAt < BANNER_MS));
</script>

<template>
  <div class="overlays">
    <PartyLayoutFrame v-if="showTimer || arranging" piece="timer">
      <div class="timer" :class="{ done: showTimer && secondsLeft === 0, urgent: usingHostTimer && secondsLeft !== null && secondsLeft <= 3, song: showTimer && !usingHostTimer }">
        <span v-if="!showTimer">{{ SAMPLE_TIMER_SECONDS }}</span>
        <span v-else-if="secondsLeft && !usingHostTimer">{{ formatClock(secondsLeft) }}</span>
        <span v-else-if="secondsLeft">{{ secondsLeft }}</span>
        <span v-else class="timer-done">Time's up!</span>
      </div>
    </PartyLayoutFrame>

    <PartyLayoutFrame v-if="board || rulesShown" piece="scoreboard">
      <aside class="scoreboard" aria-label="Scoreboard">
        <PartyRulesCard v-if="rulesShown" :text="rulesShown" :divided="Boolean(board)" />
        <template v-if="board">
          <ol class="scoreboard-list">
            <li v-for="(player, index) in board" :key="player.id" class="scoreboard-item" :class="{ team: player.memberRows }">
              <div class="scoreboard-row" :class="{ leader: index === 0 && player.score > 0, 'team-row': player.memberRows }">
                <span class="scoreboard-rank">{{ index + 1 }}</span>
                <span class="scoreboard-name">{{ player.name }}</span>
                <span class="scoreboard-score">{{ player.score }}</span>
              </div>
              <ol v-if="player.memberRows?.length" class="team-members">
                <li v-for="member in player.memberRows" :key="member.id" class="team-member">
                  <span class="scoreboard-name">{{ member.name }}</span>
                  <span class="scoreboard-score">{{ member.score }}</span>
                </li>
              </ol>
            </li>
            <li v-if="!board.length" class="scoreboard-empty">No players yet</li>
          </ol>
        </template>
      </aside>
    </PartyLayoutFrame>

    <div v-if="answering && !isHidden('buzz')" class="buzz-layer" aria-hidden="true" />
    <PartyLayoutFrame v-if="buzzName" piece="buzz">
      <div class="buzz-card" role="status">
        <p class="kai-banner kai-banner-pass buzz-name">{{ buzzName }}</p>
        <p class="buzz-label">buzzed in!</p>
      </div>
    </PartyLayoutFrame>

    <PartyLayoutFrame v-if="joinShown" piece="join">
      <p class="join-chip">
        Join<template v-if="joinAddress"> at <strong>{{ joinAddress }}</strong></template>
      </p>
    </PartyLayoutFrame>

    <div v-if="showBanner && !isHidden('banner')" :key="banner?.shownAt" class="banner-layer" aria-hidden="true" />
    <PartyLayoutFrame v-if="bannerText" :key="`b${banner?.shownAt}`" piece="banner">
      <p class="kai-banner kai-banner-pass banner-text">{{ bannerText }}</p>
    </PartyLayoutFrame>
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
  font-size: clamp(13px, 1.2vw, 1.85vh);
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
  font-size: clamp(32px, 5vw, 8.15vh);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* The song's own time left reads quieter than a host countdown. */
.timer.song {
  font-size: clamp(24px, 3.5vw, 5.7vh);
  opacity: 0.85;
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
  width: min(33.3vh, 40vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: clamp(12px, 1.6vw, 2.22vh);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  box-shadow: var(--shadow-soft);
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
  font-size: clamp(16px, 1.6vw, 2.59vh);
}

.scoreboard-item.team {
  padding: 8px 10px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.team-row {
  font-size: 1.25em;
}

.team-members {
  margin: 6px 0 0;
  padding: 6px 0 0 1.6em;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border-top: 1px dashed var(--border);
}

.team-member {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  font-size: 0.85em;
}

.scoreboard-row.leader .scoreboard-name {
  color: var(--accent);
}

.scoreboard-score {
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
  background: var(--scrim);
  animation: banner-in 200ms ease-out;
}

.buzz-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.buzz-card p {
  margin: 0;
}

.buzz-name {
  max-width: 90vw;
  font-size: clamp(40px, 8vw, 12.96vh);
  text-align: center;
  overflow-wrap: anywhere;
}

.buzz-label {
  font-family: var(--font-display);
  font-size: clamp(22px, 3vw, 4.81vh);
  color: var(--text-on-scrim);
  text-shadow: var(--text-shadow-overlay);
}

.banner-layer {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  animation: banner-in 300ms ease-out;
}

.banner-text {
  max-width: 90vw;
  font-size: clamp(36px, 7vw, 11.11vh);
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
