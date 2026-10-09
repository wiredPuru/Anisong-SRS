<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const OPTIONS = [
  { label: "Challenge ×2", multiplier: 2, risk: false },
  { label: "Hyper Risk ×3", multiplier: 3, risk: true },
  { label: "Hyper Risk ×4", multiplier: 4, risk: true },
];

const target = ref<number | null>(null);
const hasSong = computed(() => props.state.index >= 0);
const stake = computed(() => props.state.stake);
const players = computed(() => props.state.scoreboard.players);
const missTarget = computed(() => players.value.find((p) => p.id === stake.value?.playerId) ?? null);

// A player who left no longer holds the choice.
watch(players, (list) => {
  if (target.value !== null && !list.some((p) => p.id === target.value)) target.value = null;
});

function apply(option: (typeof OPTIONS)[number]) {
  const active = stake.value?.multiplier === option.multiplier && stake.value.risk === option.risk && stake.value.playerId === target.value;
  emit("command", {
    type: "stake",
    config: active ? null : { multiplier: option.multiplier, risk: option.risk, playerId: target.value },
  });
}

function missed() {
  if (stake.value && missTarget.value) {
    emit("command", { type: "score", op: "adjust", id: missTarget.value.id, delta: -stake.value.multiplier });
  }
}
</script>

<template>
  <section class="stake" aria-labelledby="stake-title">
    <h2 id="stake-title" class="stake-title">Challenge &amp; Hyper Risk</h2>
    <p class="stake-note">
      Multiplies the points for this song only. Hyper Risk also takes the same multiple off a wrong buzz.
    </p>

    <label class="stake-field">
      Who
      <select v-model="target" class="stake-select">
        <option :value="null">Anyone who scores</option>
        <option v-for="player in players" :key="player.id" :value="player.id">{{ player.name }}</option>
      </select>
    </label>

    <div class="stake-options" role="group" aria-label="Stake">
      <button
        v-for="option in OPTIONS"
        :key="option.label"
        type="button"
        class="stake-pill"
        :class="{ active: stake?.multiplier === option.multiplier && stake?.risk === option.risk }"
        :aria-pressed="stake?.multiplier === option.multiplier && stake?.risk === option.risk"
        :disabled="!hasSong"
        @click="apply(option)"
      >
        {{ option.label }}
      </button>
      <button v-if="stake" type="button" class="stake-pill" @click="emit('command', { type: 'stake', config: null })">Clear</button>
    </div>

    <button v-if="stake?.risk && missTarget" type="button" class="stake-miss" @click="missed">
      {{ missTarget.name }} missed it (−{{ stake.multiplier }})
    </button>
  </section>
</template>

<style scoped>
.stake {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stake-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.stake-note {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.stake-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.stake-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font: inherit;
}

.stake-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stake-pill,
.stake-miss {
  padding: 6px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.stake-pill.active {
  border-color: var(--accent);
  color: var(--accent);
}

.stake-pill:disabled {
  opacity: 0.6;
  cursor: default;
}

.stake-miss {
  align-self: flex-start;
  border-color: var(--fail);
  color: var(--fail);
}
</style>
