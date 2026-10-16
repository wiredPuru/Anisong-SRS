<script setup lang="ts">
import type { PartyEffects } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import { playedLogCsv } from "~/utils/partyLogExport";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ jump: [index: number]; command: [command: PartyHostCommand] }>();

// Only songs still to come can move or go; the current one moves on with Next.
const isUpcoming = (index: number) => index > props.state.index;

// One scroll box holds the whole queue. Rows render in chunks around the
// current song and grow as the host scrolls, so a 2000-song queue stays fast.
// An endless queue shows only the one before, the current one and the next,
// plus any song the host added by hand.
const CHUNK = 20;
const endless = computed(() => props.state.endless !== null);
const from = ref(0);
const to = ref(0);
const listEl = ref<HTMLElement | null>(null);

function resetRange() {
  from.value = Math.max(0, props.state.index - CHUNK);
  to.value = Math.min(props.state.queue.length, props.state.index + CHUNK);
}
resetRange();

const rows = computed(() => {
  const queue = props.state.queue;
  if (endless.value) {
    const start = Math.max(0, props.state.index - 1);
    const end = Math.min(queue.length, props.state.index + 2);
    const shown = queue.slice(start, end).map((item, offset) => ({ item, index: start + offset }));
    const added = queue.map((item, index) => ({ item, index })).filter(({ item, index }) => index >= end && item.manual);
    return [...shown, ...added];
  }
  const end = Math.max(to.value, Math.min(queue.length, from.value));
  return queue.slice(from.value, end).map((item, offset) => ({ item, index: from.value + offset }));
});

function scrollToCurrent() {
  const list = listEl.value;
  const row = list?.querySelector<HTMLElement>('[aria-current="true"]')?.closest<HTMLElement>(".queue-row");
  if (list && row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - row.offsetHeight);
}

async function onScroll() {
  const list = listEl.value;
  if (!list || endless.value) return;
  if (list.scrollTop < 40 && from.value > 0) {
    const before = list.scrollHeight;
    from.value = Math.max(0, from.value - CHUNK);
    await nextTick();
    list.scrollTop += list.scrollHeight - before;
  } else if (list.scrollHeight - list.scrollTop - list.clientHeight < 40 && to.value < props.state.queue.length) {
    to.value = Math.min(props.state.queue.length, to.value + CHUNK);
  }
}

watch(
  () => props.state.index,
  async () => {
    if (props.state.index < from.value || props.state.index >= to.value) resetRange();
    await nextTick();
    scrollToCurrent();
  },
);
watch(() => props.state.queue.length, () => {
  if (to.value > props.state.queue.length) to.value = props.state.queue.length;
});
onMounted(() => nextTick(scrollToCurrent));

// Clicking a song opens its menu; it never plays on its own.
const openIndex = ref<number | null>(null);
function toggleMenu(index: number) {
  openIndex.value = openIndex.value === index ? null : index;
}
const editCardId = ref<number | null>(null);

function playNow(index: number) {
  openIndex.value = null;
  emit("jump", index);
}

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

const upNext = computed(() => {
  const index = props.state.index + 1;
  const item = props.state.queue[index];
  return item ? { index, item } : null;
});

const armed = computed(() => props.state.nextEffects);

function armNext(effects: PartyEffects | null) {
  emit("command", { type: "effects", target: "next", effects });
}

function setSongEffects(index: number, effects: PartyEffects | null) {
  emit("command", { type: "queueEffects", index, effects });
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
      <button v-if="finished.length" type="button" class="reroll-btn" @click="exportLog">Export played CSV</button>
      <button v-if="state.queue.length - state.index > 2" type="button" class="reroll-btn" title="Shuffle the songs still to come" @click="emit('command', { type: 'queueShuffle' })">
        &#8644; Shuffle upcoming
      </button>
    </div>
    <div v-if="upNext" class="up-next">
      <span class="up-next-text">
        <span class="up-next-label">Up next</span>
        <PartyMainAppLink
          class="up-next-title"
          :path="animeCardsSearchPath(upNext.item.answer.animeTitleRomaji)"
          :label="upNext.item.answer.animeTitleEnglish"
        >{{ upNext.item.answer.animeTitleEnglish }}</PartyMainAppLink>
        <span class="up-next-song">{{ upNext.item.answer.songTitle }} &middot; {{ formatThemeSlotLabel(upNext.item.answer.themeSlot) }}</span>
      </span>
      <button type="button" class="reroll-btn" @click="emit('command', { type: 'queueReroll', index: upNext.index })">
        &#8635; Reroll
      </button>
      <PartyEffectToggles :effects="armed" label="Effects for the next song" @change="armNext" />
    </div>
    <ol ref="listEl" class="queue-list" @scroll.passive="onScroll">
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
          :aria-expanded="openIndex === index"
          @click="toggleMenu(index)"
        >
          <span class="queue-num">{{ index + 1 }}</span>
          <span class="queue-text">
            <span class="queue-anime">{{ item.answer.animeTitleEnglish }}</span>
            <span class="queue-song">{{ item.answer.songTitle }} · {{ formatThemeSlotLabel(item.answer.themeSlot) }}</span>
          </span>
        </button>
        <PartyMainAppLink :path="animeCardsSearchPath(item.answer.animeTitleRomaji)" :label="item.answer.animeTitleEnglish" />
        <span v-if="isUpcoming(index)" class="queue-edit">
          <button
            type="button"
            class="qbtn qbtn-remove"
            :aria-label="`Remove ${item.answer.animeTitleEnglish} from the queue`"
            @click="emit('command', { type: 'queueRemove', index })"
          >
            &#10005;
          </button>
        </span>
        <div v-if="openIndex === index" class="queue-menu">
          <button type="button" class="reroll-btn" @click="playNow(index)">&#9654; Play now</button>
          <button v-if="isUpcoming(index)" type="button" class="reroll-btn" @click="emit('command', { type: 'queueReroll', index })">&#8635; Reroll</button>
          <button v-if="item.cardId > 0" type="button" class="reroll-btn" @click="editCardId = item.cardId">&#9998; Edit card</button>
          <PartyEffectToggles v-if="isUpcoming(index)" :effects="item.effects" label="Effects for this song" @change="setSongEffects(index, $event)" />
        </div>
      </li>
    </ol>
  <PartyCardEditModal v-if="editCardId !== null" :card-id="editCardId" @close="editCardId = null" />
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
  max-height: 290px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}










.queue-row {
  display: flex;
  flex-wrap: wrap;
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
.queue-menu {
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 14px 10px;
}
</style>
