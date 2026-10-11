<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const playing = computed(() => props.state.index >= 0 && props.state.phase === "guessing");
const choicesOn = computed(() => props.state.choices !== null);
const phoneCount = computed(() => props.state.scoreboard.players.filter((p) => p.phone).length);
const answered = computed(() => Object.keys(props.state.choicePicks).length);
const lightningRunning = computed(() => props.state.lightning !== null);

function toggleChoices() {
  emit("command", { type: "choices", enabled: !choicesOn.value });
}
</script>

<template>
  <section class="live" aria-labelledby="live-title">
    <h2 id="live-title" class="live-title">Help this song</h2>
    <p class="live-note">
      Applies to the song on screen only, whenever you like. {{ lightningRunning ? "A lightning round is running and takes over the picture." : "" }}
    </p>

    <button type="button" class="live-pill choices-btn" :class="{ active: choicesOn }" :disabled="!playing" @click="toggleChoices">
      {{ choicesOn ? "Hide multiple choice" : "Multiple choice" }}
    </button>
    <p v-if="choicesOn" class="live-hint">
      Sent to the phones and shown on the screen. {{ answered }} of {{ phoneCount }} phone player{{ phoneCount === 1 ? "" : "s" }} answered;
      right picks score when you reveal.
    </p>

  </section>
</template>

<style scoped>
.live {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.live-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.live-note,
.live-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.live-pill {
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

.live-pill.active {
  border-color: var(--accent);
  color: var(--accent);
}

.live-pill:disabled {
  opacity: 0.6;
  cursor: default;
}

.choices-btn {
  align-self: flex-start;
}

.live-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.live-time input {
  width: 64px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.unit {
  color: var(--muted);
  font-weight: 400;
}
</style>
