<script setup lang="ts">
import type { KaiPose } from "~/components/mascot/MascotKai.vue";

type Mood = "ready" | "paused" | "listening" | "guess" | "loading" | "error";

const props = defineProps<{ mood: Mood; text?: string }>();

const POSES: Record<Mood, KaiPose> = {
  // The sheet's own "ready" pose is cut where it leans behind a box, so a
  // fully drawn pose stands in.
  ready: "wave",
  paused: "shy",
  listening: "clap",
  guess: "think",
  loading: "peek",
  error: "slump",
};

const pose = computed(() => POSES[props.mood]);
</script>

<template>
  <div class="player-kai" :class="`mood-${mood}`">
    <template v-if="mood === 'loading'">
      <div class="loading-stack">
        <img class="kai kai-peek" :src="`/mascot/kai-${pose}.webp`" alt="" draggable="false" />
        <span class="loading-bar" aria-hidden="true"><span /></span>
      </div>
      <div class="loading-message"><slot /></div>
    </template>
    <template v-else>
      <span v-if="mood === 'listening'" class="notes" aria-hidden="true">
        <span>♪</span><span>♫</span><span>♪</span>
      </span>
      <img class="kai" :src="`/mascot/kai-${pose}.webp`" alt="" draggable="false" />
      <p v-if="text || $slots.default" class="speech">
        <slot>{{ text }}</slot>
      </p>
    </template>
  </div>
</template>

<style scoped>
/* Every cutout on the sheet is a bust whose cut edge hides behind a banner,
   desk or bar, so Kai stands on the veil's bottom edge rather than floating
   mid-frame: --kai-bottom (set by StudyMediaPlayer's .veil) puts her lower
   edge inside the playback bar or the answer boxes, which paint above the
   veil and cover it. Her height comes from the veil's --kai-height (12cqw,
   about a fifth of the 16:9 frame), sized against .player-frame's container
   so she scales with Preview's expanded mode too. */
.player-kai {
  position: absolute;
  left: 50%;
  bottom: var(--kai-bottom, 40px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(4px, 1cqw, 16px);
  max-width: 92%;
  transform: translateX(-50%);
}

.kai {
  flex: none;
  display: block;
  height: var(--kai-height, clamp(52px, 12cqw, 160px));
  max-height: var(--kai-max-height, none);
  width: auto;
  user-select: none;
}

/* Lifted by the same amount Kai sinks behind the bar, so the bubble itself
   never goes under it. */
.speech {
  position: relative;
  margin: 0 0 calc(var(--kai-sink, 28px) + clamp(4px, 1.4cqw, 20px));
  padding: clamp(6px, 1.1cqw, 16px) clamp(14px, 2.4cqw, 34px);
  border-radius: var(--radius);
  border: 2px solid var(--outline);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-display);
  font-size: clamp(12px, 1.9cqw, 26px);
  white-space: nowrap;
  box-shadow: var(--shadow-soft);
}

/* the speech tail, pointing back at Kai on the left */
.speech::before {
  content: "";
  position: absolute;
  left: -9px;
  bottom: 30%;
  width: 14px;
  height: 14px;
  background: var(--surface);
  border-left: 2px solid var(--outline);
  border-bottom: 2px solid var(--outline);
  transform: rotate(45deg);
}

/* Off to the side so a playing video's middle stays clear. */
.mood-listening {
  left: 5%;
  transform: none;
}

/* The error message and its buttons stay centred; Kai slumps in the corner. */
.mood-error {
  left: 5%;
  transform: none;
}

.mood-error .kai {
  height: clamp(40px, 10cqw, 130px);
}

/* Loading keeps its own bar to peek over, centred in normal flow. */
.mood-loading {
  position: relative;
  left: auto;
  bottom: auto;
  transform: none;
}

.notes {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  pointer-events: none;
}

.notes span {
  position: absolute;
  color: var(--note);
  font-size: clamp(14px, 2.6cqw, 34px);
  animation: note-float 2.4s ease-in-out infinite;
}

.notes {
  bottom: calc(var(--kai-sink, 28px) + clamp(30px, 9cqw, 120px));
  top: auto;
}

.notes span:nth-child(1) {
  left: 4%;
  top: 10%;
}

.notes span:nth-child(2) {
  left: 30%;
  top: -8%;
  color: var(--star);
  animation-delay: 0.8s;
}

.notes span:nth-child(3) {
  right: 2%;
  top: 20%;
  animation-delay: 1.6s;
}

@keyframes note-float {
  0%,
  100% {
    transform: translateY(0) rotate(-8deg);
    opacity: 0.55;
  }
  50% {
    transform: translateY(-10px) rotate(8deg);
    opacity: 1;
  }
}

.mood-loading {
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 1cqw, 14px);
}

.loading-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: clamp(160px, 34cqw, 440px);
}

/* Kai's hands rest on the bar's top edge, as on the sheet. */
.kai-peek {
  height: auto;
  width: 78%;
  margin-bottom: -3px;
}

.loading-bar {
  display: block;
  width: 100%;
  height: clamp(12px, 1.8cqw, 24px);
  border-radius: var(--radius-pill);
  border: 2px solid var(--outline);
  background: var(--surface);
  overflow: hidden;
}

.loading-bar span {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, var(--note), var(--accent));
  animation: loading-slide 1.4s ease-in-out infinite;
}

@keyframes loading-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

.loading-message {
  max-width: 100%;
  padding: 6px 16px;
  border-radius: var(--radius-pill);
  background: var(--veil-status);
  color: var(--text);
  font-size: clamp(12px, 1.4cqw, 18px);
  font-weight: 700;
  letter-spacing: 1px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .notes span,
  .loading-bar span {
    animation: none;
  }

  .loading-bar span {
    width: 100%;
    opacity: 0.5;
  }
}
</style>
