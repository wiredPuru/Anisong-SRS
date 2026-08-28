<script setup lang="ts">
import type { CardWithDetails } from "~/composables/useStudySession";

const props = defineProps<{
  card: Pick<CardWithDetails, "localVideoPath" | "localAudioPath" | "animethemesVideoUrl" | "animethemesAudioUrl" | "themeSlot">;
}>();

function mediaUrl(localPath: string | null, remoteUrl: string | null): string | null {
  if (localPath) return `/api/media?path=${encodeURIComponent(localPath)}`;
  if (remoteUrl) return remoteUrl;
  return null;
}

const quizType = computed<"video" | "audio">(() =>
  props.card.localVideoPath || props.card.animethemesVideoUrl ? "video" : "audio",
);

const src = computed(() =>
  quizType.value === "video"
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
  quizType.value === "video" ? videoRef.value : audioRef.value,
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

function onLoadedMetadata() {
  const el = activeEl.value;
  if (!el) return;

  if (Number.isFinite(el.duration)) {
    duration.value = el.duration;
    return;
  }

  // Some webm streams report an Infinity/NaN duration until the browser scans to
  // the end of the stream; seeking past the end forces that scan, then durationchange
  // reports the real value. Standard workaround for this browser quirk.
  el.addEventListener(
    "durationchange",
    () => {
      duration.value = Number.isFinite(el.duration) ? el.duration : 0;
      el.currentTime = 0;
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

function onSeek(event: MouseEvent) {
  const el = activeEl.value;
  if (!el || !Number.isFinite(duration.value) || !duration.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  el.currentTime = ratio * duration.value;
}
</script>

<template>
  <div class="player-card">
    <div class="player-frame">
      <span class="theme-badge">{{ card.themeSlot }}</span>

      <video
        v-if="quizType === 'video' && src"
        ref="videoRef"
        class="media-el"
        :src="src"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
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
      <div v-else-if="showVeil" class="veil">
        <div class="listening-icon">🎵</div>
        <p>{{ quizType === "audio" ? "Listening..." : "Paused" }}</p>
      </div>
    </div>

    <div class="player-controls">
      <button type="button" class="play-btn" :disabled="!!errorMessage" @click="togglePlay">
        {{ isPlaying ? "⏸" : "▶" }}
      </button>
      <div class="scrub" @click="onSeek">
        <span :style="{ width: progressPercent + '%' }" />
      </div>
      <span class="time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
    </div>
  </div>
</template>

<style scoped>
.player-card {
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
  backdrop-filter: blur(18px);
  background: rgba(10, 6, 15, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
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
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: var(--shadow-accent);
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
