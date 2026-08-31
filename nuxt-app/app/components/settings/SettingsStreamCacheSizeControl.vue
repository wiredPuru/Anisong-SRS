<script setup lang="ts">
const props = defineProps<{ maxBytes: number }>();
const emit = defineEmits<{ saved: [] }>();

const value = ref(Math.round(props.maxBytes / (1024 * 1024)));
const isSaving = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.maxBytes,
  (maxBytes) => {
    value.value = Math.round(maxBytes / (1024 * 1024));
  },
);

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

async function setValue(next: number) {
  if (!Number.isFinite(next) || next <= 0) return;
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/stream-cache-max-mb", { method: "POST", body: { mb: next } });
    value.value = next;
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update the cache size.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="cache-size-picker">
    <label for="cache-size-input" class="cache-size-label">Streamed-clip cache size</label>
    <div class="cache-size-input-row">
      <input
        id="cache-size-input"
        type="number"
        min="1"
        step="1"
        class="cache-size-input"
        :disabled="isSaving"
        :value="value"
        @change="setValue(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="cache-size-hint">MB</span>
    </div>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.cache-size-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.cache-size-label {
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
}

.cache-size-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cache-size-input {
  width: 110px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.cache-size-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cache-size-hint {
  color: var(--muted);
  font-size: 14px;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
