<script setup lang="ts">
import { CHOICE_STYLES, PIECE_CATEGORIES, PIECE_LABELS } from "~/utils/partyLayout";

const emit = defineEmits<{ done: [] }>();

const { reset, snap, category, selected, settings, isHidden, setHidden, setChoiceStyle } = usePartyLayout();

function pickCategory(id: (typeof PIECE_CATEGORIES)[number]["id"]) {
  category.value = id;
  selected.value = null;
}
// Dragged by its handle so it can be moved off whatever it covers. The offset
// is from its default spot and outlives leaving and re-entering arrange mode.
const offset = useState("partyToolbarOffset", () => ({ x: 0, y: 0 }));
const bar = ref<HTMLElement | null>(null);
let grab: { pointerId: number; startX: number; startY: number; from: { x: number; y: number } } | null = null;

function startGrab(event: PointerEvent) {
  if (event.button !== 0) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  grab = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, from: { ...offset.value } };
}

function moveGrab(event: PointerEvent) {
  if (!grab || event.pointerId !== grab.pointerId) return;
  const box = bar.value?.getBoundingClientRect();
  let x = grab.from.x + event.clientX - grab.startX;
  let y = grab.from.y + event.clientY - grab.startY;
  if (box) {
    // Keep the handle reachable: the bar may not leave the window.
    const dx = x - offset.value.x;
    const dy = y - offset.value.y;
    x = offset.value.x + Math.min(Math.max(dx, -box.left), window.innerWidth - box.right);
    y = offset.value.y + Math.min(Math.max(dy, -box.top), window.innerHeight - box.bottom);
  }
  offset.value = { x, y };
}

function endGrab(event: PointerEvent) {
  if (grab && event.pointerId === grab.pointerId) grab = null;
}

const active = computed(() => PIECE_CATEGORIES.find((entry) => entry.id === category.value) ?? PIECE_CATEGORIES[0]);
</script>

<template>
  <div
    ref="bar"
    class="layout-toolbar"
    role="toolbar"
    aria-label="Arrange the screen"
    :style="{ '--bar-x': `${offset.x}px`, '--bar-y': `${offset.y}px` }"
  >
    <div
      class="layout-grip"
      title="Drag to move this bar (double-click to put it back)"
      @pointerdown="startGrab"
      @pointermove="moveGrab"
      @pointerup="endGrab"
      @pointercancel="endGrab"
      @dblclick="offset = { x: 0, y: 0 }"
    >
      Drag to move
    </div>
    <div class="layout-tabs" role="tablist" aria-label="What to arrange">
      <button
        v-for="entry in PIECE_CATEGORIES"
        :key="entry.id"
        type="button"
        role="tab"
        class="layout-tab"
        :class="{ active: entry.id === category }"
        :aria-selected="entry.id === category"
        @click="pickCategory(entry.id)"
      >
        {{ entry.label }}
      </button>
    </div>

    <div class="layout-shown" role="group" aria-label="Pieces shown on screen">
      <span v-for="piece in active.pieces" :key="piece" class="layout-check" :class="{ picked: selected === piece }">
        <input
          type="checkbox"
          :checked="!isHidden(piece)"
          :aria-label="`Show ${PIECE_LABELS[piece]}`"
          @change="setHidden(piece, !($event.target as HTMLInputElement).checked)"
        />
        <button type="button" class="layout-name" :aria-pressed="selected === piece" title="Edit just this piece" @click="selected = selected === piece ? null : piece">
          {{ PIECE_LABELS[piece] }}
        </button>
      </span>
    </div>

    <div v-if="category === 'choices'" class="layout-styles" role="radiogroup" aria-label="How the options are arranged">
      <button
        v-for="style in CHOICE_STYLES"
        :key="style.id"
        type="button"
        role="radio"
        class="layout-tab"
        :class="{ active: settings.choiceStyle === style.id }"
        :aria-checked="settings.choiceStyle === style.id"
        @click="setChoiceStyle(style.id)"
      >
        {{ style.label }}
      </button>
    </div>

    <p class="layout-toolbar-hint">
      Click a piece or its name to edit just that one (click empty space to go back). Drag to move (snaps to the grid, hold Alt to place freely), corner dot to resize, untick to hide.
    </p>
    <div class="layout-actions">
      <label class="layout-snap"><input v-model="snap" type="checkbox" /> Snap to grid</label>
      <button type="button" class="layout-toolbar-button" @click="reset">Reset layout</button>
      <button type="button" class="layout-toolbar-button primary" @click="selected = null; emit('done')">Done</button>
    </div>
  </div>
</template>

<style scoped>
.layout-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translate(calc(-50% + var(--bar-x, 0px)), var(--bar-y, 0px));
  z-index: var(--z-chrome);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 14px;
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 10px 14px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.layout-grip {
  flex-basis: 100%;
  margin: -4px 0 0;
  padding: 2px 0;
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.layout-grip:active {
  cursor: grabbing;
}

.layout-tabs,
.layout-shown,
.layout-styles,
.layout-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.layout-tab {
  padding: 4px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.layout-tab.active {
  border-color: var(--accent);
  color: var(--accent);
}

.layout-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
}

.layout-name {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.layout-check.picked .layout-name {
  color: var(--accent);
  text-decoration: underline;
}

.layout-snap {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.layout-toolbar-hint {
  margin: 0;
  flex-basis: 100%;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.layout-toolbar-button {
  flex-shrink: 0;
  padding: 6px 16px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.layout-toolbar-button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
</style>
