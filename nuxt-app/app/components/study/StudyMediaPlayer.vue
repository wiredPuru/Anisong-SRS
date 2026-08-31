<script setup lang="ts">
import type { CardWithDetails } from "~/composables/useStudySession";

const props = defineProps<{
  card: Pick<
    CardWithDetails,
    | "id"
    | "localVideoPath"
    | "localAudioPath"
    | "animethemesVideoUrl"
    | "animethemesAudioUrl"
    | "themeSlot"
    | "animeCoverImageUrl"
  >;
  hideVideo?: boolean;
  randomStart?: boolean;
  ambient?: boolean;
  allowExpand?: boolean;
  immersive?: boolean;
  hideThemeBadge?: boolean;
  hasDefaultDownloadFolder?: boolean;
  audioOnly?: boolean;
  hideCover?: boolean;
}>();
const emit = defineEmits<{
  "update:immersive": [boolean];
  "playback-started": [];
  "local-path-updated": [{ kind: "video" | "audio"; localPath: string }];
}>();

function mediaUrl(localPath: string | null, remoteUrl: string | null): string | null {
  if (localPath) return `/api/media?path=${encodeURIComponent(localPath)}`;
  if (remoteUrl) return `/api/media/stream?url=${encodeURIComponent(remoteUrl)}`;
  return null;
}

const hasVideoSource = computed(() => Boolean(props.card.localVideoPath || props.card.animethemesVideoUrl));
const hasAudioSource = computed(() => Boolean(props.card.localAudioPath || props.card.animethemesAudioUrl));

// Which element/src actually mounts - deliberately independent of hideVideo,
// so toggling it never swaps the underlying element mid-playback (that
// remount was resetting playback to paused, which felt like a bug). audioOnly
// is safe to read here too: callers resolve it once per page load, before
// this component ever mounts, and never change it reactively afterward - an
// earlier per-scope forced-mode feature swapped this mid-playback and caused
// overlapping audio, which is exactly what that constraint avoids. A card
// with no audio source at all still falls back to video even when audioOnly
// is on.
const mediaKind = computed<"video" | "audio">(() => {
  if (props.audioOnly && hasAudioSource.value) return "audio";
  return hasVideoSource.value ? "video" : "audio";
});

// Whether the video frame is actually shown. Hiding video (or audioOnly)
// always forces the audio-style veil, even when the video element keeps
// playing underneath for its own audio track (no separate audio source
// needed for this to work).
const quizType = computed<"video" | "audio">(() => (props.hideVideo || props.audioOnly ? "audio" : mediaKind.value));

// Shows the anime's cover image (and, in Step 2, sources the ambient glow
// from it) whenever no real <video> is mounted this session at all - a
// naturally audio-only card, or one the Audio Only setting forced there.
// Checks mediaKind, not quizType/hideVideo: mediaKind is deliberately
// unaffected by hideVideo, so a naturally audio-only card still gets its
// cover art even if hideVideo also happens to be on (nothing to hide there
// anyway) - while a genuinely video-capable card with Hide Video on keeps
// today's plain veil untouched, since mediaKind stays "video" for it.
const coverImageFailed = ref(false);
watch(
  () => props.card.animeCoverImageUrl,
  () => {
    coverImageFailed.value = false;
  },
);
const showCoverArt = computed(
  () =>
    mediaKind.value === "audio" &&
    !props.hideCover &&
    Boolean(props.card.animeCoverImageUrl) &&
    !coverImageFailed.value,
);

const src = computed(() =>
  mediaKind.value === "video"
    ? mediaUrl(props.card.localVideoPath, props.card.animethemesVideoUrl)
    : mediaUrl(props.card.localAudioPath, props.card.animethemesAudioUrl),
);

// Warms the stream cache for this card's remote clip as early as possible -
// on mount, and again if the card prop changes without a remount - so
// playback often finds it already cached by the time the user presses play.
// Client-only: onMounted never runs during SSR, and the watch below has no
// `immediate` so it only reacts to a genuine later change, not the initial value.
const prefetchUrl = computed(() => resolveRemotePrefetchUrl(props.card, props.audioOnly));

function triggerPrefetch(url: string | null) {
  if (!url) return;
  $fetch("/api/media/prefetch", { method: "POST", body: { url } }).catch(() => {});
}

onMounted(() => triggerPrefetch(prefetchUrl.value));
watch(prefetchUrl, (url) => triggerPrefetch(url));

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

// Clears a stale error the moment the media source actually changes - covers
// both a successful fallback download below (the new local path recomputes
// `src`) and `card` changing while this component stays mounted (it doesn't
// remount per card inside CardPreviewModal, unlike /study).
watch(src, () => {
  errorMessage.value = null;
});

const { downloading, downloadProgress, downloadError, downloadKey, canDownload, hasAnyDownloadableSource, downloadMedia } =
  useCardDownloads();

function downloadProgressPercent(kind: "video" | "audio"): number {
  const progress = downloadProgress[downloadKey(props.card.id, kind)];
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}

