<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party" });

const REPORT_MS = 1000;

const { state, connected } = usePartyLiteDisplay();
// Browsers refuse to play sound before a click, so the screen asks for one.
const started = ref(false);
const blocked = ref(false);
const media = ref<HTMLMediaElement | null>(null);

const token = computed(() => state.value?.token ?? null);
const clipUrl = computed(() => (token.value ? `/api/party/display/lite/clip?t=${token.value}` : null));

function report(ended = false) {
  const element = media.value;
  if (!element || !token.value) return;
  const duration = Number.isFinite(element.duration) ? element.duration : null;
  void $fetch("/api/party/display/lite/position", {
    method: "POST",
    body: { token: token.value, time: element.currentTime, duration, ended },
  }).catch(() => {});
}

async function syncPlayback() {
  const element = media.value;
  if (!element || !started.value) return;
  if (!state.value?.playing) {
    element.pause();
    return;
  }
  try {
    await element.play();
    blocked.value = false;
  } catch (err) {
    // A newer load or pause interrupting play() is not the browser refusing.
    if ((err as { name?: string }).name === "NotAllowedError") blocked.value = true;
  }
}

watch([media, () => state.value?.playing, started], syncPlayback);
watch(() => state.value?.seekSeq, (seq, before) => {
  if (media.value && before !== undefined && seq !== before) media.value.currentTime = state.value!.seekTo;
});

function start() {
  started.value = true;
  blocked.value = false;
}

let reporter: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  reporter = setInterval(() => {
    if (media.value && !media.value.paused) report();
  }, REPORT_MS);
});
onBeforeUnmount(() => {
  if (reporter) clearInterval(reporter);
});
</script>

<template>
  <main class="display">
    <template v-if="state && clipUrl">
      <video
        v-if="state.kind === 'video'"
        :key="clipUrl"
        ref="media"
        class="clip"
        :src="clipUrl"
        playsinline
        preload="auto"
        @loadedmetadata="report()"
        @ended="report(true)"
      />
      <template v-else>
        <audio :key="clipUrl" ref="media" :src="clipUrl" preload="auto" @loadedmetadata="report()" @ended="report(true)" />
        <div class="veil">
          <p class="eyebrow">Audio only</p>
          <p class="headline">Listen...</p>
        </div>
      </template>

      <p class="counter">Song {{ state.played }}</p>

      <Transition name="reveal">
        <section v-if="state.answer" class="answer" aria-live="polite">
          <img v-if="state.answer.hasCover" class="cover" :src="`/api/party/display/lite/cover?t=${state.token}`" alt="" />
          <div>
            <p class="eyebrow">{{ formatThemeSlotLabel(state.answer.themeSlot) }}</p>
            <h1 class="anime">{{ state.answer.animeTitle }}</h1>
            <p class="song">{{ state.answer.songTitle }} · {{ state.answer.artistName }}</p>
          </div>
        </section>
      </Transition>
    </template>

    <div v-else class="veil">
      <p class="eyebrow">Guess the anime</p>
      <p class="headline">{{ state ? "Starting soon" : "Connecting..." }}</p>
      <p v-if="state" class="sub">Waiting for the host to start the first song</p>
    </div>

    <button v-if="!started || blocked" type="button" class="start" @click="start">
      <span class="start-title">Click to start</span>
      <span class="sub">The browser needs one click before it can play sound.</span>
    </button>
    <p v-if="state && !connected" class="lost" role="status">Reconnecting...</p>
  </main>
</template>

<style scoped>
.display {
  position: fixed;
  inset: 0;
  background: #000;
  overflow: hidden;
}

.clip {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.veil {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2vh;
  background: var(--page-bg);
  text-align: center;
}

.eyebrow {
  margin: 0;
  color: var(--faint);
  font-size: clamp(11px, 1.1vw, 20px);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.headline {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(32px, 4.4vw, 96px);
}

.sub {
  margin: 0;
  color: var(--muted);
  font-size: clamp(14px, 1.5vw, 30px);
}

.counter {
  position: absolute;
  top: 2.6vh;
  right: 1.8vw;
  margin: 0;
  padding: 0.5em 1em;
  border-radius: var(--radius-pill);
  background: var(--glass-surface-display);
  border: 1px solid var(--glass-border);
  font-size: clamp(13px, 1.1vw, 24px);
  font-weight: 600;
}

.answer {
  position: absolute;
  left: 2.5vw;
  bottom: 4.4vh;
  max-width: 70vw;
  display: flex;
  align-items: center;
  gap: 1.3vw;
  padding: 1.3vw 1.8vw 1.3vw 1.3vw;
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-soft);
}

.cover {
  width: clamp(60px, 5.8vw, 140px);
  aspect-ratio: 23 / 32;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.anime {
  margin: 0.1em 0;
  font-family: var(--font-display);
  font-size: clamp(24px, 2.8vw, 64px);
  line-height: 1.15;
}

.song {
  margin: 0;
  color: var(--muted);
  font-size: clamp(14px, 1.4vw, 32px);
}

.start {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  background: var(--scrim);
  color: var(--text);
  font-family: var(--font-sans);
  cursor: pointer;
}

.start-title {
  padding: 14px 34px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 20px;
  font-weight: 700;
}

.lost {
  position: absolute;
  left: 50%;
  top: 2.6vh;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: var(--glass-surface-panel);
  color: var(--warning);
  font-weight: 700;
}

.reveal-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.reveal-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

@media (prefers-reduced-motion: reduce) {
  .reveal-enter-active {
    transition: none;
  }
}
</style>
