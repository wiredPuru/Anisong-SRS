<script setup lang="ts">
import type { PartyMusic } from "~/composables/usePartyDisplay";

// Lobby music never overlaps a song: it plays only while no song is playing,
// and fades out and pauses before one starts (features 18 and 32 were
// abandoned over overlapping audio).
const props = defineProps<{ music: PartyMusic; songPlaying: boolean }>();

const FADE_PER_SECOND = 1;

const audio = ref<HTMLAudioElement | null>(null);
const trackCount = ref(0);
let order: number[] = [];
let frame = 0;
let lastFrame = 0;

const active = computed(() => props.music.enabled && !props.songPlaying && trackCount.value > 0);

async function loadCount() {
  try {
    trackCount.value = (await $fetch<{ count: number }>("/api/party/display/music")).count;
  } catch {
    trackCount.value = 0;
  }
}

function nextTrack() {
  const element = audio.value;
  if (!element || !trackCount.value) return;
  if (!order.length) {
    order = Array.from({ length: trackCount.value }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
  }
  element.src = `/api/party/display/music?i=${order.shift()}`;
  element.play().catch(() => {});
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
  if (!isActive) return;
  // The list is re-read each time the lobby starts, so new tracks join in.
  await loadCount();
  if (!active.value) return;
  if (!element.src || element.ended) nextTrack();
  else element.play().catch(() => {});
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
  <audio ref="audio" class="lobby-music" preload="auto" @ended="nextTrack" />
</template>

<style scoped>
.lobby-music {
  display: none;
}
</style>
