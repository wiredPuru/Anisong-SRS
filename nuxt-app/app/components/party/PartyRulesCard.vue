<script setup lang="ts">
const props = defineProps<{ text: string }>();

const lines = computed(() => props.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
</script>

<template>
  <div class="rules-card">
    <h2 class="kai-banner kai-banner-neutral rules-title">Rules</h2>
    <ol class="rules-list">
      <li v-for="(line, i) in lines" :key="i">{{ line }}</li>
    </ol>
  </div>
</template>

<style scoped>
.rules-card {
  width: max-content;
  max-width: 34vw;
  padding: 1.6vmin 2vmin;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.rules-title {
  margin: 0 0 1.2vmin;
  text-align: center;
  font-size: 2.6vmin;
}

.rules-list {
  margin: 0;
  padding-left: 1.4em;
  display: flex;
  flex-direction: column;
  gap: 0.8vmin;
  font-size: 2vmin;
  line-height: 1.3;
}
</style>
