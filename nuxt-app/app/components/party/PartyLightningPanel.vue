<script setup lang="ts">
import type { PartyLightningMode } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const MODES: { value: PartyLightningMode; label: string; hint: string }[] = [
  { value: "regular", label: "Regular", hint: "A random slice of each clip." },
  { value: "blind", label: "Blind", hint: "Audio only; the screen stays covered." },
  { value: "peek", label: "Peek", hint: "A small window onto the video grows and drifts." },
  { value: "cover", label: "Cover", hint: "The cover art sharpens from big blocks." },
  { value: "clues", label: "Clues", hint: "Year, format, score, then genres, one by one." },
  { value: "tags", label: "Tags", hint: "AniList tags appear, most telling first." },
  { value: "title", label: "Title", hint: "The title's letters fill in." },
];

const mode = ref<PartyLightningMode>(props.state.lightning?.mode ?? "regular");
const guessSeconds = ref(props.state.lightning?.guessSeconds ?? 12);
const revealSeconds = ref(props.state.lightning?.revealSeconds ?? 5);
const running = computed(() => props.state.lightning !== null);
const hasGame = computed(() => props.state.index >= 0 && props.state.queue.length > 0);
const modeHint = computed(() => MODES.find((option) => option.value === mode.value)?.hint ?? "");

function start() {
  emit("command", {
    type: "lightning",
    config: { mode: mode.value, guessSeconds: guessSeconds.value, revealSeconds: revealSeconds.value },
  });
  emit("command", { type: "play" });
}

function stop() {
  emit("command", { type: "lightning", config: null });
}
</script>

<template>
  <section class="lightning" aria-labelledby="lightning-title">
    <div class="lightning-head">
      <h2 id="lightning-title" class="lightning-title">Lightning round</h2>
      <span v-if="running" class="running-chip">Running</span>
    </div>

    <div class="modes" role="radiogroup" aria-label="Mode">
      <button
        v-for="option in MODES"
        :key="option.value"
        type="button"
        role="radio"
        class="mode-pill"
        :class="{ active: mode === option.value }"
        :aria-checked="mode === option.value"
        @click="mode = option.value"
      >
        {{ option.label }}
      </button>
    </div>
    <p class="mode-hint">{{ modeHint }}</p>

    <div class="times">
      <label class="time-field">
        <span>Guess time</span>
        <input v-model.number="guessSeconds" type="number" min="5" max="60" />
        <span class="unit">s</span>
      </label>
      <label class="time-field">
        <span>Answer shows for</span>
        <input v-model.number="revealSeconds" type="number" min="3" max="30" />
        <span class="unit">s</span>
      </label>
    </div>

    <div class="actions">
      <button type="button" class="l-btn primary" :disabled="!hasGame" @click="start">
        {{ running ? "Restart with these settings" : "Start round" }}
      </button>
      <button v-if="running" type="button" class="l-btn" @click="stop">Stop round</button>
    </div>
    <p v-if="!hasGame" class="mode-hint">Load a game first.</p>
    <p v-else-if="running" class="mode-hint">
      Songs play from a random point, reveal after the guess time, and move on by themselves. Pause freezes the clock.
    </p>
  </section>
</template>

<style scoped>
.lightning {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lightning-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lightning-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.running-chip {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 12px;
  font-weight: 700;
}

.modes,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-pill {
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

.mode-pill.active {
  border-color: var(--accent);
  color: var(--accent);
}

.mode-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.times {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.time-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.time-field input {
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

.l-btn {
  padding: 8px 18px;
  border: 2px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.l-btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.l-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
