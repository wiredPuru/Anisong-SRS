<script setup lang="ts">
import type { SourceLink } from "../../utils/sourceLinks";

defineProps<{ links: SourceLink[] }>();
</script>

<template>
  <ul class="source-links">
    <li v-for="link in links" :key="link.site">
      <a class="source-link" :href="link.href" :title="link.title" target="_blank" rel="noopener noreferrer">{{
        link.label
      }}</a>
    </li>
  </ul>
</template>

<style scoped>
.source-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.source-link {
  display: inline-block;
  padding: 3px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  color: var(--accent-secondary);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.source-link:hover,
.source-link:focus-visible {
  border-color: var(--accent-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
