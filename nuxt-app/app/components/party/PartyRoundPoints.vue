<script setup lang="ts">
import type { PartyRoundPoint } from "~/composables/usePartyDisplay";
import type { PartyScorePop } from "~/composables/usePartySettledScores";

defineProps<{ rows: PartyRoundPoint[]; pops: PartyScorePop[] }>();

const signed = (points: number) => (points > 0 ? `+${points}` : `${points}`);
</script>

<template>
  <div v-if="rows.length || pops.length" class="round">
    <div class="round-pops" aria-live="polite">
      <p v-for="pop in pops" :key="pop.key" class="kai-banner kai-banner-pass round-pop">
        <span class="round-pop-points">+{{ pop.points }}</span>
        <span class="round-pop-name">{{ pop.name }}</span>
      </p>
    </div>

    <aside v-if="rows.length" class="round-panel" aria-label="Points this round">
      <p class="round-title">This round</p>
      <ol class="round-list">
        <li v-for="row in rows" :key="row.id" class="round-row">
          <span class="round-name">{{ row.name }}</span>
          <span class="round-points" :class="{ negative: row.points < 0 }">{{ signed(row.points) }}</span>
        </li>
      </ol>
    </aside>
  </div>
</template>

<style scoped>
.round {
  width: min(300px, 32vw);
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.round-pops {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.round-pop {
  display: flex;
  align-items: baseline;
  gap: 0.35em;
  max-width: 100%;
  font-size: clamp(26px, 3.4vw, 60px);
  text-transform: none;
  animation: round-pop-float 2600ms ease-out both;
}

.round-pop-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6em;
  color: var(--text);
}

.round-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: clamp(10px, 1.2vw, 18px);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  box-shadow: var(--shadow-soft);
}

.round-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(13px, 1.1vw, 18px);
  color: var(--muted);
}

.round-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.round-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: clamp(15px, 1.4vw, 24px);
}

.round-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.round-points {
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.round-points.negative {
  color: var(--fail);
}

@keyframes round-pop-float {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }
  12% {
    opacity: 1;
    transform: scale(1.15);
  }
  22% {
    transform: scale(1);
  }
  80% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .round-pop {
    animation: none;
  }
}
</style>
