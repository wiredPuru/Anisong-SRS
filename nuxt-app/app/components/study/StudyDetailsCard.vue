<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  coverImageUrl: string | null;
  // The answer is still a secret: the cover would give it away.
  hidden: boolean;
}>();

const coverFailed = ref(false);
watch(() => props.coverImageUrl, () => (coverFailed.value = false));
</script>

<template>
  <Transition name="flip">
    <section v-if="open" class="details-card on-picture" aria-label="Card details">
      <div class="details-art" aria-hidden="true">
        <img v-if="!hidden && coverImageUrl && !coverFailed" :src="coverImageUrl" alt="" @error="coverFailed = true" />
        <span v-else>?</span>
      </div>
      <div class="details-body">
        <div class="details-scroll">
          <slot />
        </div>
        <slot name="footer" />
      </div>
    </section>
  </Transition>
</template>

<style scoped>
/* D turns the picture over: a trading card with the cover on the left and
   everything about the card on the right, laid exactly over the player frame
   (the page sets --frame-* from usePlayerFrameBox). The clip keeps playing
   underneath. */
.details-card {
  position: absolute;
  top: var(--frame-top, 0);
  left: var(--frame-left, 0);
  width: var(--frame-w, 100%);
  height: var(--frame-h, 100%);
  z-index: 8;
  display: grid;
  grid-template-columns: minmax(0, 34%) minmax(0, 1fr);
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid var(--border);
  background: #121215;
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.55);
}

.details-art {
  position: relative;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.04);
  color: var(--faint);
  font: 700 64px var(--font-display);
}

.details-art img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.details-body {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px 26px 18px;
}

/* Scrolls when the card holds more than fits, without a visible bar. */
.details-scroll {
  flex: 1;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 18px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
}

.details-scroll::-webkit-scrollbar {
  display: none;
}

.details-scroll :deep(.info-card) {
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

.flip-enter-active,
.flip-leave-active {
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1), opacity 0.25s ease;
}

.flip-enter-from,
.flip-leave-to {
  opacity: 0;
  transform: perspective(1600px) rotateY(-80deg);
}

@media (prefers-reduced-motion: reduce) {
  .flip-enter-active,
  .flip-leave-active {
    transition: opacity 0.15s ease;
  }

  .flip-enter-from,
  .flip-leave-to {
    transform: none;
  }
}

@media (max-width: 820px) {
  .details-card {
    grid-template-columns: 1fr;
  }

  .details-art {
    display: none;
  }
}
</style>
