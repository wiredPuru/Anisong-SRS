<script setup lang="ts">
import type { PartyMusic } from "~/composables/usePartyDisplay";

// Lobby music never overlaps a song: it plays only while no song is playing,
// and fades out and pauses before one starts (features 18 and 32 were
// abandoned over overlapping audio).
const props = defineProps<{ music: PartyMusic; songPlaying: boolean }>();

const FADE_PER_SECOND = 1;

const audio = ref<HTMLAudioElement | null>(null);
const UNLOCK_SRC = "/party-unlock.mp4";
const trackCount = ref(0);
const blocked = ref(false);
let playAttempt = 0;
let order: number[] = [];
let frame = 0;
let lastFrame = 0;

const active = computed(() => props.music.enabled && !props.songPlaying && trackCount.value > 0);

function unlock() {
  const element = audio.value;
  if (!element) return;
  void element.play().then(
    () => { if (element.currentSrc.endsWith(UNLOCK_SRC)) element.pause(); },
    () => {},
  );
}

defineExpose({ unlock });

function requestPlay(element: HTMLAudioElement) {
  const source = element.src;
  const attempt = ++playAttempt;
  void element.play().catch((error: unknown) => {
    if (attempt !== playAttempt || audio.value !== element || element.src !== source || !active.value) return;
    if (error instanceof DOMException && error.name === "NotAllowedError") blocked.value = true;
  });
}

function retryPlayback() {
  if (audio.value && active.value) requestPlay(audio.value);
}

async function loadCount() {
  try {
    trackCount.value = (await $fetch<{ count: number }>("/api/party/display/music")).count;
  } catch {
    trackCount.value = 0;
  }
}

function nextTrack() {
  const element = audio.value;
  if (!element || !trackCount.value || !active.value) return;
  if (!order.length) {
    order = Array.from({ length: trackCount.value }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
  }
  element.src = `/api/party/display/music?i=${order.shift()}`;
  requestPlay(element);
}

function fade(time: number) {
  frame = requestAnimationFrame(fade);
  const element = audio.value;
  if (!element) return;
  const step = ((time - (lastFrame || time)) / 1000) * FADE_PER_SECOND;
  lastFrame = time;
  const target = active.value ? props.music.volume : 0;
  element.volume = element.volume < target ? Math.min(target, element.volume + step) : Math.max(target, element.volume - step);
  if (!active.value && element.volume === 0 && !element.paused) element.pause();
}

watch(active, async (isActive) => {
  const element = audio.value;
  if (!element) return;
  if (!isActive) {
    playAttempt++;
    blocked.value = false;
    return;
  }
  // The list is re-read each time the lobby starts, so new tracks join in.
  await loadCount();
  if (!active.value) return;
  if (!element.src || element.ended || element.currentSrc.endsWith(UNLOCK_SRC)) nextTrack();
  else requestPlay(element);
});

watch(
  () => props.songPlaying,
  (playing) => {
    // A song starting cuts the lobby at once rather than waiting on the fade.
    if (playing && audio.value && !audio.value.paused) {
      audio.value.volume = 0;
      audio.value.pause();
    }
  },
);

onMounted(async () => {
  if (audio.value) audio.value.volume = 0;
  frame = requestAnimationFrame(fade);
  await loadCount();
  if (active.value) nextTrack();
});
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <div class="lobby-music">
    <audio ref="audio" :src="UNLOCK_SRC" preload="auto" @ended="nextTrack" @playing="blocked = false" />
    <div v-if="blocked && active" class="music-resume">
      <StudyPlayerKai mood="paused" text="Tap to resume" />
      <button type="button" class="resume-hit-area" aria-label="Tap to resume" @click="retryPlayback" />
    </div>
  </div>
</template>

<style scoped>
.lobby-music audio {
  display: none;
}

.music-resume {
  position: absolute;
  inset: 0;
  z-index: var(--z-chrome);
  background: var(--bg);
  container-type: size;
  --kai-bottom: 46%;
  --kai-height: clamp(120px, 26cqh, 300px);
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
</style>
