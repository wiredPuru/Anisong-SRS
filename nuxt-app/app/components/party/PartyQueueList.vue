<script setup lang="ts">
import type { PartyEffects } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import { playedLogCsv } from "~/utils/partyLogExport";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ jump: [index: number]; command: [command: PartyHostCommand] }>();

// Only songs still to come can move or go; the current one moves on with Next.
const isUpcoming = (index: number) => index > props.state.index;

// The board only ever shows five songs: the one before, the current one, the
// next, and two more. Finished songs sit in the played log, the rest wait unseen.
// An endless queue shows only the one before, the current one and the next,
// plus any song the host added by hand.
const WINDOW_SIZE = 5;
const endless = computed(() => props.state.endless !== null);
const windowStart = computed(() => Math.max(0, props.state.index - 1));
const windowEnd = computed(() =>
  Math.min(props.state.queue.length, endless.value ? props.state.index + 2 : windowStart.value + WINDOW_SIZE),
);
const rows = computed(() => {
  const shown = props.state.queue.slice(windowStart.value, windowEnd.value).map((item, offset) => ({ item, index: windowStart.value + offset }));
  if (!endless.value) return shown;
  const added = props.state.queue
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => index >= windowEnd.value && item.manual);
  return [...shown, ...added];
});
const logOpen = ref(false);
const finishedRows = computed(() => finished.value.map((item, index) => ({ item, index })).reverse());
// Everything finished so far, oldest first; the current song counts once revealed.
const finished = computed(() => props.state.queue.slice(0, props.state.index + (props.state.phase === "revealed" ? 1 : 0)));

