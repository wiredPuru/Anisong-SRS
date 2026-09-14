<script setup lang="ts">
const props = defineProps<{ enabled: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const isSaving = ref(false);
const error = ref<string | null>(null);

async function setEnabled(next: boolean) {
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/auto-download", { method: "POST", body: { enabled: next } });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update auto download.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="auto-download-toggle">
    <label class="auto-download-label">
      <input
        type="checkbox"
        :checked="props.enabled"
        :disabled="isSaving"
        @change="setEnabled(($event.target as HTMLInputElement).checked)"
      />
      Auto Download
    </label>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.auto-download-toggle {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.auto-download-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.auto-download-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
