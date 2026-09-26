<script setup lang="ts">
defineProps<{ result: "pass" | "fail" }>();
</script>

<template>
  <div class="grade-sticker" :class="result" aria-hidden="true">
    <MascotKai :pose="result === 'pass' ? 'cheer' : 'slump'" size="companion" />
    <p class="kai-banner" :class="result === 'pass' ? 'kai-banner-pass' : 'kai-banner-fail'">
      {{ result === "pass" ? "Correct!" : "Wrong..." }}
    </p>
  </div>
</template>

<style scoped>
/* Pops over the player after a manual Pass/Fail, then fades; the page removes
   it after STICKER_MS. Never takes a click. */
.grade-sticker {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: sticker-pop 1100ms cubic-bezier(0.2, 1.3, 0.3, 1) forwards;
}

.grade-sticker :deep(.mascot-kai) {
  height: 120px;
  margin-bottom: -10px;
}

.kai-banner {
  font-size: 28px;
}

.grade-sticker.fail {
  animation-name: sticker-droop;
}

@keyframes sticker-pop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(-8deg); }
  22% { opacity: 1; transform: translate(-50%, -50%) scale(1.06) rotate(2deg); }
  34% { transform: translate(-50%, -50%) scale(1) rotate(0); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -54%) scale(1); }
}

@keyframes sticker-droop {
  0% { opacity: 0; transform: translate(-50%, -62%); }
  24% { opacity: 1; transform: translate(-50%, -48%); }
  34% { transform: translate(-50%, -50%); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -46%); }
}

@media (prefers-reduced-motion: reduce) {
  .grade-sticker,
  .grade-sticker.fail {
    animation: sticker-fade 1100ms linear forwards;
  }

  @keyframes sticker-fade {
    0%, 80% { opacity: 1; }
    100% { opacity: 0; }
  }
}
</style>
