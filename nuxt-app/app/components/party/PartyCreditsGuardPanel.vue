<script setup lang="ts">
import type { PartyCensorBox } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import { pointIn } from "~/utils/partyCensorBoxes";
import { dragGuardBox, type GuardDrag } from "~/utils/partyGuardBox";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const DEFAULT_BOX: PartyCensorBox = { x: 0.02, y: 0.76, w: 0.5, h: 0.2 };

const stage = ref<HTMLElement | null>(null);
const drag = ref<(GuardDrag & { pointerId: number }) | null>(null);
const draft = ref<PartyCensorBox | null>(null);
const box = computed(() => draft.value ?? props.state.creditsGuard.box);

function send(change: Partial<PartyHostState["creditsGuard"]>) {
  emit("command", { type: "creditsGuard", guard: { ...props.state.creditsGuard, ...change } });
}

function startDrag(event: PointerEvent, mode: GuardDrag["mode"]) {
  if (event.button !== 0 || !stage.value) return;
  const point = pointIn(stage.value.getBoundingClientRect(), event.clientX, event.clientY);
  drag.value = { mode, startX: point.x, startY: point.y, original: { ...box.value }, pointerId: event.pointerId };
  stage.value.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onMove(event: PointerEvent) {
  if (!drag.value || !stage.value) return;
  const point = pointIn(stage.value.getBoundingClientRect(), event.clientX, event.clientY);
  draft.value = dragGuardBox(drag.value, point.x, point.y);
}

function endDrag() {
  if (!drag.value) return;
  drag.value = null;
  if (draft.value) send({ box: draft.value });
  draft.value = null;
}
</script>

<template>
  <div class="guard">
    <h3 class="guard-title">Credits guard</h3>
    <p class="guard-hint">Hides this box on every video, so burned-in title cards never show. Stays on at the reveal.</p>
    <div class="guard-row">
      <label class="guard-toggle">
        <input type="checkbox" :checked="state.creditsGuard.enabled" @change="send({ enabled: ($event.target as HTMLInputElement).checked })" />
        Hide credits box
      </label>
      <label class="guard-toggle">
        Style
        <select :value="state.creditsGuard.style" @change="send({ style: ($event.target as HTMLSelectElement).value as 'blur' | 'black' })">
          <option value="black">Black</option>
          <option value="blur">Blur</option>
        </select>
      </label>
      <button type="button" class="guard-reset" @click="send({ box: { ...DEFAULT_BOX } })">Reset position</button>
    </div>
    <div ref="stage" class="guard-stage" @pointermove="onMove" @pointerup="endDrag" @pointercancel="endDrag">
      <span class="guard-label">Drag the box over the credits. Drag the corner to resize.</span>
      <div
        class="guard-box"
        :class="{ off: !state.creditsGuard.enabled }"
        :style="{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }"
        @pointerdown="startDrag($event, 'move')"
      >
        <span class="guard-handle" @pointerdown.stop="startDrag($event, 'resize')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.guard {
  display: grid;
  gap: 0.6rem;
  margin-top: 1rem;
}

.guard-title {
  margin: 0;
  font-size: 1rem;
}

.guard-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.guard-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.guard-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.guard-reset {
  margin-left: auto;
}

.guard-stage {
  position: relative;
  aspect-ratio: 16 / 9;
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  overflow: hidden;
  touch-action: none;
  user-select: none;
}

.guard-label {
  position: absolute;
  inset: 0.5rem auto auto 0.5rem;
  color: var(--faint);
  font-size: 0.75rem;
  pointer-events: none;
}

.guard-box {
  position: absolute;
  border: 2px solid var(--accent);
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--accent) 35%, transparent);
  cursor: move;
}

.guard-box.off {
  border-style: dashed;
  background: transparent;
}

.guard-handle {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 3px;
  background: var(--accent);
  cursor: nwse-resize;
}
</style>
