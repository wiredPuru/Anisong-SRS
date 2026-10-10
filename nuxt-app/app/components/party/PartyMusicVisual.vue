<script setup lang="ts">
defineProps<{ playing: boolean }>();

const BARS = 28;
const NOTES = ["♪", "♫", "♩", "♬"];
const NOTE_COUNT = 14;

// Fixed per mount, so a re-render never reshuffles the animation.
const bars = Array.from({ length: BARS }, (_, i) => ({
  delay: -((i * 0.37) % 1.4),
  duration: 0.7 + ((i * 7) % 9) * 0.09,
  peak: 0.35 + ((i * 13) % 10) * 0.065,
}));
const notes = Array.from({ length: NOTE_COUNT }, (_, i) => ({
  glyph: NOTES[i % NOTES.length],
  left: 4 + ((i * 53) % 92),
  size: 2.4 + ((i * 5) % 6) * 0.7,
  delay: -((i * 1.9) % 9),
  duration: 7 + ((i * 3) % 6),
  sway: ((i * 17) % 7) - 3,
}));
</script>

<template>
  <div class="music" :class="{ paused: !playing }" aria-hidden="true">
    <span
      v-for="(note, i) in notes"
      :key="`n${i}`"
      class="note"
      :style="{ left: `${note.left}%`, fontSize: `${note.size}vh`, animationDelay: `${note.delay}s`, animationDuration: `${note.duration}s`, '--sway': `${note.sway}vh` }"
    >{{ note.glyph }}</span>
    <div class="disc"><span class="disc-hole" /></div>
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
  background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--accent) 22%, var(--bg)), var(--bg) 70%);
}

.disc {
  width: 32vh;
  height: 32vh;
  border-radius: 50%;
  background: repeating-radial-gradient(circle, var(--record-groove, #2a2826) 0 2px, var(--surface) 2px 5px);
  border: 3px solid var(--outline);
  box-shadow: var(--shadow-soft);
  display: grid;
  place-items: center;
  animation: spin 5s linear infinite;
}

.disc-hole {
  width: 28%;
  height: 28%;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid var(--outline);
}

.bars {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 7%;
  height: 26%;
  display: flex;
  align-items: flex-end;
  gap: 1.2%;
}

.bar {
  flex: 1;
  height: 100%;
  border-radius: 999px 999px 0 0;
  background: linear-gradient(to top, var(--accent), var(--accent-secondary));
  transform-origin: bottom;
  transform: scaleY(0.12);
  animation: bounce ease-in-out infinite alternate;
}

.note {
  position: absolute;
  bottom: -8vh;
  color: var(--accent);
  opacity: 0;
  animation: float linear infinite;
}

.paused .disc,
.paused .bar,
.paused .note {
  animation-play-state: paused;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes bounce {
  from { transform: scaleY(0.1); }
  to { transform: scaleY(var(--peak)); }
}

@keyframes float {
  0% { transform: translate(0, 0) rotate(-8deg); opacity: 0; }
  10% { opacity: 0.9; }
  50% { transform: translate(var(--sway), -55vh) rotate(8deg); }
  90% { opacity: 0.9; }
  100% { transform: translate(calc(var(--sway) * -1), -112vh) rotate(-8deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .disc, .bar, .note { animation: none; }
  .note { opacity: 0.5; bottom: 30%; }
  .bar { transform: scaleY(0.4); }
}
</style>
