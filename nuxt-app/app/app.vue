<script setup lang="ts">
const { refresh: refreshHotkeys } = useHotkeys();
onMounted(refreshHotkeys);
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
