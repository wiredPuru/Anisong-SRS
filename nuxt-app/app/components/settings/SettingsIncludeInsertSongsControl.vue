<script setup lang="ts">
const props = defineProps<{ enabled: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const isSaving = ref(false);
const error = ref<string | null>(null);

async function setEnabled(next: boolean) {
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/include-insert-songs", { method: "POST", body: { enabled: next } });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update the insert songs setting.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="insert-songs-toggle">
    <label class="insert-songs-label">
      <input
        type="checkbox"
        :checked="props.enabled"
        :disabled="isSaving"
        @change="setEnabled(($event.target as HTMLInputElement).checked)"
      />
      Include insert songs
    </label>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.insert-songs-toggle {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.insert-songs-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.insert-songs-label input[type="checkbox"] {
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
