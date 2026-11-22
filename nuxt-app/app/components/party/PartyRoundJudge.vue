<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const nameOf = (id: number | null) =>
  id === null ? null : props.state.scoreboard.players.find((p) => p.id === id)?.name ?? null;
const answering = computed(() => nameOf(props.state.buzz.playerId));
const winner = computed(() => nameOf(props.state.buzz.winnerId));
const lockedOut = computed(() => props.state.buzz.lockedOut.map(nameOf).filter((name) => name !== null));
const showLog = computed(() => props.state.buzzerEnabled && Boolean(winner.value || lockedOut.value.length));
const showAward = computed(() => props.state.phase === "revealed" && props.state.scoreboard.players.length > 0);
const awarded = computed(() => new Set(props.state.currentAwards));
const awardPoints = (id: number) =>
  props.state.stake && (props.state.stake.playerId === null || props.state.stake.playerId === id) ? props.state.stake.multiplier : 1;
</script>

<template>
  <div v-if="answering || showLog || showAward" class="round-judge">
    <div v-if="answering" class="rj-buzz" role="status">
      <p class="rj-buzz-name"><strong>{{ answering }}</strong> buzzed in</p>
      <div class="rj-buzz-actions">
        <button type="button" class="judge-btn judge-correct" @click="emit('command', { type: 'buzzJudge', correct: true })">Correct</button>
        <button type="button" class="judge-btn judge-wrong" @click="emit('command', { type: 'buzzJudge', correct: false })">Wrong</button>
      </div>
    </div>
    <p v-if="showLog" class="rj-buzz-log">
      <span v-if="winner">Got it: <strong>{{ winner }}</strong></span>
      <span v-if="lockedOut.length">Wrong: {{ lockedOut.join(", ") }}</span>
    </p>

    <div v-if="showAward" class="rj-award">
      <p class="rj-award-label">Who got it? Tap to give a point, tap again to take it back.</p>
      <div class="rj-award-players">
        <button
          v-for="player in state.scoreboard.players"
          :key="player.id"
          type="button"
          class="award-btn"
          :class="{ on: awarded.has(player.id) }"
          :aria-pressed="awarded.has(player.id)"
          @click="emit('command', { type: 'award', playerId: player.id, awarded: !awarded.has(player.id) })"
        >
          {{ player.name }}<span v-if="awarded.has(player.id)" class="award-mark"> +{{ awardPoints(player.id) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.round-judge {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.rj-buzz {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 3px solid var(--accent);
  border-radius: var(--radius);
}

.rj-buzz-name {
  margin: 0;
  font-size: 18px;
}

.rj-buzz-name strong {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--accent);
}

.rj-buzz-actions {
  display: flex;
  gap: 10px;
}

.judge-btn {
  min-width: 110px;
  min-height: 52px;
  padding: 10px;
  border: 2px solid;
  border-radius: var(--radius-pill);
  background: transparent;
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.judge-correct {
  border-color: var(--pass);
  color: var(--pass);
}

.judge-wrong {
  border-color: var(--fail);
  color: var(--fail);
}

.rj-buzz-log {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.rj-award {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rj-award-label {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.rj-award-players {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.award-btn {
  min-height: 44px;
  padding: 8px 18px;
  border: 2px solid var(--pass);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--pass);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.award-btn.on {
  background: var(--pass);
  color: var(--bg);
}
</style>
