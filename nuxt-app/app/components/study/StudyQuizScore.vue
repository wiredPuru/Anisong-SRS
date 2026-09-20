<script setup lang="ts">
const props = defineProps<{
  score: number;
  combo: number;
  correct: number;
  answered: number;
}>();

// Exposed so Study's burst layer can measure where to fly points to. Read at
// launch time, never cached: the header wraps below 820px.
const chipEl = ref<HTMLElement | null>(null);

const COUNT_UP_MS = 480;
// If no burst reports its arrival within this long, the points came from
// somewhere that does not animate and the total catches up on its own rather
// than sitting stale.
const FALLBACK_SNAP_MS = 2000;

const displayScore = ref(props.score);
const landing = ref(false);
let frame: number | null = null;
let fallback: ReturnType<typeof setTimeout> | null = null;
let landingTimer: ReturnType<typeof setTimeout> | null = null;

function stopTween() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

/**
 * Credits one arriving burst. Counting up by the points that just landed,
 * rather than straight to the real total, is what lets a bonus arriving half
 * a second after the main burst still visibly add something: the first
 * arrival would otherwise absorb every pending point and leave the later one
 * landing on an already-correct number.
 */
function countUp(points?: number) {
  if (fallback) clearTimeout(fallback);
  fallback = null;
  stopTween();
  const from = displayScore.value;
  const to = points == null ? props.score : Math.min(props.score, from + points);

  landing.value = false;
  if (landingTimer) clearTimeout(landingTimer);
  void chipEl.value?.offsetWidth;
  landing.value = true;
  landingTimer = setTimeout(() => (landing.value = false), 420);

  // Points can still be in the air; make sure the chip catches up even if a
  // later burst never reports in.
  if (to < props.score) fallback = setTimeout(settle, FALLBACK_SNAP_MS);

  if (from === to) return;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    displayScore.value = to;
    return;
  }
  const started = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / COUNT_UP_MS);
    const eased = 1 - (1 - t) ** 3;
    displayScore.value = Math.round(from + (to - from) * eased);
    frame = t < 1 ? requestAnimationFrame(step) : null;
  };
  frame = requestAnimationFrame(step);
}

const breaking = ref(false);
let breakingTimer: ReturnType<typeof setTimeout> | null = null;

/** Marks a streak ending, so the combo reset is felt and not just read. */
function shake() {
  if (breakingTimer) clearTimeout(breakingTimer);
  breaking.value = false;
  void chipEl.value?.offsetWidth;
  breaking.value = true;
  breakingTimer = setTimeout(() => (breaking.value = false), 380);
}

/** Abandons any in-flight tween at the true total, never part-way. */
function settle() {
  stopTween();
  if (fallback) clearTimeout(fallback);
  fallback = null;
  displayScore.value = props.score;
}

watch(() => props.score, (value) => {
  if (value < displayScore.value) {
    settle();
    return;
  }
  if (fallback) clearTimeout(fallback);
  fallback = setTimeout(settle, FALLBACK_SNAP_MS);
});

onUnmounted(() => {
  stopTween();
  if (fallback) clearTimeout(fallback);
  if (landingTimer) clearTimeout(landingTimer);
  if (breakingTimer) clearTimeout(breakingTimer);
});

defineExpose({ chipEl, countUp, settle, shake });
</script>

<template>
  <div
    ref="chipEl"
    class="quiz-score"
    :class="{ landing, breaking }"
    :aria-label="`Typed answer session score: ${score.toLocaleString()} points, ${combo}x combo, ${correct} of ${answered} correct`"
  >
    <span class="score-stat">
      <small>Score</small>
      <strong>{{ displayScore.toLocaleString() }}</strong>
    </span>
    <span class="score-divider" aria-hidden="true" />
    <span class="score-stat" :class="{ hot: combo > 1 }">
      <small>Combo</small>
      <strong>{{ combo }}x</strong>
    </span>
    <span class="score-stat score-record">
      <small>Correct</small>
      <strong>{{ correct }}/{{ answered }}</strong>
    </span>
  </div>
</template>

<style scoped>
.quiz-score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 1 auto;
  flex-wrap: nowrap;
  gap: 10px;
  padding: 5px 10px;
  border: 1px solid color-mix(in srgb, var(--accent-secondary) 55%, var(--border));
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent-secondary) 8%, var(--surface));
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent-secondary-glow) 55%, transparent);
}

/* Fires as a burst arrives, so the chip reacts to the points landing rather
   than to the grade that was written half a second earlier. */
.quiz-score.landing {
  animation: score-landing 420ms cubic-bezier(0.2, 1.5, 0.35, 1);
}

@keyframes score-landing {
  0% { transform: scale(1); }
  38% {
    transform: scale(1.13);
    box-shadow: 0 0 30px color-mix(in srgb, var(--pass) 60%, transparent);
  }
  100% { transform: scale(1); }
}

.quiz-score.breaking {
  animation: score-breaking 380ms ease-out;
}

@keyframes score-breaking {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  45% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
}

.score-stat {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  min-width: 0;
  gap: 5px;
  white-space: nowrap;
}

small {
  color: var(--faint);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

strong {
  color: var(--accent-secondary);
  font-family: var(--font-display);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.score-divider {
  width: 1px;
  height: 22px;
  background: var(--border);
}

.hot strong {
  color: var(--warning);
  text-shadow: 0 0 12px color-mix(in srgb, var(--warning) 45%, transparent);
}

.score-record {
  display: grid;
}

@media (max-width: 820px) {
  .quiz-score {
    flex-wrap: wrap;
    max-width: 100%;
    gap: 4px 8px;
  }

  .score-stat {
    grid-template-columns: 1fr;
    gap: 0;
    text-align: center;
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .quiz-score.landing,
  .quiz-score.breaking {
    animation: none;
  }
}
</style>
