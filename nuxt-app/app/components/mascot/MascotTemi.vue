<script setup lang="ts">
const props = withDefaults(defineProps<{ size: "hero" | "companion"; alt?: string }>(), { alt: "" });

// Matches the rendered CSS height, so the browser reserves the box before the
// image loads and the surrounding layout never jumps.
const pixels = computed(() => (props.size === "hero" ? 150 : 96));
</script>

<template>
  <img
    class="mascot-temi"
    :class="`mascot-temi-${size}`"
    src="/mascot/temi-320.webp"
    srcset="/mascot/temi-320.webp 1x, /mascot/temi-640.webp 2x"
    :width="pixels"
    :height="pixels"
    :alt="alt"
    decoding="async"
  />
</template>

<style scoped>
.mascot-temi {
  flex: none;
  display: block;
  object-fit: contain;
  user-select: none;
}

.mascot-temi-hero {
  width: 150px;
  height: 150px;
}

.mascot-temi-companion {
  width: 96px;
  height: 96px;
}

@media (max-width: 820px) {
  .mascot-temi-hero {
    width: 96px;
    height: 96px;
  }
}
</style>
