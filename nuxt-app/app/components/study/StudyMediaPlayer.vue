<script setup lang="ts">
import type { CardWithDetails } from "~/composables/useStudySession";

const props = defineProps<{
  card: Pick<CardWithDetails, "localVideoPath" | "localAudioPath" | "animethemesVideoUrl" | "animethemesAudioUrl" | "themeSlot">;
  hideVideo?: boolean;
  randomStart?: boolean;
  ambient?: boolean;
}>();

function mediaUrl(localPath: string | null, remoteUrl: string | null): string | null {
  if (localPath) return `/api/media?path=${encodeURIComponent(localPath)}`;
  if (remoteUrl) return remoteUrl;
  return null;
}

const hasVideoSource = computed(() => Boolean(props.card.localVideoPath || props.card.animethemesVideoUrl));

// Which element/src actually mounts - deliberately independent of hideVideo,
// so toggling it never swaps the underlying element mid-playback (that
// remount was resetting playback to paused, which felt like a bug).
const mediaKind = computed<"video" | "audio">(() => (hasVideoSource.value ? "video" : "audio"));

// Whether the video frame is actually shown. Hiding video always forces the
// audio-style veil, even when the video element keeps playing underneath for
// its own audio track (no separate audio source needed for this to work).
const quizType = computed<"video" | "audio">(() => (props.hideVideo ? "audio" : mediaKind.value));

const src = computed(() =>
  mediaKind.value === "video"
    ? mediaUrl(props.card.localVideoPath, props.card.animethemesVideoUrl)
    : mediaUrl(props.card.localAudioPath, props.card.animethemesAudioUrl),
);

const videoRef = ref<HTMLVideoElement | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const errorMessage = ref<string | null>(null);

const activeEl = computed<HTMLMediaElement | null>(() =>
  mediaKind.value === "video" ? videoRef.value : audioRef.value,
);

const showVeil = computed(() => quizType.value === "audio" || !isPlaying.value);
const progressPercent = computed(() => (duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0));

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function onTimeUpdate() {
  if (activeEl.value) currentTime.value = activeEl.value.currentTime;
}

function randomStartTime(resolvedDuration: number): number {
  return Math.random() * Math.max(resolvedDuration - 15, 0);
}

function onLoadedMetadata() {
  const el = activeEl.value;
  if (!el) return;

  if (Number.isFinite(el.duration)) {
    duration.value = el.duration;
    if (props.randomStart && el.duration > 0) {
      el.currentTime = randomStartTime(el.duration);
    }
    return;
  }

  // Some webm streams report an Infinity/NaN duration until the browser scans to
  // the end of the stream; seeking past the end forces that scan, then durationchange
  // reports the real value. Standard workaround for this browser quirk.
  el.addEventListener(
    "durationchange",
    () => {
      const resolved = Number.isFinite(el.duration) ? el.duration : 0;
      duration.value = resolved;
      el.currentTime = props.randomStart && resolved > 0 ? randomStartTime(resolved) : 0;
    },
    { once: true },
  );
  el.currentTime = 1e101;
}

function onError() {
  errorMessage.value = "Couldn't load this clip.";
}

function togglePlay() {
  const el = activeEl.value;
  if (!el) return;
  if (el.paused) {
    el.play().catch(() => {
      errorMessage.value = "Couldn't play this clip.";
    });
  } else {
    el.pause();
  }
}

// Ambient glow: samples the *same* <video> already decoding for playback via
// canvas, rather than a second <video> playing a duplicate stream - avoids
// doubling network/decode cost for remote animethemes.moe clips.
const ambientCanvasRef = ref<HTMLCanvasElement | null>(null);
let ambientInterval: ReturnType<typeof setInterval> | null = null;

const ambientActive = computed(() => Boolean(props.ambient) && quizType.value === "video");

function drawAmbientFrame() {
  const canvas = ambientCanvasRef.value;
  const video = videoRef.value;
  if (!canvas || !video || video.readyState < 2) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
}

function stopAmbientInterval() {
  if (ambientInterval !== null) {
    clearInterval(ambientInterval);
    ambientInterval = null;
  }
}

function startAmbientLoop() {
  stopAmbientInterval();
  drawAmbientFrame();
  ambientInterval = setInterval(drawAmbientFrame, 150);
}

function stopAmbientLoop() {
  stopAmbientInterval();
  drawAmbientFrame();
}

watch(ambientActive, (active) => {
  if (active && isPlaying.value) {
    startAmbientLoop();
  } else {
    stopAmbientLoop();
  }
});

onUnmounted(stopAmbientInterval);

function onPlay() {
  isPlaying.value = true;
  if (ambientActive.value) startAmbientLoop();
}

function onPause() {
  isPlaying.value = false;
  stopAmbientLoop();
}

