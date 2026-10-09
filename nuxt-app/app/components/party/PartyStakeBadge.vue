<script setup lang="ts">
const props = defineProps<{ stake: { multiplier: number; risk: boolean; player: string | null } }>();

const label = computed(() => (props.stake.risk ? "Hyper Risk" : "Challenge"));
</script>

<template>
  <div class="stake" :class="{ risk: stake.risk }" role="status">
    <span class="stake-times">×{{ stake.multiplier }}</span>
    <span class="stake-text">
      <span class="stake-label">{{ label }}</span>
      <span class="stake-who">{{ stake.player ?? "Everyone" }}</span>
    </span>
  </div>
</template>

<style scoped>
.stake {
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.2vw, 18px);
  padding: clamp(6px, 1vh, 12px) clamp(16px, 2vw, 32px);
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  color: var(--text);
  box-shadow: var(--shadow-soft);
  animation: stake-pop 420ms cubic-bezier(0.3, 1.6, 0.5, 1);
}

.stake.risk {
  background: var(--fail);
}

.stake-times {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 64px);
  line-height: 1;
}

.stake-text {
  display: flex;
  flex-direction: column;
  font-size: clamp(14px, 1.6vw, 26px);
  line-height: 1.15;
}

.stake-label {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

@keyframes stake-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stake {
    animation: none;
  }
}
</style>
