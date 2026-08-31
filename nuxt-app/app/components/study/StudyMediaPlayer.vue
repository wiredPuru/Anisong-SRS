<script setup lang="ts">
import type { CardWithDetails } from "~/composables/useStudySession";

const props = defineProps<{
  card: Pick<CardWithDetails, "localVideoPath" | "localAudioPath" | "animethemesVideoUrl" | "animethemesAudioUrl" | "themeSlot">;
  hideVideo?: boolean;
  randomStart?: boolean;
  ambient?: boolean;
  allowExpand?: boolean;
  immersive?: boolean;
  hideThemeBadge?: boolean;
}>();
const emit = defineEmits<{ "update:immersive": [boolean]; "playback-started": [] }>();

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
const isDragging = ref(false);

const VOLUME_STORAGE_KEY = "gaqSrs:playerVolume";
const volume = ref(1);

onMounted(() => {
  try {
    const stored = Number(localStorage.getItem(VOLUME_STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= 0 && stored <= 1) {
      volume.value = stored;
    }
  } catch {
    // localStorage unavailable (private browsing, locked-down environment) -
    // falls back to the default volume for this session.
  }
});

watch(volume, (value) => {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
  } catch {
    // localStorage unavailable - the slider still works for this session, it
    // just won't persist.
  }
});

const { height: navHeight } = useNavHeight();

const activeEl = computed<HTMLMediaElement | null>(() =>
  mediaKind.value === "video" ? videoRef.value : audioRef.value,
);

// mediaKind can change after mount and after playback has started: forcedMode
// (a scope's quiz-mode preference) loads asynchronously and can resolve after
// the user hits play. When that happens, Vue swaps the mounted <video>/<audio>
// element - but nothing else stops the outgoing one first, and some browsers
// keep a removed media element's audio playing in the background. This runs
// in Vue's default "pre" flush, before that DOM swap, so the ref below still
// points at the outgoing element when we pause it.
watch(mediaKind, () => {
  videoRef.value?.pause();
  audioRef.value?.pause();
  isPlaying.value = false;
  currentTime.value = 0;
  duration.value = 0;
});

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
  const safeRange = resolvedDuration - 15;
  return safeRange > 0 ? Math.random() * safeRange : Math.random() * resolvedDuration;
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

// "play" fires as soon as playback is requested, even while a remote clip is
// still buffering; "playing" fires once frames/audio are actually rendering.
function onPlaying() {
  emit("playback-started");
}

function onPause() {
  isPlaying.value = false;
  stopAmbientLoop();
}

function onSeeked() {
  if (ambientActive.value) drawAmbientFrame();
}

function onLoadedData() {
  retryAmbientPreload(4);
}

