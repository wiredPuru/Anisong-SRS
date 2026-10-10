<script setup lang="ts">
import type { PartyCensor, PartyCensorBox } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import { boxFromDrag, CENSOR_MAX_BOXES, censorAt, FULL_FRAME, moveBox, pointIn, resizeBox, type Point } from "~/utils/partyCensorBoxes";
import { parsePreviewLead, PREVIEW_LEADS, previewNeedsSeek, previewTarget } from "~/utils/partyPreview";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const LEAD_KEY = "gaqSrs:partyPreviewLead";
const SYNC_MS = 250;
const LIVE_SEND_MS = 100;

const token = computed(() => props.state.currentToken);
const kind = computed(() => props.state.queue[props.state.index]?.kind ?? "video");
const clipSrc = computed(() => (token.value ? `/api/party/host/clip?t=${encodeURIComponent(token.value)}` : undefined));

const lead = ref(2);
function setLead(value: number) {
  lead.value = value;
  try {
    localStorage.setItem(LEAD_KEY, String(value));
  } catch {
    // Not remembered in a private window; the preview still works.
  }
}

// The preview follows the display's reported time, run ahead by the lead,
// so the host sees a moment coming before the room does.
const video = ref<HTMLVideoElement | null>(null);
const aspect = ref(16 / 9);
const previewTime = ref(0);
let receivedAt = Date.now();
watch(() => props.state.position, () => {
  receivedAt = Date.now();
});

function sync() {
  const element = video.value;
  const position = props.state.position;
  if (!element || element.readyState < HTMLMediaElement.HAVE_METADATA) return;
  if (!position || position.token !== token.value) {
    if (!element.paused) element.pause();
    return;
  }
  const target = previewTarget(position, receivedAt, Date.now(), lead.value);
  if (previewNeedsSeek(element.currentTime, target)) element.currentTime = target;
  if (position.playing && element.paused) void element.play().catch(() => {});
  else if (!position.playing && !element.paused) element.pause();
  previewTime.value = element.currentTime;
}

function onLoadedMetadata() {
  const element = video.value;
  if (element?.videoWidth && element.videoHeight) aspect.value = element.videoWidth / element.videoHeight;
  sync();
}

// Local copy of the boxes, so a drag stays smooth. Every change goes straight
// to the display: there is no draft step.
const boxes = ref<PartyCensorBox[]>([]);
const style = computed(() => props.state.censorStyle);
const muted = ref(false);
const live = computed(() => props.state.censor !== null);
// A remembered censor plays back on its own until the host changes anything.
const replaying = computed(() => !props.state.censorTouched && props.state.censorTrack.length > 0);
const replayCensor = computed(() => (replaying.value ? censorAt(props.state.censorTrack, previewTime.value) : null));
const shownBoxes = computed(() => (replaying.value ? replayCensor.value?.boxes ?? [] : boxes.value));

// The box last clicked; D deletes it, or every box when none is picked.
const selected = ref<number | null>(null);

watch(token, () => {
  boxes.value = [];
  muted.value = false;
  selected.value = null;
});

type Drag =
  | { mode: "draw"; start: Point; current: Point }
  | { mode: "move" | "resize"; index: number; start: Point; original: PartyCensorBox };
const drag = ref<Drag | null>(null);
const stage = ref<HTMLElement | null>(null);

// The server's copy wins unless the host is mid-drag, which would fight it.
watch(() => props.state.censor, (censor) => {
  if (drag.value) return;
  boxes.value = censor?.boxes.map((box) => ({ ...box })) ?? [];
  muted.value = censor?.muted ?? false;
}, { immediate: true });

// Editing a replayed box starts from what is on screen.
function takeOverReplay() {
  if (!replaying.value) return;
  boxes.value = replayCensor.value?.boxes.map((box) => ({ ...box })) ?? [];
  muted.value = replayCensor.value?.muted ?? false;
}

function previewAt(): number | undefined {
  const element = video.value;
  return element && element.readyState >= HTMLMediaElement.HAVE_METADATA ? element.currentTime : undefined;
}

function censorBody(): PartyCensor {
  return { boxes: boxes.value.map((box) => ({ ...box })), style: style.value, muted: muted.value };
}

// No boxes and no mute is sent as it is; the server reads that as no censor.
let liveTimer: ReturnType<typeof setTimeout> | null = null;
function sendLive() {
  if (liveTimer) return;
  liveTimer = setTimeout(() => {
    liveTimer = null;
    emit("command", { type: "censor", censor: censorBody(), at: previewAt() });
  }, LIVE_SEND_MS);
}

