<script setup lang="ts">
import {
  frameStyle,
  movePlacement,
  PIECE_ANCHORS,
  categoryOf,
  PIECE_LABELS,
  type PartyPieceId,
  type PartyPlacement,
  resizePlacement,
} from "~/utils/partyLayout";

const props = defineProps<{ piece: PartyPieceId }>();

const { layout, editing, category, selected, place, save, isHidden } = usePartyLayout();
const hidden = computed(() => isHidden(props.piece));
// While arranging, only the chosen category is live; the rest stay put, dimmed.
const inactive = computed(() =>
  editing.value && (selected.value ? selected.value !== props.piece : categoryOf(props.piece) !== category.value),
);
const isSelected = computed(() => editing.value && selected.value === props.piece);
const anchor = computed(() => PIECE_ANCHORS[props.piece]);
const placement = computed(() => ({
  ...frameStyle(layout.value[props.piece], anchor.value),
  "--piece-scale": String(layout.value[props.piece].scale),
}));
// The resize handle sits on the corner away from the anchor, so pulling it
// always moves away from the point that stays put.
const handleCorner = computed(() => `${anchor.value.ay === 1 ? "top" : "bottom"}-${anchor.value.ax === 1 ? "left" : "right"}`);

const frame = ref<HTMLElement | null>(null);
let drag: {
  mode: "move" | "resize";
  pointerId: number;
  start: PartyPlacement;
  startX: number;
  startY: number;
  box: DOMRect;
} | null = null;

function begin(event: PointerEvent, mode: "move" | "resize") {
  const box = frame.value?.offsetParent?.getBoundingClientRect();
  if (!editing.value || inactive.value || !box || event.button !== 0) return;
  event.preventDefault();
  selected.value = props.piece;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag = { mode, pointerId: event.pointerId, start: layout.value[props.piece], startX: event.clientX, startY: event.clientY, box };
}

function onMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const { box, start } = drag;
  if (drag.mode === "move") {
    place(props.piece, movePlacement(start, (event.clientX - drag.startX) / box.width, (event.clientY - drag.startY) / box.height));
    return;
  }
  const anchorPx = { x: box.left + start.x * box.width, y: box.top + start.y * box.height };
  place(props.piece, resizePlacement(start, anchorPx, { x: drag.startX, y: drag.startY }, { x: event.clientX, y: event.clientY }));
}

function end(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag = null;
  save();
}
</script>

<template>
  <div
    v-if="editing || !hidden"
    ref="frame"
    class="layout-frame"
    :class="{ editing: editing && !inactive, inactive, selected: isSelected, ghost: editing && hidden }"
    :style="placement"
    @pointerdown="begin($event, 'move')"
    @pointermove="onMove"
    @pointerup="end"
    @pointercancel="end"
  >
    <slot />
    <template v-if="editing && !inactive">
      <span class="layout-label">{{ PIECE_LABELS[piece] }}<template v-if="hidden"> (hidden)</template></span>
      <span
        class="layout-handle"
        :class="handleCorner"
        :aria-label="`Resize ${PIECE_LABELS[piece]}`"
        @pointerdown.stop="begin($event, 'resize')"
      />
    </template>
  </div>
</template>

<style scoped>
.layout-frame {
  position: absolute;
  /* Sized by its piece, not squeezed by how close to the edge it sits. */
  width: max-content;
  pointer-events: none;
}

.layout-frame.editing {
  /* Above the buzz-in, banner and results layers while arranging. */
  z-index: calc(var(--z-chrome) - 1);
  pointer-events: auto;
  cursor: move;
  touch-action: none;
  outline: 3px dashed var(--accent);
  outline-offset: 4px;
  user-select: none;
}

.layout-frame.selected {
  z-index: var(--z-chrome);
  outline-style: solid;
}

.layout-frame.inactive {
  opacity: 0.35;
}

.layout-frame.ghost {
  opacity: 0.4;
}

.layout-label {
  position: absolute;
  /* Inside the piece, so a piece against the top edge keeps its label, and
     kept at its own size whatever the piece is scaled to. */
  top: 4px;
  left: 4px;
  z-index: 1;
  transform: scale(calc(1 / var(--piece-scale)));
  transform-origin: left top;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--bg);
  font-family: var(--font-display);
  font-size: 14px;
  white-space: nowrap;
}

.layout-handle {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 3px solid var(--bg);
  border-radius: 50%;
  background: var(--accent);
  transform: scale(calc(1 / var(--piece-scale)));
}

.layout-handle.bottom-right {
  right: -15px;
  bottom: -15px;
  cursor: nwse-resize;
}

.layout-handle.bottom-left {
  left: -15px;
  bottom: -15px;
  cursor: nesw-resize;
}

.layout-handle.top-right {
  right: -15px;
  top: -15px;
  cursor: nesw-resize;
}

.layout-handle.top-left {
  left: -15px;
  top: -15px;
  cursor: nwse-resize;
}
</style>