// readyState reaching HAVE_CURRENT_DATA (the loadeddata event) doesn't
// guarantee the frame is actually blittable to canvas yet - empirically,
// drawImage can still read back fully transparent immediately at that
// event, with no fixed delay before it starts working (varies by
// codec/source). Draw, then check whether it actually produced content
// (any non-zero alpha) rather than trusting the event alone; if not,
// retry briefly. Harmless if it never succeeds before playback starts -
// onPlay's own draw takes over as before.
function retryAmbientPreload(retriesLeft: number) {
  if (!ambientActive.value) return;
  drawAmbientFrame();
  if (retriesLeft <= 0) return;
  const canvas = ambientCanvasRef.value;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return;
  }
  setTimeout(() => retryAmbientPreload(retriesLeft - 1), 150);
}

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (event.key.toLowerCase() === "s") {
    togglePlay();
  } else if (event.key === "Escape" && props.immersive) {
    emit("update:immersive", false);
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function seekToClientX(clientX: number, rect: DOMRect) {
  const el = activeEl.value;
  if (!el || !Number.isFinite(duration.value) || !duration.value) return;
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const time = ratio * duration.value;
  el.currentTime = time;
  currentTime.value = time;
}

let stopDrag: (() => void) | null = null;

function onScrubMouseDown(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  isDragging.value = true;
  seekToClientX(event.clientX, rect);

  function onMouseMove(e: MouseEvent) {
    seekToClientX(e.clientX, rect);
  }
  function onMouseUp() {
    isDragging.value = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    stopDrag = null;
  }

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  stopDrag = onMouseUp;
}

onUnmounted(() => stopDrag?.());
</script>

<template>
  <Teleport to="body">
    <canvas v-if="ambientActive" ref="ambientCanvasRef" width="40" height="22" class="ambient-glow" aria-hidden="true" />
  </Teleport>
  <div
    class="player-card"
    :class="{ expanded: immersive, 'ambient-glass': ambient }"
    :style="{ '--nav-height': `${navHeight}px` }"
    @click.self="emit('update:immersive', false)"
  >
    <div class="player-frame">
      <span v-if="!hideThemeBadge" class="theme-badge">{{ card.themeSlot }}</span>
      <button
        v-if="allowExpand"
        type="button"
        class="expand-btn"
        :aria-label="immersive ? 'Collapse' : 'Expand'"
        @click="emit('update:immersive', !immersive)"
      >
        {{ immersive ? "⤡" : "⤢" }}
        <span class="tooltip">Hotkey: E</span>
      </button>

      <video
        v-if="mediaKind === 'video' && src"
        ref="videoRef"
        class="media-el"
        :src="src"
        :volume="volume"
        @play="onPlay"
        @playing="onPlaying"
        @pause="onPause"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @loadeddata="onLoadedData"
        @seeked="onSeeked"
        @error="onError"
        @click="togglePlay"
      />
      <audio
        v-else-if="src"
        ref="audioRef"
        class="hidden-audio"
        :src="src"
        :volume="volume"
        @play="onPlay"
        @playing="onPlaying"
        @pause="onPause"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @error="onError"
      />

      <div v-if="errorMessage" class="veil error-veil">
        <p>{{ errorMessage }}</p>
      </div>
      <div
        v-else-if="showVeil"
        class="veil"
        :class="quizType === 'audio' ? 'audio-veil' : 'paused-veil'"
        @click="togglePlay"
      >
        <div v-if="quizType === 'audio' && isPlaying" class="listening-icon">
          <span class="eq-bar" />
          <span class="eq-bar" />
          <span class="eq-bar" />
          <span class="eq-bar" />
        </div>
        <p>{{ isPlaying ? "Listening..." : "Paused" }}</p>
      </div>

      <div class="player-controls">
        <button type="button" class="play-btn" :disabled="!!errorMessage" @click="togglePlay">
          {{ isPlaying ? "⏸" : "▶" }}
          <span class="tooltip">Hotkey: S</span>
        </button>
        <div class="scrub" :class="{ dragging: isDragging }" @mousedown="onScrubMouseDown">
          <span :style="{ width: progressPercent + '%' }" />
        </div>
        <span class="time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        <div class="volume-control">
          <span class="volume-icon" aria-hidden="true">🔊</span>
          <input v-model.number="volume" type="range" class="volume-slider" min="0" max="1" step="0.01" aria-label="Volume" />
        </div>
      </div>

      <slot v-if="immersive" name="immersive" />
    </div>
  </div>
</template>

<style scoped>
:global(.ambient-glow) {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  filter: blur(80px) saturate(1.6) brightness(0.9);
  opacity: 0.55;
  pointer-events: none;
}

.player-card {
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
}

.player-card.ambient-glass {
  background: var(--glass-surface);
  border-color: var(--glass-border);
  backdrop-filter: var(--glass-blur);
}

.player-card.expanded {
  position: fixed;
  top: var(--nav-height);
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  border-radius: 0;
  padding: 0;
}

.player-card.expanded .player-frame {
  width: min(90vw, calc((100vh - var(--nav-height)) * 0.9 * 16 / 9));
  height: auto;
}

.expand-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
  z-index: 3;
}

/* Opens downward, not upward like .play-btn's tooltip - .expand-btn sits at
   the very top of .player-frame, so an upward tooltip has nowhere to go
   before hitting the frame's overflow: hidden. */
.expand-btn .tooltip {
  top: calc(100% + 8px);
  bottom: auto;
}

.expand-btn:hover .tooltip,
.expand-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}

/* Expanded-only: the base rules above stay fixed-px for the normal card
   (Preview, non-immersive /study), where the frame's size doesn't vary
   enough to need it. In expanded mode the frame can range from a small
   phone width to a wide desktop, so these scale in cqw against
   .player-frame's own rendered width instead, matching the rest of the
   immersive overlay (StudyInfoPanel's .info-card.overlay, study/index.vue's
   .answer-slot) - otherwise a fixed-size badge/button can visually overlap
   the proportionally-scaled info card beneath them on a narrow frame.
   Multipliers are calibrated against the same ~1450px reference frame those
   rules use, so today's default look is unchanged. */
