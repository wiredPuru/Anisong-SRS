<script setup lang="ts">
import { burstTravel, type BurstRect, type ScoreBurst } from "~/utils/scoreBurst";

const emit = defineEmits<{ landed: [points: number] }>();

interface LiveBurst extends ScoreBurst {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const SPARK_COUNT = 8;

// Hold time before a burst starts travelling, and how long the flight takes.
// The "Standard" preset from blueprint/reference/dynamic-scoring-feedback.
const HOLD_MS = 460;
const TRAVEL_MS = 520;

const live = ref<LiveBurst[]>([]);
const sparks = ref<Spark[]>([]);
const layer = ref<HTMLElement | null>(null);
let timers: ReturnType<typeof setTimeout>[] = [];
let sparkId = 0;

// Scripted travel cannot be turned off by a media query alone, so the
// preference is read here as well as in the stylesheet.
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scatterSparks(at: { x: number; y: number }) {
  const made: Spark[] = [];
  for (let i = 0; i < SPARK_COUNT; i += 1) {
    const angle = (Math.PI * 2 * i) / SPARK_COUNT + Math.random() * 0.5;
    const distance = 90 + Math.random() * 120;
    made.push({
      id: (sparkId += 1),
      x: at.x,
      y: at.y,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
    });
  }
  sparks.value = [...sparks.value, ...made];
  const ids = new Set(made.map((s) => s.id));
  timers.push(setTimeout(() => {
    sparks.value = sparks.value.filter((s) => !ids.has(s.id));
  }, 800));
}

function centre(rect: BurstRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function show(burst: LiveBurst) {
  live.value = [...live.value, burst];
  // A travelling burst reports its points on arrival so the score chip counts
  // up when the burst lands, not when the answer was graded.
  const lifetime = burst.travels ? HOLD_MS + TRAVEL_MS : HOLD_MS + 300;
  timers.push(setTimeout(() => {
    live.value = live.value.filter((b) => b.id !== burst.id);
    if (burst.travels && burst.points > 0) emit("landed", burst.points);
  }, lifetime));
}

function launch(plan: ScoreBurst[], refs: { origin: BurstRect; targetEl: HTMLElement | null }) {
  const target = refs.targetEl?.getBoundingClientRect();
  const from = centre(refs.origin);

  // Nothing flies, but the points still have to be credited, so every burst
  // that would have travelled reports its arrival straight away.
  if (prefersReducedMotion()) {
    for (const burst of plan) {
      if (burst.travels && burst.points > 0) emit("landed", burst.points);
    }
    return;
  }

  if (plan.some((burst) => burst.kind === "points")) scatterSparks(from);

  for (const burst of plan) {
    // Read the travel per burst rather than once: a bonus lands half a second
    // later, by which time the header may have reflowed.
    const travel = burst.travels && target ? burstTravel(refs.origin, target) : { dx: 0, dy: 0 };
    const stacked = burst.kind === "bonus" ? -70 : burst.kind === "combo" || burst.kind === "comboLost" ? 56 : 0;
    const entry: LiveBurst = { ...burst, x: from.x, y: from.y + stacked, dx: travel.dx, dy: travel.dy - stacked };
    if (burst.delayMs === 0) show(entry);
    else timers.push(setTimeout(() => show(entry), burst.delayMs));
  }
}

function cancel() {
  timers.forEach(clearTimeout);
  timers = [];
  live.value = [];
  sparks.value = [];
}

onUnmounted(cancel);

defineExpose({ launch, cancel });
</script>

<template>
  <div ref="layer" class="burst-layer" aria-hidden="true">
    <div
      v-for="burst in live"
      :key="burst.id"
      class="burst"
      :class="[burst.kind, { travels: burst.travels }]"
      :style="{
        left: `${burst.x}px`,
        top: `${burst.y}px`,
        '--dx': `${burst.dx}px`,
        '--dy': `${burst.dy}px`,
        '--hold': `${HOLD_MS}ms`,
        '--travel': `${TRAVEL_MS}ms`,
      }"
    >
      {{ burst.label }}<span v-if="burst.kind === 'points'" class="unit">pts</span>
    </div>
    <span
      v-for="spark in sparks"
      :key="`s${spark.id}`"
      class="spark"
      :style="{ left: `${spark.x}px`, top: `${spark.y}px`, '--sx': `${spark.dx}px`, '--sy': `${spark.dy}px` }"
    />
  </div>
</template>

<style scoped>
.burst-layer {
  position: fixed;
  inset: 0;
  z-index: var(--z-score-burst);
  overflow: hidden;
  pointer-events: none;
}

.burst {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  line-height: 1;
  white-space: nowrap;
  will-change: transform, opacity;
}

.points {
  color: var(--pass);
  font-size: clamp(38px, 6vw, 74px);
  text-shadow: 0 0 18px color-mix(in srgb, var(--pass) 55%, transparent),
    0 3px 0 color-mix(in srgb, var(--bg) 70%, transparent);
}

.unit {
  margin-left: 6px;
  font-family: var(--font-sans);
  font-size: 0.3em;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.8;
}

.miss {
  color: var(--fail);
  font-size: clamp(30px, 4.4vw, 52px);
  text-shadow: 0 0 18px color-mix(in srgb, var(--fail) 55%, transparent);
}

.bonus {
  padding: 3px 11px;
  border: 1px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent-secondary) 22%, var(--bg));
  color: var(--text);
  font: 600 14px var(--font-sans);
}

.combo,
.comboLost {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--warning);
  color: var(--warning-ink);
  font: 600 13px var(--font-sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.comboLost {
  background: var(--fail);
  color: var(--fail-ink);
}

.travels {
  animation: burst-travel calc(var(--hold) + var(--travel)) cubic-bezier(0.3, 0.9, 0.2, 1) forwards;
}

.burst:not(.travels) {
  animation: burst-fade calc(var(--hold) + 300ms) ease-out forwards;
}

/* Pops, holds long enough to read, then flies into the score chip. The
   translate has to repeat -50% because it replaces the base transform. */
@keyframes burst-travel {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.35); }
  13% { opacity: 1; transform: translate(-50%, -50%) scale(1.22); }
  22% { transform: translate(-50%, -50%) scale(1); }
  47% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  78% { opacity: 0.9; transform: translate(calc(-50% + var(--dx) * 0.55), calc(-50% + var(--dy) * 0.4)) scale(0.72); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.32); }
}

.spark {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--pass);
  box-shadow: 0 0 10px var(--pass);
  transform: translate(-50%, -50%);
  animation: spark-out 640ms cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
}

@keyframes spark-out {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to { opacity: 0; transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) scale(0.2); }
}

@keyframes burst-fade {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
  30% { transform: translate(-50%, -50%) scale(1); }
  65% { opacity: 1; transform: translate(-50%, -62%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -85%) scale(0.94); }
}

/* The scripted path already returns early; this covers the in-place fades if
   the preference changes after a burst is on screen. */
@media (prefers-reduced-motion: reduce) {
  .burst,
  .spark {
    animation: none;
    opacity: 0;
  }
}
</style>
