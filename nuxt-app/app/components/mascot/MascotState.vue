<script setup lang="ts">
import type { KaiPose } from "./MascotKai.vue";

// A page's loading, empty, or error message with Kai beside it. The message
// (default slot) keeps whatever text and live region it already had.
withDefaults(defineProps<{ pose: KaiPose; size?: "small" | "companion" }>(), { size: "small" });
</script>

<template>
  <div class="kai-state">
    <MascotKai :pose="pose" :size="size" />
    <div class="kai-state-message"><slot /></div>
  </div>
</template>

<style scoped>
.kai-state {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.kai-state-message {
  min-width: 0;
}
</style>
