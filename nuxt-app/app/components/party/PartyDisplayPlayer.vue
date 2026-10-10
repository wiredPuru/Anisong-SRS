<script setup lang="ts">
import type { PartyEffects, PartyHints, PartyLightningMode, PartyPositionReport } from "~/composables/usePartyDisplay";
import { assignPartyVideoSlots } from "~/utils/partyVideoSlots";

const props = defineProps<{
  token: string;
  upcoming: string[];
  kind: "video" | "audio";
  playing: boolean;
  startAt: number;
  seekTo: number | null;
  seekSeq: number;
  startFraction: number;
  effects: PartyEffects;
  revealed: boolean;
  volume: number;
  lightning: { mode: PartyLightningMode; guessSeconds: number; offset: number; hints: PartyHints } | null;
  ambient: boolean;
}>();

const emit = defineEmits<{ position: [report: PartyPositionReport] }>();

const REPORT_INTERVAL_MS = 1000;
// Study's random start never lands in a clip's last 15 seconds either.
const RANDOM_START_TAIL_S = 15;
// A blurred edge fades into the background; a slight zoom keeps it off screen.
const BLUR_ZOOM = 1.08;

// Safari grants audible playback to the element used in the start gesture.
// The three elements stay mounted while their assigned songs change.
const SLOT_COUNT = 3;
const UNLOCK_SRC = "/party-unlock.mp4";
const tokens = computed(() => props.token
  ? [props.token, ...props.upcoming.filter((token) => token !== props.token)].slice(0, SLOT_COUNT)
  : []);
const slots = ref<(string | null)[]>(Array(SLOT_COUNT).fill(null));
// Each element is sized to its own picture rather than letterboxed inside a
// full-screen box, so the ambient glow can fill the bars around it.
const aspects = ref<number[]>(Array(SLOT_COUNT).fill(16 / 9));
const elements: (HTMLVideoElement | null)[] = Array(SLOT_COUNT).fill(null);
const media = shallowRef<HTMLVideoElement | null>(null);
const cover = ref<HTMLImageElement | null>(null);
const failed = ref(false);
const coverFailed = ref(false);
const blocked = ref(false);
let playAttempt = 0;
// True only between the current clip's "playing" and its next stall or pause,
// so "asked to play" and "actually audible" can be told apart.
const audible = ref(false);
const loading = computed(() => props.playing && !audible.value && !failed.value && !blocked.value);
const clipSrc = (token: string) => `/api/party/display/clip?t=${encodeURIComponent(token)}`;
const coverSrc = computed(() => `/api/party/display/cover?t=${encodeURIComponent(props.token)}`);

// Seconds played since this song's own start position (random start included),
// which is what blur and pixelate decay against.
const startPosition = ref(0);
const elapsed = ref(0);

// A lightning mode owns the picture for its round; only the host's mute
// carries through. Cover mode sharpens from coarse blocks by the deadline.
const LIGHTNING_COVER_BLOCK = 64;
const fx = computed<PartyEffects>(() => {
  const round = props.lightning;
  if (!round) return props.effects;
  const base: PartyEffects = { blur: 0, pixelate: 0, decay: false, decaySeconds: round.guessSeconds, muted: props.effects.muted, picture: "video" };
  switch (round.mode) {
    case "cover":
      return { ...base, picture: "cover", pixelate: LIGHTNING_COVER_BLOCK, decay: true };
    case "blind":
    case "clues":
    case "tags":
    case "title":
      return { ...base, picture: "blackout" };
    default:
      return base;
  }
});