function censorWholeScreen() {
  boxes.value = [{ ...FULL_FRAME }];
  sendLive();
}

function lift() {
  boxes.value = [];
  muted.value = false;
  emit("command", { type: "censor", censor: null, at: previewAt() });
}

function setRecording(recording: boolean) {
  takeOverReplay();
  emit("command", { type: "censorRecord", recording });
}

function forget() {
  emit("command", { type: "censorForget" });
}

function setStyle(next: PartyCensor["style"]) {
  emit("command", { type: "censorStyle", style: next });
}

function toggleMuted() {
  takeOverReplay();
  muted.value = !muted.value;
  sendLive();
}

function removeBox(index: number) {
  takeOverReplay();
  boxes.value = boxes.value.filter((_, i) => i !== index);
  selected.value = null;
  sendLive();
}

function deleteSelectedOrAll() {
  takeOverReplay();
  const index = selected.value;
  if (index !== null && index < boxes.value.length) {
    removeBox(index);
    return;
  }
  if (!boxes.value.length) return;
  boxes.value = [];
  selected.value = null;
  sendLive();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !["checkbox", "radio", "range", "button"].includes(target.type);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key.toLowerCase() !== "d" || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
  event.preventDefault();
  deleteSelectedOrAll();
}

function pointer(event: PointerEvent): Point {
  return pointIn(stage.value!.getBoundingClientRect(), event.clientX, event.clientY);
}

function startDrag(event: PointerEvent, mode: "draw" | "move" | "resize", index = -1) {
  if (event.button !== 0 || !stage.value) return;
  takeOverReplay();
  const start = pointer(event);
  if (mode === "draw") {
    selected.value = null;
    if (boxes.value.length >= CENSOR_MAX_BOXES) return;
    drag.value = { mode, start, current: start };
  } else {
    selected.value = index;
    drag.value = { mode, index, start, original: { ...boxes.value[index]! } };
  }
  stage.value.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event: PointerEvent) {
  const current = drag.value;
  if (!current) return;
  const point = pointer(event);
  if (current.mode === "draw") {
    drag.value = { ...current, current: point };
    return;
  }
  const dx = point.x - current.start.x;
  const dy = point.y - current.start.y;
  const next = current.mode === "move" ? moveBox(current.original, dx, dy) : resizeBox(current.original, dx, dy);
  boxes.value = boxes.value.map((box, i) => (i === current.index ? next : box));
  sendLive();
}

function endDrag() {
  const current = drag.value;
  drag.value = null;
  if (current?.mode !== "draw") return;
  const box = boxFromDrag(current.start, current.current);
  if (!box) return;
  boxes.value = [...boxes.value, box];
  selected.value = boxes.value.length - 1;
  sendLive();
}

const drawing = computed(() => (drag.value?.mode === "draw" ? boxFromDrag(drag.value.start, drag.value.current) : null));
const boxStyle = (box: PartyCensorBox) => ({
  left: `${box.x * 100}%`,
  top: `${box.y * 100}%`,
  width: `${box.w * 100}%`,
  height: `${box.h * 100}%`,
});

let syncTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
onMounted(() => {
  try {
    lead.value = parsePreviewLead(localStorage.getItem(LEAD_KEY));
  } catch {
    // Storage blocked: keep the default lead.
  }
  syncTimer = setInterval(sync, SYNC_MS);
});
onBeforeUnmount(() => {
  if (syncTimer) clearInterval(syncTimer);
  if (liveTimer) clearTimeout(liveTimer);
});
</script>

