<script setup lang="ts">
import { audioFirstStyleLabel, type AudioFirstStyle } from "~/utils/audioFirst";

const props = defineProps<{ hideStyle?: AudioFirstStyle }>();
const styleLabel = computed(() => (props.hideStyle ? audioFirstStyleLabel(props.hideStyle) : null));
</script>

<template>
  <span class="audio-first-badge" title="Audio first: the picture stays hidden in Study and Listen until the answer is revealed">
    Audio first<template v-if="styleLabel"> · {{ styleLabel }}</template>
  </span>
</template>

<style scoped>
.audio-first-badge {
  align-self: flex-start;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, currentColor 12%, transparent);
  color: var(--accent-secondary);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
