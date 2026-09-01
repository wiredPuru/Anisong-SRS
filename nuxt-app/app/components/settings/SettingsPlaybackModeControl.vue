<script setup lang="ts">
const props = defineProps<{ mode: "auto" | "audioOnly" }>();
const emit = defineEmits<{ saved: [] }>();

const isSaving = ref(false);
const error = ref<string | null>(null);

async function setMode(next: string) {
  if (next !== "auto" && next !== "audioOnly") return;
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/playback-mode", { method: "POST", body: { mode: next } });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update playback mode.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="playback-mode-picker">
    <label for="playback-mode-select" class="playback-mode-label">Playback mode</label>
    <select
      id="playback-mode-select"
      class="playback-mode-select"
      :disabled="isSaving"
      :value="props.mode"
      @change="setMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="auto">Auto (video when available)</option>
      <option value="audioOnly">Audio only</option>
    </select>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.playback-mode-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.playback-mode-label {
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
}

.playback-mode-select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.playback-mode-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
