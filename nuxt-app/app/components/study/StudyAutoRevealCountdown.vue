<script setup lang="ts">
const props = defineProps<{ seconds: number; ambient?: boolean; immersive?: boolean }>();

const remaining = ref(props.seconds);
let interval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  remaining.value = props.seconds;
  interval = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value === 0 && interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  }, 1000);
});

onUnmounted(() => {
  if (interval !== null) clearInterval(interval);
});
</script>

<template>
  <div class="auto-reveal-countdown" :class="{ 'ambient-glass': ambient, 'immersive-glass': immersive }">
    <span class="label">Revealing in</span>
    <span class="count">{{ remaining }}</span>
  </div>
</template>

<style scoped>
/* Always overlaid centered on its parent's box - the parent (StudyInfoPanel's
   wrapper, non-immersive; .info-slot, immersive) is the positioned ancestor
   this centers within, so this component only ever needs a position:relative
   host around StudyInfoPanel, never new props on StudyInfoPanel itself. */
.auto-reveal-countdown {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  width: fit-content;
}

.auto-reveal-countdown.ambient-glass {
  background: var(--glass-surface);
  border-color: var(--glass-border);
  backdrop-filter: var(--glass-blur);
}

.auto-reveal-countdown.immersive-glass {
  background: none;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px) saturate(1.3);
}

.auto-reveal-countdown.immersive-glass .label,
.auto-reveal-countdown.immersive-glass .count {
  text-shadow:
    0 2px 8px rgba(0, 0, 0, 0.85),
    0 1px 2px rgba(0, 0, 0, 0.9);
}

.label {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.count {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent-secondary);
  line-height: 1;
}
</style>
