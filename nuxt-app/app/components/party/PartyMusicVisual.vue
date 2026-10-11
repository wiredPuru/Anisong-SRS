<script setup lang="ts">
defineProps<{ playing: boolean }>();

const BARS = 40;

// Fixed per mount, so a re-render never reshuffles the animation.
const bars = Array.from({ length: BARS }, (_, i) => ({
  delay: -((i * 0.37) % 1.4),
  duration: 1.1 + ((i * 7) % 9) * 0.12,
  peak: 0.35 + ((i * 13) % 10) * 0.065,
}));
</script>

<template>
  <div class="music" :class="{ paused: !playing }" aria-hidden="true">
    <div class="bars">
      <span
        v-for="(bar, i) in bars"
        :key="`b${i}`"
        class="bar"
        :style="{ animationDelay: `${bar.delay}s`, animationDuration: `${bar.duration}s`, '--peak': bar.peak }"
      />
    </div>
  </div>
</template>

<style scoped>
.music {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--accent) 10%, var(--bg)), var(--bg) 75%);
}

.bars {
  width: 76%;
  height: 34%;
  display: flex;
  align-items: center;
  gap: 1%;
}

.bar {
  flex: 1;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(to top, var(--accent), var(--accent-secondary));
  opacity: 0.75;
  transform: scaleY(0.08);
  animation: bounce ease-in-out infinite alternate;
}

.paused .bar {
  animation-play-state: paused;
}

@keyframes bounce {
  from { transform: scaleY(0.08); }
  to { transform: scaleY(var(--peak)); }
}

@media (prefers-reduced-motion: reduce) {
  .bar { animation: none; transform: scaleY(0.35); }
}
</style>
