<script setup lang="ts">
import type { PartyPositionReport } from "~/composables/usePartyDisplay";

const props = defineProps<{
  token: string;
  kind: "video" | "audio";
  playing: boolean;
  startAt: number;
  seekTo: number | null;
  seekSeq: number;
  startFraction: number;
}>();

const emit = defineEmits<{ position: [report: PartyPositionReport] }>();

const REPORT_INTERVAL_MS = 1000;
// Study's random start never lands in a clip's last 15 seconds either.
const RANDOM_START_TAIL_S = 15;

const media = ref<HTMLVideoElement | null>(null);
const failed = ref(false);
const src = computed(() => `/api/party/display/clip?t=${encodeURIComponent(props.token)}`);

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

function onLoadedMetadata() {
  const element = media.value;
  if (!element) return;
  failed.value = false;
  const randomStart = Number.isFinite(element.duration)
    ? props.startFraction * Math.max(0, element.duration - RANDOM_START_TAIL_S)
    : 0;
  element.currentTime = props.seekTo ?? (props.startAt || randomStart);
  followPlaying();
}

watch(() => props.token, () => {
  failed.value = false;
});
watch(() => props.playing, followPlaying);
watch(
  () => props.seekSeq,
  () => {
    if (media.value && props.seekTo !== null) media.value.currentTime = props.seekTo;
  },
);

let reportTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  reportTimer = setInterval(report, REPORT_INTERVAL_MS);
});
onBeforeUnmount(() => {
  if (reportTimer) clearInterval(reportTimer);
});
</script>

<template>
  <div class="party-player" :class="{ 'is-audio': kind === 'audio' }">
    <video
      ref="media"
      class="party-media"
      :src="src"
      preload="auto"
      playsinline
      @loadedmetadata="onLoadedMetadata"
      @play="report"
      @pause="report"
      @seeked="report"
      @error="failed = true"
    />
    <div v-if="failed" class="party-veil">
      <StudyPlayerKai mood="error" text="This clip won't play" />
    </div>
    <div v-else-if="kind === 'audio'" class="party-veil">
      <StudyPlayerKai :mood="playing ? 'listening' : 'paused'" :text="playing ? 'Listen closely!' : 'Paused'" />
    </div>
  </div>
</template>

<style scoped>
.party-player {
  position: absolute;
  inset: 0;
  background: var(--bg);
}

.party-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--record-shadow);
}

.is-audio .party-media {
  visibility: hidden;
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
