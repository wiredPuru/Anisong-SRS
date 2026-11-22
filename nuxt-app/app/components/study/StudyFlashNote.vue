<script setup lang="ts">
defineProps<{ text: string; tone: "neutral" | "fail" }>();
</script>

<template>
  <p class="flash-note kai-banner" :class="tone === 'fail' ? 'kai-banner-fail' : 'kai-banner-neutral'" role="status" aria-live="polite">
    {{ text }}
  </p>
</template>

<style scoped>
/* Sits on the player pane rather than the picture, so it shows whichever
   side of the card is facing. */
.flash-note {
  position: absolute;
  top: 16px;
  left: 50%;
  z-index: 7;
  max-width: calc(100% - 32px);
  font-size: 15px;
  pointer-events: none;
  transform: translateX(-50%);
  animation: flash-note-in 180ms ease-out;
}

@keyframes flash-note-in {
  from {
    opacity: 0;
    transform: translate(-50%, -6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .flash-note {
    animation: none;
  }
}
</style>