// A reveal shows the answer clean; the stored effects wait for the next song.
const active = computed(() => !props.revealed);
const picture = computed(() => (active.value ? fx.value.picture : "video"));
const showCover = computed(() => picture.value === "cover" && !coverFailed.value);
const showVeil = computed(() => {
  if (showCover.value) return false;
  return picture.value === "blackout" || picture.value === "cover" || props.kind === "audio";
});
// A hint mode turned on mid-song counts up from the moment it was turned on.
const roundElapsed = computed(() => elapsed.value - (props.lightning?.offset ?? 0));
const blurPx = computed(() =>
  active.value ? effectStrength(fx.value.blur, fx.value.decay, fx.value.decaySeconds, roundElapsed.value) : 0,
);
const pixelBlock = computed(() =>
  active.value ? pixelBlockSize(fx.value.pixelate, fx.value.decay, fx.value.decaySeconds, roundElapsed.value) : 0,
);
// The canvas draws whichever picture is showing; the element itself stays
// loaded (and the clip keeps playing) underneath it.
const bubbleSource = computed(() => (picture.value === "bubbles" && !showVeil.value ? media.value : null));
const pixelSource = computed(() => {
  if (pixelBlock.value <= 0 || showVeil.value || bubbleSource.value) return null;
  return showCover.value ? cover.value : media.value;
});
// Peek: a round window onto the clip that grows over the guess time and
// drifts along a path fixed per song.
const PEEK_START = 12;
const PEEK_END = 45;
const peekSeed = computed(() => [...props.token].reduce((sum, char) => sum + char.charCodeAt(0), 0));
const peekClip = computed(() => {
  if (!active.value || props.lightning?.mode !== "peek") return undefined;
  const progress = Math.min(1, Math.max(0, roundElapsed.value) / props.lightning.guessSeconds);
  const radius = PEEK_START + (PEEK_END - PEEK_START) * progress;
  const x = 50 + 28 * Math.sin(roundElapsed.value * 0.6 + peekSeed.value);
  const y = 50 + 22 * Math.cos(roundElapsed.value * 0.45 + peekSeed.value);
  return `circle(${radius.toFixed(1)}% at ${x.toFixed(1)}% ${y.toFixed(1)}%)`;
});
const visualStyle = computed(() => {
  const style: Record<string, string> = {};
  if (blurPx.value > 0) {
    style.filter = `blur(${blurPx.value.toFixed(1)}px)`;
    style.transform = `scale(${BLUR_ZOOM})`;
  }
  if (peekClip.value) style.clipPath = peekClip.value;
  return Object.keys(style).length ? style : undefined;
});
const countdown = computed(() => {
  if (!active.value || !props.lightning) return null;
  return Math.max(0, 1 - Math.max(0, roundElapsed.value) / props.lightning.guessSeconds);
});
const hints = computed(() => (props.lightning?.hints && !failed.value ? props.lightning.hints : null));

// Ambient: the bars around the picture fill with a blurred, colour-sampled
// copy of it, like Study's glow. Only while the plain clip is on screen, so a
// peek, a blackout or a cover round never leaks through the glow.
const AMBIENT_SAMPLE_MS = 100;
const AMBIENT_BLEND = 0.22;
const glowCanvas = ref<HTMLCanvasElement | null>(null);
const ambientOn = computed(
  () => props.ambient && props.kind === "video" && !failed.value && picture.value === "video" && !showVeil.value && !peekClip.value && !pixelSource.value && !bubbleSource.value,
);
let glowPrimed = false;

function drawGlow() {
  const canvas = glowCanvas.value;
  const ctx = canvas?.getContext("2d");
  const element = media.value;
  if (!canvas || !ctx || !element || element.readyState < 2) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  ctx.globalAlpha = glowPrimed && !reduceMotion ? AMBIENT_BLEND : 1;
  ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  glowPrimed = true;
}

function report() {
  const element = media.value;
  if (!element || !props.token) return;
  emit("position", {
    token: props.token,
    currentTime: element.currentTime,
    duration: Number.isFinite(element.duration) ? element.duration : null,
    playing: !blocked.value && !element.paused && audible.value,
    blocked: blocked.value,
    elapsed: Math.max(0, element.currentTime - startPosition.value),
    ended: element.ended,
    ...(failed.value ? { failed: true } : {}),
  });
}

function requestPlay(element: HTMLVideoElement) {
  const token = props.token;
  const attempt = ++playAttempt;
  void element.play().catch((error: unknown) => {
    if (attempt !== playAttempt || media.value !== element || props.token !== token || !props.playing) return;
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      blocked.value = true;
      audible.value = false;
      report();
    }
  });
}

function followPlaying() {
  const element = media.value;
  if (!element) return;
  if (props.playing && element.paused) {
    requestPlay(element);
  } else if (!props.playing) {
    playAttempt++;
    blocked.value = false;
    if (!element.paused) element.pause();
    report();
  }
}

function retryPlayback() {
  if (media.value && props.playing) requestPlay(media.value);
}

function followMuted() {
  if (media.value) media.value.muted = active.value && fx.value.muted;
}

function registerElement(slot: number, element: unknown) {
  if (!(element instanceof HTMLVideoElement)) return;
  if (elements[slot] === element) return;
  elements[slot] = element;
  element.muted = true;
  element.volume = props.volume;
}

function matchesSlotSource(slot: number) {
  const element = elements[slot];
  const token = slots.value[slot];
  return Boolean(element?.currentSrc && token && new URL(element.currentSrc).searchParams.get("t") === token);
}