function onSeeked() {
  if (ambientActive.value) drawAmbientFrame();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key.toLowerCase() === "s") {
    togglePlay();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function onSeek(event: MouseEvent) {
  const el = activeEl.value;
  if (!el || !Number.isFinite(duration.value) || !duration.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  el.currentTime = ratio * duration.value;
}
</script>

<template>
  <div class="player-ambient-host">
    <canvas v-if="ambientActive" ref="ambientCanvasRef" width="40" height="22" class="ambient-glow" aria-hidden="true" />
    <div class="player-card">
    <div class="player-frame">
      <span class="theme-badge">{{ card.themeSlot }}</span>

      <video
        v-if="mediaKind === 'video' && src"
        ref="videoRef"
        class="media-el"
        :src="src"
        @play="onPlay"
        @pause="onPause"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @seeked="onSeeked"
        @error="onError"
      />
      <audio
        v-else-if="src"
        ref="audioRef"
        class="hidden-audio"
        :src="src"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @error="onError"
      />

      <div v-if="errorMessage" class="veil error-veil">
        <p>{{ errorMessage }}</p>
      </div>
      <div v-else-if="showVeil" class="veil" :class="quizType === 'audio' ? 'audio-veil' : 'paused-veil'">
        <div v-if="quizType === 'audio' && isPlaying" class="listening-icon">
          <span class="eq-bar" />
          <span class="eq-bar" />
          <span class="eq-bar" />
          <span class="eq-bar" />
        </div>
        <p>{{ isPlaying ? "Listening..." : "Paused" }}</p>
      </div>
    </div>

    <div class="player-controls">
      <button type="button" class="play-btn" :disabled="!!errorMessage" @click="togglePlay">
        {{ isPlaying ? "⏸" : "▶" }}
        <span class="tooltip">Hotkey: S</span>
      </button>
      <div class="scrub" @click="onSeek">
        <span :style="{ width: progressPercent + '%' }" />
      </div>
      <span class="time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
    </div>
    </div>
  </div>
</template>

<style scoped>
.player-ambient-host {
  position: relative;
}

.ambient-glow {
  position: absolute;
  inset: -60px;
  width: calc(100% + 120px);
  height: calc(100% + 120px);
  z-index: 0;
  filter: blur(50px) saturate(1.6) brightness(1.1);
  opacity: 0.85;
  pointer-events: none;
  border-radius: var(--radius);
}

.player-card {
  position: relative;
  z-index: 1;
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
}

.player-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background:
    radial-gradient(120% 120% at 30% 20%, rgba(255, 93, 162, 0.35), transparent 55%),
    radial-gradient(120% 120% at 80% 80%, rgba(177, 140, 255, 0.35), transparent 55%),
    #120c19;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-el {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hidden-audio {
  display: none;
}

.theme-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: rgba(21, 15, 28, 0.75);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: var(--accent-secondary);
  z-index: 2;
}

.veil {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.paused-veil {
  backdrop-filter: blur(18px);
  background: rgba(10, 6, 15, 0.45);
}

.audio-veil {
  background:
    radial-gradient(120% 120% at 30% 20%, rgba(255, 93, 162, 0.35), transparent 55%),
    radial-gradient(120% 120% at 80% 80%, rgba(177, 140, 255, 0.35), transparent 55%),
    #120c19;
}

.error-veil {
  background: rgba(53, 15, 15, 0.6);
}

.error-veil p {
  color: var(--fail);
  padding: 0 24px;
  text-align: center;
}

.listening-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 5px;
  padding: 20px 18px;
  box-shadow: var(--shadow-accent);
}

.eq-bar {
  width: 5px;
  height: 100%;
  border-radius: 3px;
  background: var(--accent-secondary);
  transform-origin: bottom;
  animation: eq-bounce 1s ease-in-out infinite;
}

.eq-bar:nth-child(1) {
  animation-delay: 0s;
}

.eq-bar:nth-child(2) {
  animation-delay: 0.15s;
}

.eq-bar:nth-child(3) {
  animation-delay: 0.3s;
}

.eq-bar:nth-child(4) {
  animation-delay: 0.45s;
}

@keyframes eq-bounce {
  0%,
  100% {
    transform: scaleY(0.25);
  }
  50% {
    transform: scaleY(1);
  }
}

.veil p {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.3px;
}

.player-controls {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.play-btn {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}

.play-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

.play-btn:hover .tooltip,
.play-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}

.scrub {
  flex: 1;
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  overflow: hidden;
  cursor: pointer;
}

.scrub > span {
  display: block;
  height: 100%;
  background: var(--accent-secondary);
}

.time {
  font-size: 14px;
  color: var(--muted);
  font-weight: 600;
  min-width: 76px;
  text-align: right;
}
</style>
