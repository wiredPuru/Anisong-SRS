<script setup lang="ts">
import type { PartyScorePop } from "~/composables/usePartySettledScores";

defineProps<{ pops: PartyScorePop[] }>();

// A pop lands somewhere different each time. Seeded by its key, so a
// re-render never moves it mid-animation.
function place(key: number): Record<string, string> {
  const seed = (n: number) => {
    const x = Math.sin((key + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    left: `${12 + seed(1) * 66}%`,
    top: `${14 + seed(2) * 62}%`,
    "--tilt": `${(seed(3) - 0.5) * 18}deg`,
    "--drift": `${-(3 + seed(4) * 5)}vh`,
    "--size": `${0.85 + seed(5) * 0.5}`,
  };
}
</script>

<template>
  <div class="score-pops" aria-live="polite">
    <p v-for="pop in pops" :key="pop.key" class="kai-banner kai-banner-pass score-pop" :style="place(pop.key)">
      <span class="score-pop-points">{{ pop.points > 0 ? `+${pop.points}` : pop.points }}</span>
      <span class="score-pop-name">{{ pop.name }}</span>
    </p>
  </div>
</template>

<style scoped>
.score-pops {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.score-pop {
  position: absolute;
  display: flex;
  align-items: baseline;
  gap: 0.35em;
  margin: 0;
  font-size: calc(clamp(30px, 4.2vw, 7vh) * var(--size));
  text-transform: none;
  white-space: nowrap;
  animation: score-pop 2600ms ease-out both;
}

.score-pop-name {
  font-size: 0.5em;
  color: var(--text);
}

@keyframes score-pop {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(var(--tilt));
  }
  14% {
    opacity: 1;
    transform: scale(1.2) rotate(var(--tilt));
  }
  26% {
    transform: scale(1) rotate(var(--tilt));
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(var(--drift)) scale(1) rotate(var(--tilt));
  }
}

@media (prefers-reduced-motion: reduce) {
  .score-pop {
    animation: score-pop-fade 2600ms linear both;
  }

  @keyframes score-pop-fade {
    0%, 80% { opacity: 1; }
    100% { opacity: 0; }
  }
}
</style>