function unlock() {
  for (const element of elements) {
    if (!element) continue;
    element.muted = false;
    void element.play().then(
      () => {
        if (element.currentSrc.endsWith(UNLOCK_SRC)) {
          element.pause();
          element.muted = true;
        }
      },
      () => { if (element.currentSrc.endsWith(UNLOCK_SRC)) element.muted = true; },
    );
  }
}

defineExpose({ unlock });

function startCurrent() {
  const element = media.value;
  if (!element) return;
  failed.value = false;
  const randomStart = Number.isFinite(element.duration)
    ? props.startFraction * Math.max(0, element.duration - RANDOM_START_TAIL_S)
    : 0;
  element.currentTime = props.seekTo ?? (props.startAt || randomStart);
  startPosition.value = element.currentTime;
  elapsed.value = 0;
  followMuted();
  followPlaying();
}

function onLoadedMetadata(slot: number) {
  const element = elements[slot];
  if (element?.videoWidth && element.videoHeight) aspects.value[slot] = element.videoWidth / element.videoHeight;
  if (slots.value[slot] !== props.token || !matchesSlotSource(slot)) return;
  media.value = elements[slot];
  startCurrent();
}

function onError(slot: number) {
  if (slots.value[slot] === props.token && matchesSlotSource(slot)) failed.value = true;
}

function onAudible(slot: number, value: boolean) {
  if (slots.value[slot] !== props.token || !matchesSlotSource(slot)) return;
  audible.value = value;
  if (value) blocked.value = false;
  report();
}

watch(
  tokens,
  async (next, previous) => {
    const songChanged = next[0] !== previous?.[0];
    if (songChanged && media.value) {
      playAttempt++;
      media.value.pause();
      media.value.muted = true;
      media.value = null;
    }
    slots.value = assignPartyVideoSlots(slots.value, next);
    if (!songChanged) return;
    failed.value = false;
    coverFailed.value = false;
    elapsed.value = 0;
    audible.value = false;
    blocked.value = false;
    await nextTick();
    if (props.token !== next[0]) return;
    const slot = slots.value.indexOf(props.token);
    const element = slot === -1 ? null : elements[slot];
    media.value = element ?? null;
    if (!element) return;
    // A preload that failed (say, a remote clip still caching) gets a fresh try.
    if (element.error) element.load();
    else if (matchesSlotSource(slot) && element.readyState >= HTMLMediaElement.HAVE_METADATA) startCurrent();
  },
  { flush: "pre" },
);
watch(() => props.playing, followPlaying);
watch(failed, (value) => {
  if (value) report();
});
watch(
  () => props.volume,
  (volume) => {
    for (const element of elements) if (element) element.volume = volume;
  },
);
watch([() => fx.value.muted, active], followMuted);
watch(
  () => props.seekSeq,
  () => {
    if (media.value && props.seekTo !== null) media.value.currentTime = props.seekTo;
  },
);

watch(ambientOn, (on) => {
  if (!on) glowPrimed = false;
});
watch(() => props.token, () => {
  glowPrimed = false;
});

