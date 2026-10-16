<script setup lang="ts">
// "running" while a download is in flight, an error message after a failed one.
defineProps<{ downloaded: boolean; status?: string }>();
const emit = defineEmits<{ download: [] }>();
</script>

<template>
  <span class="library-chips">
    <span class="chip">✓ In library</span>
    <span v-if="downloaded" class="chip">✓ Downloaded</span>
    <span v-else-if="status === 'running'" class="chip busy" role="status">Downloading...</span>
    <template v-else>
      <button type="button" class="chip download" @click.stop="emit('download')">Download</button>
      <span v-if="status" class="error" role="alert">{{ status }}</span>
    </template>
  </span>
</template>

<style scoped>
.library-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
}

.chip {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
}

.chip.busy {
  color: var(--accent);
  border-color: var(--accent);
}

.chip.download {
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.chip.download:hover {
  border-color: var(--accent);
}

.error {
  color: var(--fail);
  font-size: 11px;
}
</style>
