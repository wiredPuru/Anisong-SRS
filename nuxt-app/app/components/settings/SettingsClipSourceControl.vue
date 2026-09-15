<script setup lang="ts">
type ClipSource = "anisongdb" | "both" | "animethemes";

const props = defineProps<{ source: ClipSource }>();
const emit = defineEmits<{ saved: [] }>();

const isSaving = ref(false);
const error = ref<string | null>(null);

async function setSource(select: HTMLSelectElement) {
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/clip-source", { method: "POST", body: { source: select.value } });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update clip source.");
    // The prop did not change, so Vue will not reset the select on its own and
    // it would keep showing the choice that failed to save.
    select.value = props.source;
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="clip-source-picker">
    <label for="clip-source-select" class="clip-source-label">Clip source</label>
    <select
      id="clip-source-select"
      class="clip-source-select"
      :disabled="isSaving"
      :value="props.source"
      @change="setSource($event.target as HTMLSelectElement)"
    >
      <option value="anisongdb">AnisongDB only</option>
      <option value="both">Both (AnisongDB preferred)</option>
      <option value="animethemes">animethemes.moe only</option>
    </select>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.clip-source-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.clip-source-label {
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
}

.clip-source-select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.clip-source-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