<template>
  <div class="censor-panel">
    <div class="censor-head">
      <h2 class="panel-title">Preview</h2>
      <span v-if="live" class="live-chip">Censoring</span>
      <span v-else-if="replaying" class="live-chip saved-chip">Saved censor</span>
      <span class="head-spacer" />
      <label class="lead">
        <span>Ahead by</span>
        <select :value="lead" @change="setLead(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="value in PREVIEW_LEADS" :key="value" :value="value">{{ value }}s</option>
        </select>
      </label>
    </div>

    <div class="stage-wrap">
      <div
        ref="stage"
        class="stage"
        :class="{ live }"
        :style="{ '--clip-aspect': aspect }"
        @pointerdown.self="startDrag($event, 'draw')"
        @pointermove="onPointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <video
          v-if="kind === 'video'"
          ref="video"
          class="preview-video"
          :src="clipSrc"
          muted
          playsinline
          preload="auto"
          @loadedmetadata="onLoadedMetadata"
        />
        <p v-else class="stage-note">Audio only. Mute still works.</p>
        <div
          v-for="(box, i) in shownBoxes"
          :key="i"
          class="box"
          :class="[`box-${replaying ? replayCensor?.style ?? style : style}`, { selected: !replaying && selected === i }]"
          :style="boxStyle(box)"
          @pointerdown.stop="startDrag($event, 'move', i)"
        >
          <button type="button" class="box-remove" aria-label="Remove box" @pointerdown.stop @click="removeBox(i)">×</button>
          <span class="box-handle" aria-hidden="true" @pointerdown.stop="startDrag($event, 'resize', i)" />
        </div>
        <div v-if="drawing" class="box draft drawing" :style="boxStyle(drawing)" />
      </div>
    </div>

    <div class="censor-controls">
      <button type="button" class="censor-btn" @click="censorWholeScreen">Censor whole screen</button>
      <button v-if="live || replaying" type="button" class="censor-btn lift" @click="lift">Lift censor</button>
      <div class="seg" role="group" aria-label="Censor style">
        <button type="button" :class="{ on: style === 'black' }" @click="setStyle('black')">Black</button>
        <button type="button" :class="{ on: style === 'blur' }" @click="setStyle('blur')">Blur</button>
      </div>
      <button type="button" class="pill" :class="{ on: replaying ? replayCensor?.muted : muted }" :aria-pressed="replaying ? Boolean(replayCensor?.muted) : muted" @click="toggleMuted">Mute</button>
      <button v-if="!state.censorRecording" type="button" class="censor-btn" @click="setRecording(true)">
        {{ state.censorRemember ? "Re-record for next time" : "Record for next time" }}
      </button>
      <button v-else type="button" class="censor-btn lift" @click="setRecording(false)">Stop recording</button>
      <button v-if="state.censorRemember || state.censorTrack.length" type="button" class="censor-btn" @click="forget">Forget saved censor</button>
      <span v-if="state.censorRecording" class="live-chip">Recording</span>
    </div>
    <p class="censor-hint">
      Drag on the preview to censor that spot on the screen. C censors the whole screen. D deletes the box you picked, or all of them.
      Press Record, censor as the song plays, then Stop: the timings replay on their own next time. Forget wipes them to start over.
    </p>
  </div>
</template>

<style scoped>
.censor-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.censor-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.head-spacer {
  flex: 1;
}

.live-chip {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--fail);
  color: var(--fail-ink);
  font-size: 12px;
  font-weight: 700;
}

.lead {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.lead select {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
}

.stage-wrap {
  display: flex;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}

.stage {
  position: relative;
  width: min(100%, calc(var(--preview-height, 26vh) * var(--clip-aspect)));
  aspect-ratio: var(--clip-aspect);
  overflow: hidden;
  border-radius: var(--radius-sm);
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}

.preview-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.stage-note {
  position: absolute;
  inset: 0;
  margin: 0;
  display: grid;
  place-items: center;
  color: var(--muted);
  pointer-events: none;
}

.box {
  position: absolute;
  border-radius: 6px;
  cursor: move;
}

/* Kept slightly see-through on the host side, so a box can still be lined
   up with what it covers. */
.box-black {
  background: var(--censor-fill);
  opacity: 0.85;
}

.box-blur {
  background: var(--censor-tint);
  backdrop-filter: blur(10px) saturate(0.6);
}

.box.draft {
  border: 2px dashed var(--accent);
  opacity: 0.6;
}

.box.drawing {
  background: var(--censor-tint);
  pointer-events: none;
}

.stage.live .box {
  outline: 2px solid var(--fail);
}

.box.selected {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.box-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--surface-float);
  color: var(--text);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.box-handle {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--accent);
  cursor: nwse-resize;
}

.censor-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.censor-btn {
  padding: 9px 18px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--fail);
  color: var(--fail-ink);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.censor-btn.lift {
  background: var(--surface-raised);
  color: var(--text);
  border: 1px solid var(--border);
}

.seg {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
}

.seg button,
.pill {
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.pill {
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
}

.seg button.on,
.pill.on {
  background: var(--accent);
  color: var(--accent-ink);
}

.saved-chip {
  background: var(--accent-secondary);
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.censor-hint {
  margin: 0;
  font-size: 13px;
  color: var(--faint);
}
</style>
