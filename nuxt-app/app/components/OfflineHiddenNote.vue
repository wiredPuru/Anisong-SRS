<script setup lang="ts">
defineProps<{ count: number }>();
</script>

<template>
  <span v-if="count > 0" class="offline-hidden-note">
    {{ count }} {{ count === 1 ? "card" : "cards" }} hidden: not downloaded
  </span>
</template>
