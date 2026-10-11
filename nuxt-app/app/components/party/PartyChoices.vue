<script setup lang="ts">
import type { ChoiceStyle } from "~/utils/partyLayout";

defineProps<{ options: string[]; variant?: ChoiceStyle }>();

const LETTERS = ["A", "B", "C", "D", "E", "F"];
</script>

<template>
  <ol class="choices" :class="`is-${variant ?? 'grid'}`" aria-label="Which anime is this?">
    <li v-for="(option, index) in options" :key="option" class="choice">
      <span class="choice-letter">{{ LETTERS[index] }}</span>
      <span class="choice-title">{{ option }}</span>
    </li>
  </ol>
</template>

<style scoped>
.choices {
  width: min(101.9vh, calc(100vw - 32px));
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(8px, 1.4vw, 1.85vh);
}

.choices.is-list {
  width: min(66.7vh, calc(100vw - 32px));
  grid-template-columns: minmax(0, 1fr);
}

.choices.is-row {
  width: min(157.4vh, calc(100vw - 32px));
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.is-row .choice {
  flex-direction: column;
  text-align: center;
  font-size: clamp(14px, 1.7vw, 2.78vh);
}

.choice {
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.2vw, 1.67vh);
  padding: clamp(10px, 1.4vw, 2.04vh);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-soft);
  font-size: clamp(16px, 2.2vw, 3.33vh);
  font-weight: 700;
  animation: choice-in 260ms ease-out backwards;
}

.choice:nth-child(2) {
  animation-delay: 60ms;
}

.choice:nth-child(3) {
  animation-delay: 120ms;
}

.choice:nth-child(4) {
  animation-delay: 180ms;
}

.choice-letter {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 1.8em;
  height: 1.8em;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
}

.choice-title {
  min-width: 0;
  overflow-wrap: anywhere;
}

@keyframes choice-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .choice {
    animation: none;
  }
}
</style>