function exportLog() {
  const url = URL.createObjectURL(new Blob(["\uFEFF", playedLogCsv(finished.value)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gaq-party-played-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
const waiting = computed(() => (endless.value ? 0 : props.state.queue.length - windowEnd.value));

const upNext = computed(() => {
  const index = props.state.index + 1;
  const item = props.state.queue[index];
  return item ? { index, item } : null;
});

// One-tap presets for the next song, armed the same way as Effects > Next song.
const NO_EFFECTS: PartyEffects = { blur: 0, pixelate: 0, decay: false, decaySeconds: 20, muted: false, picture: "video" };
const FULL_BLUR = 40;
const armed = computed(() => props.state.nextEffects);
const QUICK = [
  { id: "blur", label: "Full blur", on: (e: PartyEffects) => e.blur >= FULL_BLUR, toggle: (e: PartyEffects, on: boolean) => ({ ...e, blur: on ? 0 : FULL_BLUR }) },
  { id: "pixelate", label: "Pixelate", on: (e: PartyEffects) => e.pixelate > 0, toggle: (e: PartyEffects, on: boolean) => ({ ...e, pixelate: on ? 0 : 32 }) },
  { id: "muted", label: "Mute", on: (e: PartyEffects) => e.muted, toggle: (e: PartyEffects, on: boolean) => ({ ...e, muted: !on }) },
  { id: "music", label: "Music player", on: (e: PartyEffects) => e.picture === "music", toggle: (e: PartyEffects, on: boolean) => ({ ...e, picture: on ? "video" : "music" }) },
  { id: "bubbles", label: "Bubbles", on: (e: PartyEffects) => e.picture === "bubbles", toggle: (e: PartyEffects, on: boolean) => ({ ...e, picture: on ? "video" : "bubbles" }) },
] as const satisfies readonly { id: string; label: string; on: (e: PartyEffects) => boolean; toggle: (e: PartyEffects, on: boolean) => PartyEffects }[];

function toggleQuick(option: (typeof QUICK)[number]) {
  const base = armed.value ?? NO_EFFECTS;
  const effects = option.toggle(base, option.on(base));
  const plain = JSON.stringify(effects) === JSON.stringify(NO_EFFECTS);
  emit("command", { type: "effects", target: "next", effects: plain ? null : effects });
}

// Drag a song still to come onto another upcoming row to put it there.
const dragFrom = ref<number | null>(null);
const dragOver = ref<number | null>(null);

function onDragStart(event: DragEvent, index: number) {
  dragFrom.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function onDragOver(event: DragEvent, index: number) {
  if (dragFrom.value === null || !isUpcoming(index)) return;
  event.preventDefault();
  dragOver.value = index;
}

function onDrop(event: DragEvent, index: number) {
  event.preventDefault();
  const from = dragFrom.value;
  endDrag();
  if (from !== null && from !== index && isUpcoming(index)) emit("command", { type: "queueMove", from, to: index });
}

function endDrag() {
  dragFrom.value = null;
  dragOver.value = null;
}

</script>

<template>
  <section class="queue" aria-labelledby="queue-title">
    <div class="queue-head">
      <h2 id="queue-title" class="queue-title">Queue</h2>
      <button v-if="state.queue.length - state.index > 2" type="button" class="reroll-btn" title="Shuffle the songs still to come" @click="emit('command', { type: 'queueShuffle' })">
        &#8644; Shuffle upcoming
      </button>
    </div>
    <div v-if="upNext" class="up-next">
      <span class="up-next-text">
        <span class="up-next-label">Up next</span>
        <span class="up-next-title">{{ upNext.item.answer.animeTitleEnglish }}</span>
        <span class="up-next-song">{{ upNext.item.answer.songTitle }} &middot; {{ formatThemeSlotLabel(upNext.item.answer.themeSlot) }}</span>
      </span>
      <button type="button" class="reroll-btn" @click="emit('command', { type: 'queueReroll', index: upNext.index })">
        &#8635; Pick another
      </button>
      <div class="up-next-fx" role="group" aria-label="Effects for the next song">
        <button
          v-for="option in QUICK"
          :key="option.id"
          type="button"
          class="fx-chip"
          :class="{ on: armed && option.on(armed) }"
          :aria-pressed="Boolean(armed && option.on(armed))"
          @click="toggleQuick(option)"
        >
          {{ option.label }}
        </button>
        <button v-if="armed" type="button" class="fx-chip fx-clear" @click="emit('command', { type: 'effects', target: 'next', effects: null })">Clear</button>
      </div>
    </div>
    <div v-if="finished.length" class="played-log">
      <div class="played-head">
        <button type="button" class="played-toggle" :aria-expanded="logOpen" @click="logOpen = !logOpen">
          <span class="played-chevron" :class="{ open: logOpen }" aria-hidden="true">&#9656;</span>
          Played ({{ finished.length }})
        </button>
        <button type="button" class="played-export" @click="exportLog">Export CSV</button>
      </div>
      <ol v-if="logOpen" class="played-list">
        <li v-for="entry in finishedRows" :key="`${entry.index}-${entry.item.cardId}`">
          <button type="button" class="played-item" @click="emit('jump', entry.index)">
            <span class="queue-num">{{ entry.index + 1 }}</span>
            {{ entry.item.answer.animeTitleEnglish }} &middot; {{ entry.item.answer.songTitle }}
          </button>
        </li>
      </ol>
    </div>
    <ol class="queue-list">
      <li
        v-for="{ item, index } in rows"
        :key="`${index}-${item.cardId}`"
        class="queue-row"
        :class="{
          'is-dragging': dragFrom === index,
          'drop-above': dragOver === index && dragFrom !== null && dragFrom > index,
          'drop-below': dragOver === index && dragFrom !== null && dragFrom < index,
        }"
        :draggable="isUpcoming(index)"
        @dragstart="isUpcoming(index) && onDragStart($event, index)"
        @dragover="onDragOver($event, index)"
        @drop="onDrop($event, index)"
        @dragend="endDrag"
      >
        <span v-if="isUpcoming(index)" class="queue-grip" aria-hidden="true" title="Drag to reorder">&#8942;&#8942;</span>
        <button
          type="button"
          class="queue-item"
          :class="{ 'is-current': index === state.index, 'is-done': index < state.index }"
          :aria-current="index === state.index ? 'true' : undefined"
          @click="emit('jump', index)"
        >
          <span class="queue-num">{{ index + 1 }}</span>
          <span class="queue-text">
            <span class="queue-anime">{{ item.answer.animeTitleEnglish }}</span>
            <span class="queue-song">{{ item.answer.songTitle }} · {{ formatThemeSlotLabel(item.answer.themeSlot) }}</span>
          </span>
        </button>
        <span v-if="isUpcoming(index)" class="queue-edit">
          <button
            type="button"
            class="qbtn"
            :disabled="index <= state.index + 1"
            :aria-label="`Move ${item.answer.animeTitleEnglish} up`"
            @click="emit('command', { type: 'queueMove', from: index, to: index - 1 })"
          >
            &#8593;
          </button>
          <button
            type="button"
            class="qbtn"
            :disabled="index >= state.queue.length - 1"
            :aria-label="`Move ${item.answer.animeTitleEnglish} down`"
            @click="emit('command', { type: 'queueMove', from: index, to: index + 1 })"
          >
            &#8595;
          </button>
          <button
            type="button"
            class="qbtn"
            :aria-label="`Pick a different song instead of ${item.answer.animeTitleEnglish}`"
            title="Pick another song"
            @click="emit('command', { type: 'queueReroll', index })"
          >
            &#8635;
          </button>
          <button
            type="button"
            class="qbtn qbtn-remove"
            :aria-label="`Remove ${item.answer.animeTitleEnglish} from the queue`"
            @click="emit('command', { type: 'queueRemove', index })"
          >
            &#10005;
          </button>
        </span>
      </li>
    </ol>
    <p v-if="waiting > 0" class="queue-waiting">+ {{ waiting }} more song{{ waiting === 1 ? "" : "s" }} queued after these</p>
  </section>
</template>

<style scoped>
.queue {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.queue-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.queue-list {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.played-log {
  font-size: 13px;
}

.played-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.played-toggle,
.played-export {
  border: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.played-export {
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
}

.played-chevron {
  display: inline-block;
  transition: transform 0.15s;
}

.played-chevron.open {
  transform: rotate(90deg);
}

.played-list {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.played-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.queue-waiting {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.queue-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
}

.up-next {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.up-next-fx {
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fx-chip {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.fx-chip.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.fx-clear {
  border-style: dashed;
}

.up-next-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.up-next-label {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.up-next-title {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.up-next-song {
  color: var(--muted);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reroll-btn {
  flex: none;
  padding: 7px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.reroll-btn:hover {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.queue-row.is-dragging {
  opacity: 0.4;
}

.queue-row.drop-above {
  box-shadow: inset 0 3px 0 var(--accent);
}

.queue-row.drop-below {
  box-shadow: inset 0 -3px 0 var(--accent);
}

.queue-row[draggable="true"] {
  cursor: grab;
}

.queue-grip {
  display: grid;
  place-items: center;
  padding: 0 4px 0 10px;
  color: var(--faint);
  letter-spacing: -3px;
  user-select: none;
}

.queue-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}

.qbtn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}

.qbtn:disabled {
  opacity: 0.35;
  cursor: default;
}

.qbtn-remove {
  color: var(--fail);
}

.queue-item {
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
}

.queue-item.is-done {
  color: var(--faint);
}

.queue-item.is-current {
  background: var(--surface-raised);
  box-shadow: inset 4px 0 0 var(--accent);
}

.queue-num {
  min-width: 2ch;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.queue-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.queue-anime {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-song {
  font-size: 13px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
