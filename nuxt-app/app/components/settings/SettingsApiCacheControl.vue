<script setup lang="ts">
const { data, refresh } = await useFetch<{ entries: number }>("/api/api-cache");
const isClearing = ref(false);
const error = ref<string | null>(null);

async function clear() {
  error.value = null;
  isClearing.value = true;
  try {
    await $fetch("/api/api-cache/clear", { method: "POST" });
    await refresh();
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to clear the lookup cache.");
  } finally {
    isClearing.value = false;
  }
}
</script>

<template>
  <div class="api-cache">
    <p class="api-cache-count">{{ data?.entries ?? 0 }} saved lookups</p>
    <button type="button" class="api-cache-btn" :disabled="isClearing || !data?.entries" @click="clear">
      {{ isClearing ? "Clearing..." : "Clear saved lookups" }}
    </button>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.api-cache {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.api-cache-count {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
}

.api-cache-btn {
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  cursor: pointer;
}

.api-cache-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
