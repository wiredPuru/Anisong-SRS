<script setup lang="ts">
const { refresh: refreshHotkeys } = useHotkeys();
const { canUseRemote } = useNetworkMode();
useHead(() => ({ link: canUseRemote.value ? [{ rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Sora:wght@700&family=M+PLUS+Rounded+1c:wght@500;700;800&display=swap" }] : [] }));
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
