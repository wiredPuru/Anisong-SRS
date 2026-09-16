<script setup lang="ts">
defineProps<{
  score: number;
  combo: number;
  correct: number;
  answered: number;
}>();
</script>

<template>
  <div
    class="quiz-score"
    :aria-label="`Typed answer session score: ${score.toLocaleString()} points, ${combo}x combo, ${correct} of ${answered} correct`"
  >
    <span class="score-stat">
      <small>Score</small>
      <strong>{{ score.toLocaleString() }}</strong>
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
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
  gap: 10px;
  padding: 5px 10px;
  border: 1px solid color-mix(in srgb, var(--accent-secondary) 55%, var(--border));
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent-secondary) 8%, var(--surface));
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent-secondary-glow) 55%, transparent);
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
  display: none;
}

@media (min-width: 1100px) {
  .score-record {
    display: grid;
  }
}

@media (max-width: 1200px) {
  .quiz-score {
    gap: 4px 8px;
  }

  .score-stat {
    grid-template-columns: 1fr;
    gap: 0;
    text-align: center;
    white-space: normal;
  }
}
</style>
