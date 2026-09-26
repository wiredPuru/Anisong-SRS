<script setup lang="ts">
import type { KaiPose } from "~/components/mascot/MascotKai.vue";

type Mood = "ready" | "paused" | "listening" | "loading" | "error";

const props = defineProps<{ mood: Mood; text?: string }>();

const POSES: Record<Mood, KaiPose> = {
  ready: "ready",
  paused: "shy",
  listening: "clap",
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
/* Sized in cqw against .player-frame (a size container), so Kai scales with
   Preview's expanded mode the same way the rest of the player's overlay does. */
.player-kai {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(4px, 1cqw, 16px);
  max-width: 92%;
}

.kai {
  flex: none;
  display: block;
  height: clamp(56px, 17cqw, 220px);
  width: auto;
  user-select: none;
}

.speech {
  position: relative;
  margin: 0 0 clamp(10px, 3cqw, 40px);
  padding: clamp(6px, 1.1cqw, 16px) clamp(14px, 2.4cqw, 34px);
  border-radius: var(--radius);
  border: 2px solid var(--outline);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-display);
  font-size: clamp(13px, 2.3cqw, 30px);
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

/* The ready pose is cut off where she leans on the sheet's speech box, so the
   box sits flush against that edge instead of pointing a tail at her. */
.mood-ready {
  align-items: center;
  gap: 0;
}

.mood-ready .speech {
  margin: 0;
  border-left-width: 4px;
}

.mood-ready .speech::before {
  display: none;
}

.mood-error {
  flex-direction: column;
  align-items: center;
}

.mood-error .kai {
  height: clamp(48px, 13cqw, 170px);
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
