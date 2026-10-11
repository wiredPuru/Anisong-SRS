<script setup lang="ts">
const props = defineProps<{ text: string }>();

const lines = computed(() => props.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
</script>

<template>
  <div class="rules-backdrop" role="dialog" aria-label="Rules">
    <div class="rules-card">
      <h2 class="kai-banner kai-banner-neutral rules-title">Rules</h2>
      <ol class="rules-list">
        <li v-for="(line, i) in lines" :key="i">{{ line }}</li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.rules-backdrop {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 6vmin;
  background: var(--scrim);
  animation: rules-in 0.25s ease-out;
}

.rules-card {
  max-width: 80vw;
  max-height: 84vh;
  overflow: hidden;
  padding: 3.2vmin 4vmin;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.rules-title {
  margin: 0 0 2vmin;
  text-align: center;
  font-size: 5vmin;
}

.rules-list {
  margin: 0;
  padding-left: 1.4em;
  display: flex;
  flex-direction: column;
  gap: 1.4vmin;
  font-size: 3.4vmin;
  line-height: 1.3;
}

@keyframes rules-in {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .rules-backdrop { animation: none; }
}
</style>
