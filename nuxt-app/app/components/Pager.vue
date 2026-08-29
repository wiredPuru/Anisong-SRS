<script setup lang="ts">
defineProps<{ page: number; totalPages: number }>();
const emit = defineEmits<{ change: [page: number] }>();
</script>

<template>
  <nav v-if="totalPages > 1" class="pager" aria-label="Pagination">
    <button type="button" class="pager-btn" :disabled="page <= 1" @click="emit('change', page - 1)">
      Prev
    </button>
    <button
      v-for="p in totalPages"
      :key="p"
      type="button"
      class="pager-btn"
      :class="{ active: p === page }"
      @click="emit('change', p)"
    >
      {{ p }}
    </button>
    <button type="button" class="pager-btn" :disabled="page >= totalPages" @click="emit('change', page + 1)">
      Next
    </button>
  </nav>
</template>

<style scoped>
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
}

.pager-btn {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.pager-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
