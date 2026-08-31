<script setup lang="ts">
const props = defineProps<{ required: number }>();
const emit = defineEmits<{ saved: [] }>();

const value = ref(props.required);
const isSaving = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.required,
  (required) => {
    value.value = required;
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
  if (!Number.isInteger(next) || next < 1) return;
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/box-one-streak-required", { method: "POST", body: { required: next } });
    value.value = next;
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update the learning streak requirement.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="streak-required-picker">
    <label for="streak-required-input" class="streak-required-label">Passes needed to graduate a new card</label>
    <div class="streak-required-input-row">
      <input
        id="streak-required-input"
        type="number"
        min="1"
        step="1"
        class="streak-required-input"
        :disabled="isSaving"
        :value="value"
        @change="setValue(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="streak-required-hint">correct answers in a row</span>
    </div>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.streak-required-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.streak-required-label {
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
}

.streak-required-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.streak-required-input {
  width: 90px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.streak-required-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.streak-required-hint {
  color: var(--muted);
  font-size: 14px;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