let glowTimer: ReturnType<typeof setInterval> | null = null;
let reportTimer: ReturnType<typeof setInterval> | null = null;
let frame = 0;
function tick() {
  if (media.value) elapsed.value = media.value.currentTime - startPosition.value;
  frame = requestAnimationFrame(tick);
}
onMounted(() => {
  reportTimer = setInterval(report, REPORT_INTERVAL_MS);
  glowTimer = setInterval(() => {
    if (ambientOn.value) drawGlow();
  }, AMBIENT_SAMPLE_MS);
  frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => {
  if (reportTimer) clearInterval(reportTimer);
  if (glowTimer) clearInterval(glowTimer);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="party-player" :class="{ ambient: ambientOn }">
    <canvas v-show="ambientOn" ref="glowCanvas" width="32" height="18" class="party-glow" aria-hidden="true" />
    <video
      v-for="slotIndex in SLOT_COUNT"
      :key="slotIndex"
      :ref="(element) => registerElement(slotIndex - 1, element)"
      class="party-media"
      :class="slots[slotIndex - 1] === token && token ? { hidden: showVeil || showCover || pixelSource || bubbleSource } : 'preload'"
      :style="[{ '--clip-aspect': aspects[slotIndex - 1] }, slots[slotIndex - 1] !== token || !token || showVeil || showCover || pixelSource || bubbleSource ? {} : visualStyle ?? {}]"
      :src="slots[slotIndex - 1] ? clipSrc(slots[slotIndex - 1]!) : UNLOCK_SRC"
      preload="auto"
      playsinline
      @loadedmetadata="onLoadedMetadata(slotIndex - 1)"
      @playing="onAudible(slotIndex - 1, true)"
      @waiting="onAudible(slotIndex - 1, false)"
      @pause="onAudible(slotIndex - 1, false)"
      @seeked="report"
      @ended="report"
      @error="onError(slotIndex - 1)"
    />
    <img
      v-if="showCover"
      ref="cover"
      class="party-cover"
      :class="{ hidden: pixelSource }"
      :style="pixelSource ? undefined : visualStyle"
      :src="coverSrc"
      alt=""
      @error="coverFailed = true"
    />
    <PartyBubbleCanvas v-if="bubbleSource" :source="bubbleSource" :seed="token" :style="visualStyle" />
    <PartyPixelCanvas v-if="pixelSource" :source="pixelSource" :block-size="pixelBlock" :style="visualStyle" />
    <div v-if="failed" class="party-veil">
      <StudyPlayerKai mood="error" text="This clip won't play" />
    </div>
    <div v-else-if="blocked && playing" class="party-veil party-resume">
      <StudyPlayerKai mood="paused" text="Tap to resume" />
      <button type="button" class="resume-hit-area" aria-label="Tap to resume" @click="retryPlayback" />
    </div>
    <PartyLightningHints v-else-if="hints && showVeil" :hints="hints" />
    <div v-else-if="loading && !showVeil && elapsed <= 0.3" class="party-veil">
      <StudyPlayerKai mood="loading"><ActivityStatus label="Loading clip" :request-key="token" /></StudyPlayerKai>
    </div>
    <div v-else-if="showVeil" class="party-veil">
      <StudyPlayerKai v-if="loading" mood="loading"><ActivityStatus label="Loading clip" :request-key="token" /></StudyPlayerKai>
      <StudyPlayerKai v-else :mood="playing ? 'listening' : 'paused'" :text="playing ? 'Listen closely!' : 'Paused'" />
    </div>
    <div v-if="countdown !== null" class="countdown" aria-hidden="true">
      <span class="countdown-fill" :style="{ transform: `scaleX(${countdown})` }" />
    </div>
  </div>
</template>

<style scoped>
.party-player {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg);
  container-type: size;
}

/* Overscanned so the blur's soft edge falls outside the screen. */
.party-glow {
  position: absolute;
  inset: -6%;
  width: 112%;
  height: 112%;
  /* Softer and darker than Study's wash: on a TV the bars sit right beside
     the picture, so a bright glow would compete with it. */
  filter: blur(8vmin) saturate(1.3) brightness(0.55);
  pointer-events: none;
}

.party-media {
  position: absolute;
  inset: 0;
  margin: auto;
  width: min(100cqw, calc(100cqh * var(--clip-aspect, 1.7778)));
  height: auto;
  aspect-ratio: var(--clip-aspect, 1.7778);
  object-fit: contain;
}

/* Spill: the picture's edges fade into the glow, as on Study. */
.party-player.ambient .party-media {
  -webkit-mask-image:
    linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent),
    linear-gradient(180deg, transparent, #000 5%, #000 95%, transparent);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent),
    linear-gradient(180deg, transparent, #000 5%, #000 95%, transparent);
  mask-composite: intersect;
}

.party-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.party-media.hidden,
.party-media.preload,
.party-cover.hidden {
  visibility: hidden;
}

.party-cover {
  background: var(--bg);
}

.countdown {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(6px, 1vh, 12px);
  background: var(--surface-sunken);
}

.countdown-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transform-origin: left center;
}

.party-veil {
  position: absolute;
  inset: 0;
  /* Centres the loading Kai, which sits in flow; the other moods position
     themselves absolutely and ignore this. */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  font-size: clamp(16px, 2vw, 28px);
  /* StudyPlayerKai sizes and places itself from these, as it does on
     Study's player frame; here Kai stands just above the reveal card. */
  container-type: size;
  --kai-bottom: 46%;
  --kai-height: clamp(120px, 26cqh, 300px);
}

.party-resume {
  z-index: 1;
}

.resume-hit-area {
  position: absolute;
  inset: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.resume-hit-area:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: -3px;
}

/* Study moves Kai aside while listening to keep a video's middle clear; an
   audio veil has no video, so she stays centred. */
.party-veil :deep(.player-kai:not(.mood-loading)) {
  left: 50%;
  transform: translateX(-50%);
}
</style>
