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
/* Non-immersive: overlaid centered on its parent's box - study/index.vue's
   .info-panel-wrap is the positioned ancestor this centers within, so this
   component only ever needs a position:relative host around StudyInfoPanel,
   never new props on StudyInfoPanel itself. Immersive uses a different
   anchor entirely - see .immersive-glass below. */
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
  /* study/index.vue renders the immersive instance as a direct sibling of
     .info-slot/.answer-slot (not nested inside .info-slot like an earlier
     version), so its positioned ancestor here is .player-frame itself - and
     StudyMediaPlayer.vue's own veil suppresses its "Listening..."/"Paused"
     icon+text (hide-listening-label, driven by the same
     autoRevealCountdownActive condition) whenever this is showing in
     immersive mode, so this pill directly replaces that indicator rather
     than sitting alongside or near it. No position override needed here -
     the base rule's dead-center top/left/transform already puts it exactly
     where that indicator was. */
  z-index: 10;
  /* Proportional to .player-frame's rendered width (StudyMediaPlayer.vue's
     container-type: inline-size), like every other immersive-overlay piece
     (StudyInfoPanel.vue's .info-card.overlay chips, study/index.vue's
     .answer-slot buttons). Unlike those smaller meta-text chips, this is the
     one overlay element the whole immersive view is waiting on - it needs to
     read as a prominent callout against the video, not a corner badge - so
     the floor here is deliberately well above the non-immersive size (never
     smaller than before) rather than matching it, and only grows further as
     the frame widens past a normal desktop window. */
  padding: clamp(16px, 1.5cqw, 36px) clamp(28px, 2.5cqw, 56px);
  gap: clamp(10px, 1cqw, 22px);
}

.auto-reveal-countdown.immersive-glass .label {
  font-size: clamp(18px, 1.65cqw, 40px);
}

.auto-reveal-countdown.immersive-glass .count {
  font-size: clamp(40px, 3.85cqw, 80px);
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
