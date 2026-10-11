<script setup lang="ts">
import { gradeParticles, type GradeParticleKind } from "~/utils/gradeParticles";

const props = defineProps<{ result: "pass" | "fail" }>();

const particles = computed(() => gradeParticles(props.result));
const GLYPHS: Record<GradeParticleKind, string> = { star: "✦", note: "♪", dot: "", drop: "" };
</script>

<template>
  <div class="grade-moment" :class="result" aria-hidden="true">
    <span class="ring" />
    <span class="ring ring-late" />
    <span
      v-for="(particle, i) in particles"
      :key="i"
      class="particle"
      :class="particle.kind"
      :style="{
        '--dx': `${particle.dx}px`,
        '--dy': `${particle.dy}px`,
        '--delay': `${particle.delayMs}ms`,
        '--size': `${particle.sizePx}px`,
        '--spin': `${particle.spinDeg}deg`,
      }"
    >{{ GLYPHS[particle.kind] }}</span>
    <div class="moment-kai">
      <MascotKai :pose="result === 'pass' ? 'cheer' : 'slump'" size="companion" />
      <p class="kai-banner" :class="result === 'pass' ? 'kai-banner-pass' : 'kai-banner-fail'">
        {{ result === "pass" ? "Correct!" : "Wrong..." }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Plays over the player after any grade, manual or typed, then the page removes
   it. Every piece shares one grid cell at the centre, so the rings, the
   particles and Kai start from the same spot. Never takes a click. */
.grade-moment {
  --tone: var(--pass);
  position: absolute;
  inset: 0;
  /* Above the flipped details card (z-index 8), which a grade reveals over the player. */
  z-index: 9;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.grade-moment.fail {
  --tone: var(--fail);
}

.ring,
.particle,
.moment-kai {
  grid-area: 1 / 1;
}

.ring {
  width: 220px;
  height: 220px;
  border: 5px solid var(--tone);
  border-radius: 50%;
  opacity: 0;
  animation: ring-out 800ms ease-out forwards;
}

.ring-late {
  animation-delay: 160ms;
}

.particle {
  display: block;
  font-size: var(--size);
  line-height: 1;
  opacity: 0;
  animation: particle-out 900ms cubic-bezier(0.2, 0.8, 0.3, 1) var(--delay) forwards;
}

.particle.star {
  color: var(--star);
}

.particle.note {
  color: var(--accent);
}

.particle.dot {
  width: calc(var(--size) * 0.6);
  height: calc(var(--size) * 0.6);
  border-radius: 50%;
  background: var(--pass);
}

.particle.drop {
  width: calc(var(--size) * 0.7);
  height: var(--size);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: var(--fail);
  animation-name: particle-fall;
  animation-duration: 1100ms;
  animation-timing-function: cubic-bezier(0.25, 0.8, 0.4, 1);
}

.moment-kai {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: moment-pop 1400ms cubic-bezier(0.2, 1.3, 0.3, 1) forwards;
}

.grade-moment.fail .moment-kai {
  animation-name: moment-droop;
}

.moment-kai :deep(.mascot-kai) {
  height: 120px;
  margin-bottom: -10px;
}

.kai-banner {
  font-size: 28px;
}

@keyframes ring-out {
  0% { opacity: 0.9; transform: scale(0.3); }
  100% { opacity: 0; transform: scale(2.6); }
}

@keyframes particle-out {
  0% { opacity: 0; transform: translate(0, 0) scale(0.4) rotate(0); }
  12% { opacity: 1; }
  65% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--spin)); }
}

@keyframes particle-fall {
  0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  15% { opacity: 0.95; }
  70% { opacity: 0.95; }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1); }
}

@keyframes moment-pop {
  0% { opacity: 0; transform: scale(0.5) rotate(-8deg); }
  16% { opacity: 1; transform: scale(1.06) rotate(2deg); }
  26% { transform: scale(1) rotate(0); }
  82% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-4%); }
}

@keyframes moment-droop {
  0% { opacity: 0; transform: translateY(-12%); }
  18% { opacity: 1; transform: translateY(4%); }
  26% { transform: translateY(0); }
  82% { opacity: 1; }
  100% { opacity: 0; transform: translateY(4%); }
}

@media (prefers-reduced-motion: reduce) {
  .ring,
  .particle {
    display: none;
  }

  .moment-kai,
  .grade-moment.fail .moment-kai {
    animation: moment-fade 1400ms linear forwards;
  }

  @keyframes moment-fade {
    0%, 82% { opacity: 1; }
    100% { opacity: 0; }
  }
}
</style>
