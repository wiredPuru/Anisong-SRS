<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const current = computed(() => props.state.queue[props.state.index] ?? null);
const position = computed(() => {
  const reported = props.state.position;
  return reported && current.value ? reported : null;
});
const progress = computed(() => {
  const p = position.value;
  return p && p.duration ? Math.min(1, p.currentTime / p.duration) : 0;
});
const blocked = computed(() => props.state.playing && position.value?.blocked);
// Asked to play, but the display has not said it is: the clip is loading.
const loading = computed(() => props.state.playing && Boolean(current.value) && !position.value?.playing && !blocked.value);
const atStart = computed(() => props.state.index <= 0);
const atEnd = computed(() => props.state.index >= props.state.queue.length - 1);
const confirmingClear = ref(false);

const nameOf = (id: number | null) =>
  id === null ? null : props.state.scoreboard.players.find((p) => p.id === id)?.name ?? null;
const answering = computed(() => nameOf(props.state.buzz.playerId));
const winner = computed(() => nameOf(props.state.buzz.winnerId));
const lockedOut = computed(() => props.state.buzz.lockedOut.map(nameOf).filter((name) => name !== null));
const awarded = computed(() => new Set(props.state.currentAwards));
const awardPoints = (id: number) =>
  props.state.stake && (props.state.stake.playerId === null || props.state.stake.playerId === id) ? props.state.stake.multiplier : 1;

function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "--:--";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function seekFromBar(event: MouseEvent) {
  const duration = position.value?.duration;
  if (!duration) return;
  const bar = event.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  emit("command", { type: "seek", seconds: Math.round(fraction * duration * 10) / 10 });
}

const skipSeconds = computed(() => (current.value ? skipTarget(position.value?.duration) : null));

function skipToEnd() {
  if (skipSeconds.value === null) return;
  emit("command", { type: "seek", seconds: skipSeconds.value, skip: true });
}

function clearGame() {
  confirmingClear.value = false;
  emit("command", { type: "clear" });
}

// Dragging the slider sends at most one change per 120ms, and always the last.
let volumeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingVolume = 0;
function setSongVolume(volume: number) {
  pendingVolume = volume;
  if (volumeTimer) return;
  volumeTimer = setTimeout(() => {
    volumeTimer = null;
    emit("command", { type: "songVolume", volume: pendingVolume });
  }, 120);
}
</script>

<template>
  <div class="now-playing">
    <div class="np-head">
      <p class="np-count">Song {{ state.index + 1 }} of {{ state.queue.length }}</p>
      <span class="np-chips">
        <span v-if="loading" class="np-chip chip-loading">Loading...</span>
        <span v-if="state.lightning" class="np-chip chip-lightning">Lightning: {{ state.lightning.mode }}</span>
        <span class="np-chip" :class="state.phase === 'revealed' ? 'chip-revealed' : 'chip-hidden'">
          {{ state.phase === "revealed" ? "Revealed" : "Hidden" }}
        </span>
      </span>
    </div>

    <div v-if="current" class="np-answer">
      <img v-if="current.answer.coverImageUrl" class="np-cover" :src="current.answer.coverImageUrl" alt="" />
      <div class="np-text">
        <p class="np-title">{{ current.answer.animeTitleEnglish }}</p>
        <p v-if="current.answer.animeTitleRomaji !== current.answer.animeTitleEnglish" class="np-sub">
          {{ current.answer.animeTitleRomaji }}
        </p>
        <p class="np-song">
          {{ current.answer.songTitle }} <span class="np-artist">{{ current.answer.artistName }}</span>
        </p>
        <p class="np-slot">{{ formatThemeSlotLabel(current.answer.themeSlot) }} · {{ current.kind === "audio" ? "Audio" : "Video" }}</p>
      </div>
    </div>

    <p v-if="!position" class="np-notice">
      The display hasn't reported yet. Open the display screen and click Start.
    </p>
    <p v-else-if="blocked" class="np-notice" role="status">
      The display can't start playback. Tap or click the display screen.
    </p>
    <div class="np-progress">
      <button
        type="button"
        class="np-bar"
        :disabled="!position?.duration"
        aria-label="Seek"
        @click="seekFromBar"
      >
        <span class="np-bar-fill" :style="{ width: `${progress * 100}%` }" />
      </button>
      <span class="np-time">{{ formatTime(position?.currentTime) }} / {{ formatTime(position?.duration) }}</span>
    </div>

    <div v-if="answering" class="np-buzz" role="status">
      <p class="np-buzz-name"><strong>{{ answering }}</strong> buzzed in</p>
      <div class="np-buzz-actions">
        <button type="button" class="tbtn tbtn-reveal" @click="emit('command', { type: 'buzzJudge', correct: true })">Correct</button>
        <button type="button" class="tbtn tbtn-wrong" @click="emit('command', { type: 'buzzJudge', correct: false })">Wrong</button>
      </div>
    </div>
    <p v-if="state.buzzerEnabled && (winner || lockedOut.length)" class="np-buzz-log">
      <span v-if="winner">Got it: <strong>{{ winner }}</strong></span>
      <span v-if="lockedOut.length">Wrong: {{ lockedOut.join(", ") }}</span>
    </p>

    <div v-if="state.phase === 'revealed' && state.scoreboard.players.length" class="np-award">
      <p class="np-award-label">Who got it? Tap to give a point, tap again to take it back.</p>
      <div class="np-award-players">
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

    <div class="np-transport">
      <button type="button" class="tbtn" :disabled="atStart" @click="emit('command', { type: 'previous' })">Previous</button>
      <button
        type="button"
        class="tbtn tbtn-main"
        @click="emit('command', { type: state.playing ? 'pause' : 'play' })"
      >
        {{ state.playing ? "Pause" : "Play" }}
      </button>
      <button type="button" class="tbtn" :disabled="atEnd && state.summaryVisible" @click="emit('command', { type: 'next' })">
        {{ atEnd ? "Show results" : "Next" }}
      </button>
      <button
        type="button"
        class="tbtn tbtn-reveal"
        :disabled="state.phase === 'revealed'"
        @click="emit('command', { type: 'reveal' })"
      >
        Reveal
      </button>
      <button type="button" class="tbtn" :disabled="skipSeconds === null" @click="skipToEnd">Skip to end</button>
    </div>

    <label class="np-volume">
      <span>Song volume</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        aria-label="Song volume on the display"
        :value="state.songVolume"
        @input="setSongVolume(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="np-volume-value">{{ Math.round(state.songVolume * 100) }}%</span>
    </label>

    <div class="np-options">
      <label class="np-toggle">
        <input
          type="checkbox"
          :checked="state.randomStart"
          @change="emit('command', { type: 'settings', randomStart: ($event.target as HTMLInputElement).checked })"
        />
        Random start (from the next song)
      </label>
      <label class="np-toggle">
        <input
          type="checkbox"
          :checked="state.autoAdvance"
          @change="emit('command', { type: 'autoAdvance', enabled: ($event.target as HTMLInputElement).checked })"
        />
        Go to the next song when one ends
      </label>
      <label class="np-toggle">
        <input
          type="checkbox"
          :checked="state.buzzerEnabled"
          @change="emit('command', { type: 'buzzer', enabled: ($event.target as HTMLInputElement).checked })"
        />
        Buzzer mode (players buzz from their phones)
      </label>
      <button
        type="button"
        class="link-btn"
        @click="emit('command', { type: 'summary', visible: !state.summaryVisible })"
      >
        {{ state.summaryVisible ? "Hide results" : "Show results" }}
      </button>
      <span class="np-spacer" />
      <template v-if="confirmingClear">
        <span class="np-confirm">End this game?</span>
        <button type="button" class="link-btn danger" @click="clearGame">End game</button>
        <button type="button" class="link-btn" @click="confirmingClear = false">Keep playing</button>
      </template>
      <button v-else type="button" class="link-btn" @click="confirmingClear = true">End game</button>
    </div>
  </div>
