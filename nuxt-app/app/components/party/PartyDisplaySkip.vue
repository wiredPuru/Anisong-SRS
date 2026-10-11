<script setup lang="ts">
const props = defineProps<{ skipSeq: number | null; arranging?: boolean }>();

const { isHidden } = usePartyLayout();

const SHOW_MS = 1500;
const shownAt = ref<number | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

// The first value a display receives (or a reconnect) is not a skip.
watch(
  () => props.skipSeq,
  (value, previous) => {
    if (value === null || previous === null || value === previous) return;
    shownAt.value = value;
    clearTimeout(timer);
    timer = setTimeout(() => (shownAt.value = null), SHOW_MS);
  },
);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div v-if="shownAt !== null && !isHidden('skip')" :key="shownAt" class="skip-layer" aria-hidden="true" />
  <PartyLayoutFrame v-if="shownAt !== null || arranging" piece="skip">
    <p class="kai-banner kai-banner-neutral skip-text" :role="shownAt !== null ? 'status' : undefined">Skipping...</p>
  </PartyLayoutFrame>
</template>

<style scoped>
.skip-layer {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  pointer-events: none;
  animation: skip-in 200ms ease-out;
}

.skip-text {
  font-size: clamp(32px, 6vw, 8.89vh);
}

@keyframes skip-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skip-layer {
    animation: none;
  }
}
</style>
