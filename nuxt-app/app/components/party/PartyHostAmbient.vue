<script setup lang="ts">
import type { PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState | null }>();

// The host sees the answer anyway, so the glow follows the current song's cover.
const cover = computed(() => {
  const state = props.state;
  return state && state.index >= 0 ? state.queue[state.index]?.answer.coverImageUrl ?? null : null;
});
const failed = ref<string | null>(null);
const shown = computed(() => (cover.value && failed.value !== cover.value ? cover.value : null));
</script>

<template>
  <div class="host-ambient" aria-hidden="true">
    <Transition name="host-ambient-fade">
      <NetworkImage v-if="shown" :key="shown" :src="shown" alt="" class="host-ambient-image" @error="failed = shown" />
    </Transition>
    <div class="host-ambient-vignette" />
  </div>
</template>

<style scoped>
.host-ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.host-ambient-image {
  position: absolute;
  inset: -120px;
  width: calc(100% + 240px);
  height: calc(100% + 240px);
  object-fit: cover;
  filter: blur(80px) saturate(1.6);
  opacity: 0.5;
}

.host-ambient-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(85% 85% at 50% 45%, transparent 40%, var(--scrim));
  opacity: 0.55;
}

.host-ambient-fade-enter-active,
.host-ambient-fade-leave-active {
  transition: opacity 1.2s ease;
}

.host-ambient-fade-enter-from,
.host-ambient-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .host-ambient-fade-enter-active,
  .host-ambient-fade-leave-active {
    transition: none;
  }
}
</style>
