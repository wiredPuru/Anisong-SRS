<script setup lang="ts">
import type { PartyEffects, PartyPositionReport } from "~/composables/usePartyDisplay";

const props = defineProps<{
  token: string;
  kind: "video" | "audio";
  playing: boolean;
  startAt: number;
  seekTo: number | null;
  seekSeq: number;
  startFraction: number;
  effects: PartyEffects;
  revealed: boolean;
}>();

const emit = defineEmits<{ position: [report: PartyPositionReport] }>();

const REPORT_INTERVAL_MS = 1000;
// Study's random start never lands in a clip's last 15 seconds either.
const RANDOM_START_TAIL_S = 15;
// A blurred edge fades into the background; a slight zoom keeps it off screen.
const BLUR_ZOOM = 1.08;

const media = ref<HTMLVideoElement | null>(null);
const cover = ref<HTMLImageElement | null>(null);
const failed = ref(false);
const coverFailed = ref(false);
const src = computed(() => `/api/party/display/clip?t=${encodeURIComponent(props.token)}`);
const coverSrc = computed(() => `/api/party/display/cover?t=${encodeURIComponent(props.token)}`);

// Seconds played since this song's own start position (random start included),
// which is what blur and pixelate decay against.
const startPosition = ref(0);
const elapsed = ref(0);

// A reveal shows the answer clean; the stored effects wait for the next song.
const active = computed(() => !props.revealed);
const picture = computed(() => (active.value ? props.effects.picture : "video"));
const showCover = computed(() => picture.value === "cover" && !coverFailed.value);
const showVeil = computed(() => {
  if (showCover.value) return false;
  return picture.value === "blackout" || picture.value === "cover" || props.kind === "audio";
});
const blurPx = computed(() =>
  active.value ? effectStrength(props.effects.blur, props.effects.decay, props.effects.decaySeconds, elapsed.value) : 0,
);
const pixelBlock = computed(() =>
  active.value ? pixelBlockSize(props.effects.pixelate, props.effects.decay, props.effects.decaySeconds, elapsed.value) : 0,
);
// The canvas draws whichever picture is showing; the element itself stays
// loaded (and the clip keeps playing) underneath it.
const pixelSource = computed(() => {
  if (pixelBlock.value <= 0 || showVeil.value) return null;
  return showCover.value ? cover.value : media.value;
});
const visualStyle = computed(() =>
  blurPx.value > 0 ? { filter: `blur(${blurPx.value.toFixed(1)}px)`, transform: `scale(${BLUR_ZOOM})` } : undefined,
);

function report() {
  const element = media.value;
  if (!element) return;
  emit("position", {
    token: props.token,
    currentTime: element.currentTime,
    duration: Number.isFinite(element.duration) ? element.duration : null,
    playing: !element.paused,
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
  if (media.value) media.value.muted = active.value && props.effects.muted;
}

function onLoadedMetadata() {
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

watch(() => props.token, () => {
  failed.value = false;
  coverFailed.value = false;
  elapsed.value = 0;
});
watch(() => props.playing, followPlaying);
watch([() => props.effects.muted, active], followMuted);
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
      ref="media"
      class="party-media"
      :class="{ hidden: showVeil || showCover || pixelSource }"
      :style="showVeil || showCover || pixelSource ? undefined : visualStyle"
      :src="src"
      preload="auto"
      playsinline
      @loadedmetadata="onLoadedMetadata"
      @play="report"
      @pause="report"
      @seeked="report"
      @error="failed = true"
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
    <div v-else-if="showVeil" class="party-veil">
      <StudyPlayerKai :mood="playing ? 'listening' : 'paused'" :text="playing ? 'Listen closely!' : 'Paused'" />
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
.party-cover.hidden {
  visibility: hidden;
}

.party-cover {
  background: var(--bg);
}

.party-veil {
  position: absolute;
  inset: 0;
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
.party-veil :deep(.player-kai) {
  left: 50%;
  transform: translateX(-50%);
}
</style>
