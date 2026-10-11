<script setup lang="ts">
const props = defineProps<{ text: string; divided?: boolean }>();

const lines = computed(() => props.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
</script>

<template>
  <section class="rules" :class="{ divided }" aria-label="Rules">
    <h2 class="kai-banner kai-banner-neutral rules-title">Rules</h2>
    <ul class="rules-list">
      <li v-for="(line, i) in lines" :key="i">{{ line }}</li>
    </ul>
  </section>
</template>

<style scoped>
.rules {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rules.divided {
  padding-bottom: 10px;
  border-bottom: 2px dashed var(--border);
}

.rules-title {
  align-self: flex-start;
  margin: 0;
  color: var(--muted);
  font-size: clamp(16px, 1.6vw, 2.41vh);
}

.rules-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: clamp(14px, 1.3vw, 2.1vh);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
</style>
