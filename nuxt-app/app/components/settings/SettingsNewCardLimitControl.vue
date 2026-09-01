<script setup lang="ts">
const props = defineProps<{ limit: number | null }>();
const emit = defineEmits<{ saved: [] }>();

const DEFAULT_DAILY_NEW_CARD_LIMIT = 20;
const enabled = ref(false);
const value = ref(DEFAULT_DAILY_NEW_CARD_LIMIT);
const isSaving = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.limit,
  (limit) => {
    if (limit === undefined) return;
    enabled.value = limit !== null;
    if (limit !== null) value.value = limit;
  },
  { immediate: true },
);

async function save(limit: number | null) {
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/daily-new-card-limit", { method: "POST", body: { limit } });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update daily new card limit.");
  } finally {
    isSaving.value = false;
  }
}

function toggle(next: boolean) {
  enabled.value = next;
  save(next ? value.value : null);
}

function setValue(next: number) {
  if (!Number.isInteger(next) || next < 0) return;
  value.value = next;
  save(next);
}
</script>

<template>
  <div class="new-card-limit-picker">
    <label class="new-card-limit-toggle">
      <input
        type="checkbox"
        :checked="enabled"
        :disabled="isSaving"
        @change="toggle(($event.target as HTMLInputElement).checked)"
      />
      Limit new cards per day
    </label>
    <div v-if="enabled" class="new-card-limit-input-row">
      <input
        type="number"
        min="0"
        step="1"
        class="new-card-limit-input"
        :disabled="isSaving"
        :value="value"
        @change="setValue(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="new-card-limit-hint">new cards per day</span>
    </div>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.new-card-limit-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.new-card-limit-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.new-card-limit-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.new-card-limit-input {
  width: 90px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.new-card-limit-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.new-card-limit-hint {
  color: var(--muted);
  font-size: 14px;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
