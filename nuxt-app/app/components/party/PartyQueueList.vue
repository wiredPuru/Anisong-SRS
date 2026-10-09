<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ jump: [index: number]; command: [command: PartyHostCommand] }>();

// Only songs still to come can move or go; the current one moves on with Next.
const isUpcoming = (index: number) => index > props.state.index;

// The board only ever shows five songs: the one before, the current one, the
// next, and two more. Older songs sit in the played log, the rest wait unseen.
const WINDOW_SIZE = 5;
const windowStart = computed(() => Math.max(0, props.state.index - 1));
const windowEnd = computed(() => Math.min(props.state.queue.length, windowStart.value + WINDOW_SIZE));
const rows = computed(() =>
  props.state.queue.slice(windowStart.value, windowEnd.value).map((item, offset) => ({ item, index: windowStart.value + offset })),
);
const played = computed(() =>
  props.state.queue.slice(0, windowStart.value).map((item, index) => ({ item, index })).reverse(),
);
const waiting = computed(() => props.state.queue.length - windowEnd.value);

const upNext = computed(() => {
  const index = props.state.index + 1;
  const item = props.state.queue[index];
  return item ? { index, item } : null;
});

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
    <h2 id="queue-title" class="queue-title">Queue</h2>
    <div v-if="upNext" class="up-next">
      <span class="up-next-text">
        <span class="up-next-label">Up next</span>
        <span class="up-next-title">{{ upNext.item.answer.animeTitleEnglish }}</span>
        <span class="up-next-song">{{ upNext.item.answer.songTitle }} &middot; {{ formatThemeSlotLabel(upNext.item.answer.themeSlot) }}</span>
      </span>
      <button type="button" class="reroll-btn" @click="emit('command', { type: 'queueReroll', index: upNext.index })">
        &#8635; Pick another
      </button>
    </div>
    <details v-if="played.length" class="played-log">
      <summary>Played ({{ played.length }})</summary>
      <ol class="played-list">
        <li v-for="entry in played" :key="`${entry.index}-${entry.item.cardId}`">
          <button type="button" class="played-item" @click="emit('jump', entry.index)">
            <span class="queue-num">{{ entry.index + 1 }}</span>
            {{ entry.item.answer.animeTitleEnglish }} &middot; {{ entry.item.answer.songTitle }}
          </button>
        </li>
      </ol>
    </details>
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

.played-log summary {
  cursor: pointer;
  color: var(--muted);
  font-weight: 700;
}

.played-list {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  max-height: 220px;
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
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
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
