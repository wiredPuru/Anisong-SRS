<script setup lang="ts">
import type { PartyEffects, PartyHints, PartyLightningMode, PartyPositionReport } from "~/composables/usePartyDisplay";

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
  lightning: { mode: PartyLightningMode; guessSeconds: number; hints: PartyHints } | null;
}>();

const emit = defineEmits<{ position: [report: PartyPositionReport] }>();

const REPORT_INTERVAL_MS = 1000;
// Study's random start never lands in a clip's last 15 seconds either.
const RANDOM_START_TAIL_S = 15;
// A blurred edge fades into the background; a slight zoom keeps it off screen.
const BLUR_ZOOM = 1.08;

// One element per song: the current one plays, the upcoming ones sit muted and
// hidden, buffering, so moving on swaps to an already-loaded clip instead of
// starting a fresh load. Keyed by token, so the swap keeps the element.
const tokens = computed(() => [props.token, ...props.upcoming.filter((token) => token !== props.token)]);
const elements = new Map<string, HTMLVideoElement>();
const media = shallowRef<HTMLVideoElement | null>(null);
const cover = ref<HTMLImageElement | null>(null);
const failed = ref(false);
const coverFailed = ref(false);
// True only between the current clip's "playing" and its next stall or pause,
// so "asked to play" and "actually audible" can be told apart.
const audible = ref(false);
const loading = computed(() => props.playing && !audible.value && !failed.value);
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
const blurPx = computed(() =>
  active.value ? effectStrength(fx.value.blur, fx.value.decay, fx.value.decaySeconds, elapsed.value) : 0,
);
const pixelBlock = computed(() =>
  active.value ? pixelBlockSize(fx.value.pixelate, fx.value.decay, fx.value.decaySeconds, elapsed.value) : 0,
);
// The canvas draws whichever picture is showing; the element itself stays
// loaded (and the clip keeps playing) underneath it.
const pixelSource = computed(() => {
  if (pixelBlock.value <= 0 || showVeil.value) return null;
  return showCover.value ? cover.value : media.value;
});
// Peek: a round window onto the clip that grows over the guess time and
// drifts along a path fixed per song.
const PEEK_START = 12;
const PEEK_END = 45;
const peekSeed = computed(() => [...props.token].reduce((sum, char) => sum + char.charCodeAt(0), 0));
const peekClip = computed(() => {
  if (!active.value || props.lightning?.mode !== "peek") return undefined;
  const progress = Math.min(1, Math.max(0, elapsed.value) / props.lightning.guessSeconds);
  const radius = PEEK_START + (PEEK_END - PEEK_START) * progress;
  const x = 50 + 28 * Math.sin(elapsed.value * 0.6 + peekSeed.value);
  const y = 50 + 22 * Math.cos(elapsed.value * 0.45 + peekSeed.value);
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
  return Math.max(0, 1 - Math.max(0, elapsed.value) / props.lightning.guessSeconds);
});
const hints = computed(() => (props.lightning?.hints && !failed.value ? props.lightning.hints : null));

function report() {
  const element = media.value;
  if (!element) return;
  emit("position", {
    token: props.token,
    currentTime: element.currentTime,
    duration: Number.isFinite(element.duration) ? element.duration : null,
    playing: !element.paused && audible.value,
    elapsed: Math.max(0, element.currentTime - startPosition.value),
  });
}

function followPlaying() {
  const element = media.value;
  if (!element) return;
  if (props.playing && element.paused) {
    // Rejects when the page was never clicked; the display's start screen
    // exists so this does not happen.
    element.play().catch(() => {});
  } else if (!props.playing && !element.paused) {
    element.pause();
  }
}

function followMuted() {
  if (media.value) media.value.muted = active.value && fx.value.muted;
}

// Vue calls a template function ref with null and then the element on every
// re-render, so null is ignored here; tokens that leave the list are pruned
// once the DOM has settled.
function registerElement(token: string, element: unknown) {
  if (!(element instanceof HTMLVideoElement)) return;
  elements.set(token, element);
  if (token === props.token) {
    media.value = element;
  } else {
    element.muted = true;
  }
}

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

function onLoadedMetadata(token: string) {
  if (token === props.token) startCurrent();
}

function onError(token: string) {
  if (token === props.token) failed.value = true;
}

function onAudible(token: string, value: boolean) {
  if (token !== props.token) return;
  audible.value = value;
  report();
}

// Pause the outgoing song before the DOM changes, so it can never overlap the
// next one, whether its element is dropped or kept as a preload.
watch(
  () => props.token,
  (_next, previous) => {
    const outgoing = previous ? elements.get(previous) : null;
    if (outgoing) {
      outgoing.pause();
      outgoing.muted = true;
    }
  },
  { flush: "pre" },
);

watch(
  () => props.token,
  () => {
    failed.value = false;
    coverFailed.value = false;
    elapsed.value = 0;
    audible.value = false;
    for (const token of [...elements.keys()]) {
      if (!tokens.value.includes(token)) elements.delete(token);
    }
    const element = elements.get(props.token) ?? null;
    media.value = element;
    if (!element) return;
    // A preload that failed (say, a remote clip still caching) gets a fresh try.
    if (element.error) element.load();
    else if (element.readyState >= HTMLMediaElement.HAVE_METADATA) startCurrent();
  },
  { flush: "post" },
);
watch(() => props.playing, followPlaying);
watch([() => fx.value.muted, active], followMuted);
watch(
  () => props.seekSeq,
  () => {
    if (media.value && props.seekTo !== null) media.value.currentTime = props.seekTo;
  },
);

let reportTimer: ReturnType<typeof setInterval> | null = null;
let frame = 0;
function tick() {
  if (media.value) elapsed.value = media.value.currentTime - startPosition.value;
  frame = requestAnimationFrame(tick);
}
onMounted(() => {
  reportTimer = setInterval(report, REPORT_INTERVAL_MS);
  frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => {
  if (reportTimer) clearInterval(reportTimer);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="party-player">
    <video
      v-for="clipToken in tokens"
      :key="clipToken"
      :ref="(element) => registerElement(clipToken, element)"
      class="party-media"
      :class="clipToken === token ? { hidden: showVeil || showCover || pixelSource } : 'preload'"
      :style="clipToken !== token || showVeil || showCover || pixelSource ? undefined : visualStyle"
      :src="clipSrc(clipToken)"
      preload="auto"
      playsinline
      @loadedmetadata="onLoadedMetadata(clipToken)"
      @playing="onAudible(clipToken, true)"
      @waiting="onAudible(clipToken, false)"
      @pause="onAudible(clipToken, false)"
      @seeked="report"
      @error="onError(clipToken)"
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
    <PartyPixelCanvas v-if="pixelSource" :source="pixelSource" :block-size="pixelBlock" :style="visualStyle" />
    <div v-if="failed" class="party-veil">
      <StudyPlayerKai mood="error" text="This clip won't play" />
    </div>
    <PartyLightningHints v-else-if="hints && showVeil" :hints="hints" />
    <div v-else-if="showVeil" class="party-veil">
      <StudyPlayerKai v-if="loading" mood="loading">Loading...</StudyPlayerKai>
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
}

.party-media,
.party-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.party-media {
  background: var(--record-shadow);
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

/* Study moves Kai aside while listening to keep a video's middle clear; an
   audio veil has no video, so she stays centred. */
.party-veil :deep(.player-kai:not(.mood-loading)) {
  left: 50%;
  transform: translateX(-50%);
}
</style>