</template>

<style scoped>
.now-playing {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.np-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.np-count {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
}

.np-chip {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 2px solid;
  font-size: 13px;
  font-weight: 700;
}

.np-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-lightning {
  border-color: var(--accent);
  color: var(--accent);
  text-transform: capitalize;
}

.chip-loading {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
}

.chip-hidden {
  border-color: var(--border);
  color: var(--muted);
}

.chip-revealed {
  border-color: var(--pass);
  color: var(--pass);
}

.np-answer {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.np-cover {
  flex-shrink: 0;
  width: 84px;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 2px solid var(--outline);
}

.np-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.np-text p {
  margin: 0;
}

.np-title {
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 1.2;
}

.np-sub,
.np-slot {
  color: var(--muted);
  font-size: 14px;
}

.np-song {
  font-weight: 700;
  color: var(--accent);
}

.np-artist {
  font-weight: 400;
  color: var(--text);
}

.np-notice {
  margin: 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--muted);
  font-size: 14px;
}

.np-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.np-bar {
  position: relative;
  flex: 1;
  height: 14px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  overflow: hidden;
  cursor: pointer;
}

.np-bar:disabled {
  cursor: default;
}

.np-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
}

.np-time {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  font-size: 14px;
}

.np-transport {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.tbtn {
  min-height: 52px;
  padding: 10px;
  border: 2px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.tbtn:disabled {
  opacity: 0.45;
  cursor: default;
}

.tbtn-main {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.tbtn-reveal {
  border-color: var(--pass);
  color: var(--pass);
}

.np-buzz {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 3px solid var(--accent);
  border-radius: var(--radius);
}

.np-buzz-name {
  margin: 0;
  font-size: 18px;
}

.np-buzz-name strong {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--accent);
}

.np-buzz-actions {
  display: flex;
  gap: 10px;
}

.np-buzz-actions .tbtn {
  min-width: 110px;
}

.tbtn-wrong {
  border-color: var(--fail);
  color: var(--fail);
}

.np-award {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.np-award-label {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.np-award-players {
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

.np-buzz-log {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.np-volume {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
}

.np-volume input {
  flex: 1;
  min-width: 120px;
  accent-color: var(--accent);
}

.np-volume-value {
  min-width: 3.5ch;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.np-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.np-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.np-spacer {
  flex: 1;
}

.np-confirm {
  font-size: 14px;
  font-weight: 700;
}

.link-btn {
  border: none;
  background: none;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.link-btn.danger {
  color: var(--fail);
}

@media (max-width: 820px) {
  .np-transport {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