.player-card.expanded .expand-btn {
  top: clamp(10px, 1.1cqw, 26px);
  right: clamp(10px, 1.1cqw, 26px);
  width: clamp(23px, 2.48cqw, 58px);
  height: clamp(23px, 2.48cqw, 58px);
  font-size: clamp(10px, 1.1cqw, 26px);
}

.player-card.expanded .expand-btn .tooltip {
  top: calc(100% + clamp(5px, 0.55cqw, 13px));
  padding: clamp(3px, 0.28cqw, 6px) clamp(6px, 0.69cqw, 16px);
  font-size: clamp(8px, 0.83cqw, 19px);
}

.player-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-sm);
  overflow: hidden;
  /* Lets immersive-overlay content (info card, language toggles, Pass/Fail
     buttons) size itself in cqw against this frame's actual rendered width
     rather than the raw viewport - the frame's width already accounts for
     both the 90vw cap and the height-derived cap (see .player-card.expanded
     .player-frame above), so cqw tracks whichever constraint is active. */
  container-type: inline-size;
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
  cursor: pointer;
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

/* Expanded-only proportional override - see the comment on
   .player-card.expanded .expand-btn above for why. */
.player-card.expanded .theme-badge {
  top: clamp(10px, 1.1cqw, 26px);
  left: clamp(10px, 1.1cqw, 26px);
  padding: clamp(4px, 0.41cqw, 10px) clamp(9px, 0.97cqw, 23px);
  font-size: clamp(8px, 0.9cqw, 21px);
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
  cursor: pointer;
}

.audio-veil {
  background:
    radial-gradient(120% 120% at 30% 20%, rgba(255, 93, 162, 0.35), transparent 55%),
    radial-gradient(120% 120% at 80% 80%, rgba(177, 140, 255, 0.35), transparent 55%),
    #120c19;
  cursor: pointer;
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
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(to top, rgba(10, 6, 14, 0.85), transparent);
}

/* Expanded-only proportional override - same rationale as the badge/expand
   button above (see that comment): .player-controls stays fixed-px height
   at every frame size, but study/index.vue's .answer-slot (Pass/Fail bar)
   sits above it at a proportional bottom offset, so a fixed controls bar
   can grow taller than that offset's shrinking clearance on a small frame
   and visually overlap it. Scales the whole bar (and its children below)
   in lockstep with the rest of the immersive overlay instead. */
.player-card.expanded .player-controls {
  gap: clamp(9px, 0.97cqw, 22px);
  padding: clamp(9px, 0.97cqw, 22px) clamp(10px, 1.1cqw, 26px);
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

.player-card.expanded .play-btn {
  width: clamp(31px, 3.31cqw, 77px);
  height: clamp(31px, 3.31cqw, 77px);
  font-size: clamp(11px, 1.24cqw, 29px);
}

.player-card.expanded .play-btn .tooltip {
  bottom: calc(100% + clamp(5px, 0.55cqw, 13px));
  padding: clamp(3px, 0.28cqw, 6px) clamp(6px, 0.69cqw, 16px);
  font-size: clamp(8px, 0.83cqw, 19px);
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
  transition: height 0.15s ease;
}

.scrub:hover,
.scrub.dragging {
  height: 12px;
}

.player-card.expanded .scrub {
  height: clamp(5px, 0.48cqw, 11px);
}

.player-card.expanded .scrub:hover,
.player-card.expanded .scrub.dragging {
  height: clamp(8px, 0.83cqw, 19px);
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

.player-card.expanded .time {
  font-size: clamp(9px, 0.97cqw, 22px);
  min-width: clamp(49px, 5.24cqw, 122px);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.volume-icon {
  font-size: 14px;
}

.player-card.expanded .volume-icon {
  font-size: clamp(9px, 0.97cqw, 22px);
}

.volume-slider {
  width: 90px;
  accent-color: var(--accent-secondary);
  cursor: pointer;
}

.player-card.expanded .volume-slider {
  width: clamp(58px, 6.21cqw, 144px);
}
</style>