async function retryDownload(kind: "video" | "audio") {
  const result = await downloadMedia<{ localVideoPath: string | null; localAudioPath: string | null }>(
    props.card.id,
    props.card.id,
    kind,
  );
  if (!result) return;
  const localPath = kind === "video" ? result.localVideoPath : result.localAudioPath;
  if (localPath) emit("local-path-updated", { kind, localPath });
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
// doubling network/decode cost for remote animethemes.moe clips. When
// showCoverArt is active instead, samples the cover <img> already rendered
// in the frame the same way - one shared canvas, whichever source is on
// screen.
const ambientCanvasRef = ref<HTMLCanvasElement | null>(null);
const coverImageRef = ref<HTMLImageElement | null>(null);
let ambientInterval: ReturnType<typeof setInterval> | null = null;

const ambientActive = computed(
  () => Boolean(props.ambient) && (quizType.value === "video" || showCoverArt.value),
);

function drawAmbientFrame() {
  const canvas = ambientCanvasRef.value;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  if (showCoverArt.value) {
    const img = coverImageRef.value;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return;
  }

  const video = videoRef.value;
  if (!video || video.readyState < 2) return;
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
  // In CardPreviewModal, this canvas persists across a card change (no
  // remount there, unlike /study). If an earlier card drew the cross-origin
  // cover image onto it (showCoverArt), the canvas is now "tainted" and any
  // getImageData call throws a SecurityError - for the canvas's whole
  // lifetime, not just that one draw. Harmless to just stop retrying here
  // (same as any other reason this optimization can't run): onPlay's own
  // draw still takes over once real playback starts.
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return;
  }
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
    <div class="player-frame" :class="{ 'ambient-glass': ambient }">
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

      <div v-if="showCoverArt" class="record">
        <div class="record-disk" :class="{ spinning: isPlaying }">
          <img
            ref="coverImageRef"
            :src="card.animeCoverImageUrl!"
            alt=""
            class="record-label"
            @error="coverImageFailed = true"
          />
          <span class="record-hole" />
        </div>
      </div>

      <div v-if="errorMessage" class="veil error-veil">
        <p>{{ errorMessage }}</p>
        <div v-if="hasAnyDownloadableSource(card)" class="download-section">
          <div v-if="hasDefaultDownloadFolder" class="download-actions">
            <template v-if="canDownload(card, 'video')">
              <div v-if="downloading[downloadKey(card.id, 'video')]" class="download-progress">
                <div class="download-progress-bar">
                  <span :style="{ width: downloadProgressPercent('video') + '%' }" />
                </div>
                <span class="download-progress-label">{{
                  formatDownloadProgress(downloadProgress[downloadKey(card.id, "video")])
                }}</span>
              </div>
              <button v-else type="button" class="download-btn" @click="retryDownload('video')">Download video</button>
            </template>
            <template v-if="canDownload(card, 'audio')">
              <div v-if="downloading[downloadKey(card.id, 'audio')]" class="download-progress">
                <div class="download-progress-bar">
                  <span :style="{ width: downloadProgressPercent('audio') + '%' }" />
                </div>
                <span class="download-progress-label">{{
                  formatDownloadProgress(downloadProgress[downloadKey(card.id, "audio")])
                }}</span>
              </div>
              <button v-else type="button" class="download-btn" @click="retryDownload('audio')">Download audio</button>
            </template>
          </div>
          <p v-else class="download-hint">
            Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
          </p>
          <p v-if="downloadError[card.id]" class="download-error">{{ downloadError[card.id] }}</p>
        </div>
      </div>
      <div
        v-else-if="showVeil"
        class="veil"
        :class="quizType === 'audio' ? ['audio-veil', { 'has-cover': showCoverArt }] : 'paused-veil'"
        @click="togglePlay"
      >
        <div v-if="quizType === 'audio' && isPlaying && !showCoverArt" class="listening-icon">
          <span class="eq-bar" />
          <span class="eq-bar" />
          <span class="eq-bar" />
          <span class="eq-bar" />
        </div>
        <p v-if="!showCoverArt">{{ isPlaying ? "Listening..." : "Paused" }}</p>
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

/* The ambient glow canvas lives behind the whole page (Teleport to body,
   z-index: -1), but this frame's own opaque gradient - solid #120c19 as its
   last background layer - normally blocks it from showing through anywhere
   inside the player itself (letterboxing around a non-16:9 video, or the
   space around the record in audio mode). Dropping it while ambient mode
   is on lets that glow fill the frame too instead of stopping at its edges;
   .player-card's own translucent glass background (feature 24) already
   does the same for the space around the frame. Non-ambient mode is
   unaffected - the gradient stays exactly as it's always been. */
.player-frame.ambient-glass {
  background: transparent;
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

.record {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.record-disk {
  position: relative;
  width: 45%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle, rgba(255, 255, 255, 0.06) 0, rgba(255, 255, 255, 0.06) 1px, transparent 1px, transparent 6px),
    #0c0a10;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.6);
  animation: record-spin 3.6s linear infinite;
  animation-play-state: paused;
}

.record-disk.spinning {
  animation-play-state: running;
}

.record-label {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 64%;
  height: 64%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  object-fit: cover;
}

.record-hole {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8%;
  height: 8%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #120c19;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15);
}

@keyframes record-spin {
  to {
    transform: rotate(360deg);
  }
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

/* The record sits behind this veil (see the template's DOM order), and the
   veil's own gradient background is fully opaque (its last background
   layer is a solid color) - without this override the record would be
   completely hidden behind it, not just lacking contrast. Transparent
   here reveals .player-frame's own background gradient instead - the same
   look today's cover-less audio veil already uses, just with the record
   and text floating on top of it. */
.audio-veil.has-cover {
  background: transparent;
}

.error-veil {
  background: rgba(53, 15, 15, 0.6);
}

.error-veil p {
  color: var(--fail);
  padding: 0 24px;
  text-align: center;
}

.download-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.download-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.download-btn {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.download-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.download-progress-bar {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  overflow: hidden;
}

.download-progress-bar > span {
  display: block;
  height: 100%;
  background: var(--accent-secondary);
  transition: width 0.15s ease;
}

.download-progress-label {
  flex: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  min-width: 34px;
  text-align: right;
}

.download-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.download-hint a {
  color: var(--accent);
}

.download-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
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
