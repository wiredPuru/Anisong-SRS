<script setup lang="ts">
const props = defineProps<{
  themeSlot: string;
  animeTitleEnglish: string;
  animeTitleNative: string;
  songTitle: string;
  artistName: string;
  coverImageUrl: string | null;
  // Placeholders only while hidden, so no answer is in the DOM for a screen
  // reader or Migaku to read out early.
  hidden: boolean;
  hiddenLine?: string;
  revealable?: boolean;
  // Seconds until Auto Reveal shows the answer; null when no countdown runs.
  countdownSeconds?: number | null;
  // The card is flipped to its details, which already show the info, so the
  // bar offers the way back to the video instead.
  onDetails?: boolean;
  // A graded round tints the whole bar green or red.
  result?: "pass" | "fail" | null;
}>();

const emit = defineEmits<{ reveal: []; watchVideo: [] }>();

const coverFailed = ref(false);
watch(() => props.coverImageUrl, () => (coverFailed.value = false));

const native = computed(() =>
  props.animeTitleNative && props.animeTitleNative !== props.animeTitleEnglish ? props.animeTitleNative : null,
);
</script>

<template>
  <section class="now-playing" :class="result ? `result-${result}` : null" :aria-label="hidden ? 'Now playing, answer hidden' : 'Now playing'">
    <div v-if="onDetails" class="np-art" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M5 4l14 8-14 8z" /></svg>
    </div>
    <div v-else class="np-art" :class="{ revealed: !hidden && coverImageUrl && !coverFailed }" aria-hidden="true">
      <img v-if="!hidden && coverImageUrl && !coverFailed" :src="coverImageUrl" alt="" @error="coverFailed = true" />
      <span v-else-if="hidden">?</span>
      <svg v-else viewBox="0 0 24 24"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
    </div>
    <div class="np-text">
      <template v-if="onDetails">
        <p class="np-title">Keep watching?</p>
        <p class="np-sub">The clip is still playing behind the details.</p>
        <button type="button" class="np-watch" @click="emit('watchVideo')">
          Back to the video <kbd>D</kbd>
        </button>
      </template>
      <template v-else-if="hidden">
        <p class="np-title">Now playing</p>
        <p v-if="countdownSeconds != null" class="np-sub np-countdown">
          Revealing in <strong>{{ countdownSeconds }}</strong>
        </p>
        <p v-else class="np-sub">{{ hiddenLine ?? "Answer hidden" }}</p>
        <button
          v-if="revealable"
          type="button"
          class="np-reveal"
          aria-label="Reveal song information"
          @click="emit('reveal')"
          @keydown.enter.stop
          @keydown.space.stop
        />
      </template>
      <template v-else>
        <p class="np-title">{{ animeTitleEnglish }}</p>
        <p v-if="native" class="np-native" lang="ja">{{ native }}</p>
        <p class="np-sub">{{ songTitle }} &middot; {{ artistName }} &middot; {{ formatThemeSlotLabel(themeSlot) }}</p>
      </template>
    </div>
    <div class="np-main">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/* The music-player bar under the video: what is playing on the left, the
   round's one control on the right. Answers live here rather than over the
   picture so the clip is never covered while it plays. */
.now-playing {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(11rem, 22rem) minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 92px;
  padding: 12px 14px 12px 12px;
  border-radius: 22px;
  border: 1px solid var(--border);
  background: rgba(14, 14, 17, 0.86);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  color: var(--text);
}

.now-playing.result-pass {
  border-color: var(--pass);
  background: linear-gradient(0deg, rgba(126, 224, 161, 0.18), rgba(126, 224, 161, 0.18)), rgba(14, 14, 17, 0.86);
}

.now-playing.result-fail {
  border-color: var(--fail);
  background: linear-gradient(0deg, rgba(255, 138, 138, 0.18), rgba(255, 138, 138, 0.18)), rgba(14, 14, 17, 0.86);
}

.np-art {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
  font: 700 28px var(--font-display);
  overflow: hidden;
}

.np-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.np-art svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.np-text {
  position: relative;
  min-width: 0;
}

.np-text p {
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.np-title {
  font: 700 19px var(--font-display);
  letter-spacing: -0.01em;
}

.np-native {
  margin-top: 2px;
  color: var(--muted);
  font-size: 14px;
}

.np-sub {
  margin-top: 4px;
  color: var(--muted);
  font-size: 14px;
}

.np-countdown {
  color: var(--accent);
  font-weight: 700;
}

.np-countdown strong {
  font-variant-numeric: tabular-nums;
}

.np-watch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  font: 700 13px var(--font-sans);
  cursor: pointer;
}

.np-watch:hover {
  background: rgba(255, 255, 255, 0.12);
}

.np-watch kbd {
  padding: 0 5px;
  border-radius: 5px;
  border: 1px solid currentColor;
  font: 700 11px var(--font-sans);
  opacity: 0.6;
}

.np-reveal {
  position: absolute;
  inset: -6px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
}

.np-reveal:hover {
  background: rgba(255, 255, 255, 0.05);
}

.np-main {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

@media (max-width: 900px) {
  .now-playing {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .np-main {
    grid-column: 1 / -1;
  }
}
</style>
