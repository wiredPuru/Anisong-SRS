<script setup lang="ts">
import type { PartyHostCommand, PartyHostState, PartyLive } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const MODES: { value: PartyLive["mode"]; label: string; hint: string }[] = [
  { value: "clues", label: "Clues", hint: "Year, format, score, then genres, one by one." },
  { value: "tags", label: "Tags", hint: "AniList tags appear, most telling first." },
  { value: "title", label: "Title", hint: "The title's letters fill in." },
  { value: "peek", label: "Peek", hint: "A small window onto the video grows and drifts." },
  { value: "cover", label: "Cover", hint: "The cover art sharpens from big blocks." },
  { value: "blind", label: "Blind", hint: "Audio only; the screen stays covered." },
];

const guessSeconds = ref(props.state.live?.guessSeconds ?? 15);
const playing = computed(() => props.state.index >= 0 && props.state.phase === "guessing");
const active = computed(() => props.state.live?.mode ?? null);
const hint = computed(() => MODES.find((mode) => mode.value === active.value)?.hint ?? "");
const choicesOn = computed(() => props.state.choices !== null);
const phoneCount = computed(() => props.state.scoreboard.players.filter((p) => p.phone).length);
const answered = computed(() => Object.keys(props.state.choicePicks).length);
const lightningRunning = computed(() => props.state.lightning !== null);

function pick(mode: PartyLive["mode"]) {
  if (active.value === mode) emit("command", { type: "live", config: null });
  else emit("command", { type: "live", config: { mode, guessSeconds: guessSeconds.value } });
}

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

    <div class="modes" role="group" aria-label="Hint mode">
      <button
        v-for="mode in MODES"
        :key="mode.value"
        type="button"
        class="live-pill"
        :class="{ active: active === mode.value }"
        :aria-pressed="active === mode.value"
        :disabled="!playing"
        @click="pick(mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>
    <p v-if="hint" class="live-hint">{{ hint }}</p>

    <label class="live-time">
      Reaches everything in
      <input v-model.number="guessSeconds" type="number" min="5" max="60" />
      <span class="unit">s</span>
    </label>
    <p class="live-hint">For the picture-shrinking blur, pixels and bubbles, use Effects below.</p>
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
