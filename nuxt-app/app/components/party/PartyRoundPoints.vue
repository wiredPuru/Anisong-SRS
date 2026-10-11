<script setup lang="ts">
import type { PartyRoundPoint } from "~/composables/usePartyDisplay";

defineProps<{ rows: PartyRoundPoint[] }>();

const signed = (points: number) => (points > 0 ? `+${points}` : `${points}`);
</script>

<template>
  <div v-if="rows.length" class="round">
    <aside class="round-panel" aria-label="Points this round">
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
  width: min(27.8vh, 32vw);
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.round-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: clamp(10px, 1.2vw, 1.67vh);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  box-shadow: var(--shadow-soft);
}

.round-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(13px, 1.1vw, 1.67vh);
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
  font-size: clamp(15px, 1.4vw, 2.22vh);
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
</style>
