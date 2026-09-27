<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party" });
</script>

<template>
  <main class="display-waiting">
    <MascotKai pose="sleepy" size="hero" />
    <h1 class="kai-banner kai-banner-neutral">Waiting for the host</h1>
    <p class="display-hint">The game starts on this screen once the host begins.</p>
  </main>
</template>

<style scoped>
.display-waiting {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px;
  text-align: center;
}

.display-waiting h1 {
  font-size: clamp(24px, 4vw, 56px);
}

.display-hint {
  margin: 0;
  color: var(--muted);
  font-size: clamp(14px, 1.6vw, 22px);
}
</style>
