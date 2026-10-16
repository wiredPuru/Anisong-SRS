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
const clipFailed = computed(() => Boolean(position.value?.failed));
// Loading or failed: the host gets a way out that does not need the display.
const stuck = computed(() => clipFailed.value || (loading.value && Boolean(position.value)));
const canChangeSource = computed(() => (current.value?.cardId ?? 0) > 0);
const sourceNote = ref<string | null>(null);
const changing = ref(false);
watch(() => current.value?.cardId, () => (sourceNote.value = null));

async function changeSource() {
  if (changing.value) return;
  changing.value = true;
  sourceNote.value = null;
  try {
    const result = await $fetch<{ changed?: boolean }>("/api/party/host/command", { method: "POST", body: { type: "changeSource" } });
    sourceNote.value = result.changed ? "Switched to the next source for this song." : "This song has no other source to try.";
  } catch {
    sourceNote.value = "That didn't go through.";
  } finally {
    changing.value = false;
  }
}
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
      <NetworkImage v-if="current.answer.coverImageUrl" class="np-cover" :src="current.answer.coverImageUrl" alt="" />
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

    <div v-if="stuck" class="np-stuck" role="status">
      <p class="np-stuck-text">
        <template v-if="clipFailed">This clip won't play.</template>
        <ActivityStatus v-else label="Loading clip" :request-key="current?.cardId ?? 0" />
        <span class="np-stuck-source">
          {{ current?.kind === "audio" ? "Audio" : "Video" }}, {{ current?.origin === "local" ? "from a local file" : "streamed" }}
        </span>
      </p>
      <div class="np-stuck-actions">
        <button v-if="!clipFailed" type="button" class="tbtn" @click="emit('command', { type: 'pause' })">Cancel</button>
        <button v-if="!atEnd" type="button" class="tbtn" @click="emit('command', { type: 'next' })">Skip to next</button>
        <button type="button" class="tbtn" :disabled="!canChangeSource || changing" :title="canChangeSource ? '' : 'Songs added from outside your library have one source'" @click="changeSource">
          Change source
        </button>
      </div>
      <p v-if="sourceNote" class="np-stuck-note">{{ sourceNote }}</p>
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
      <button type="button" class="tbtn tbtn-icon" aria-label="Previous song" :disabled="atStart" @click="emit('command', { type: 'previous' })">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5 9 12l10 7z" /><path d="M5 5v14" /></svg>
        <span class="tooltip">Previous song &middot; P</span>
      </button>
      <button
        type="button"
        class="tbtn tbtn-icon tbtn-main"
        :aria-label="state.playing ? 'Pause' : 'Play'"
        @click="emit('command', { type: state.playing ? 'pause' : 'play' })"
      >
        <svg v-if="state.playing" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m7 4 13 8-13 8z" /></svg>
        <span class="tooltip">{{ state.playing ? "Pause" : "Play" }} &middot; Space</span>
      </button>
      <button
        type="button"
        class="tbtn tbtn-icon"
        :aria-label="atEnd ? 'Show results' : 'Next song'"
        :disabled="atEnd && state.summaryVisible"
        @click="emit('command', { type: 'next' })"
      >
        <svg v-if="atEnd" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 10 7-10 7z" /><path d="M19 5v14" /></svg>
        <span class="tooltip">{{ atEnd ? "Show results" : "Next song \u00B7 N" }}</span>
      </button>
      <button
        type="button"
        class="tbtn tbtn-icon tbtn-reveal"
        aria-label="Reveal"
        :disabled="state.phase === 'revealed'"
        @click="emit('command', { type: 'reveal' })"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
        <span class="tooltip">Reveal &middot; R</span>
      </button>
      <button type="button" class="tbtn tbtn-icon" aria-label="Skip to end" :disabled="skipSeconds === null" @click="skipToEnd">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 5 8 7-8 7z" /><path d="m11 5 8 7-8 7z" /><path d="M21 5v14" /></svg>
        <span class="tooltip">Skip to the last 3 seconds &middot; E</span>
      </button>
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
      <label class="np-toggle" data-palette-target="option-random-start">
        <input
          type="checkbox"
          :checked="state.randomStart"
          @change="emit('command', { type: 'settings', randomStart: ($event.target as HTMLInputElement).checked })"
        />
        Random start (from the next song)
      </label>
      <label class="np-toggle" data-palette-target="option-auto-advance">
        <input
          type="checkbox"
          :checked="state.autoAdvance"
          @change="emit('command', { type: 'autoAdvance', enabled: ($event.target as HTMLInputElement).checked })"
        />
        Go to the next song when one ends
      </label>
      <label class="np-toggle" data-palette-target="option-buzzer">
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
      <PartyAddToDeck v-if="current" :card-id="current.cardId" />
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

.np-stuck {
  display: grid;
  gap: 8px;
  padding: 10px 14px;
  border: 2px solid var(--accent-secondary);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}

.np-stuck-text,
.np-stuck-note {
  margin: 0;
  font-size: 14px;
}

.np-stuck-source,
.np-stuck-note {
  display: block;
  color: var(--muted);
  font-size: 13px;
}

.np-stuck-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
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

.tbtn-icon {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0;
}

/* Dim the button, not its tooltip: a disabled icon still says which key it is. */
.tbtn-icon:disabled {
  opacity: 1;
}

.tbtn-icon:disabled::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: var(--surface);
  opacity: 0.55;
  pointer-events: none;
}

.tbtn-icon svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tbtn-main svg {
  fill: currentColor;
}

.tbtn .tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

/* The last button sits at the card's edge, so its longer tooltip grows leftwards. */
.tbtn-icon:last-child .tooltip {
  left: auto;
  right: 0;
  transform: none;
}

.tbtn:hover .tooltip,
.tbtn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
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
</style>
