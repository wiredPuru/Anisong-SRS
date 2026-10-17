<script setup lang="ts">
const props = defineProps<{ enabled: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const isSaving = ref(false);
const error = ref<string | null>(null);

async function setEnabled(next: boolean) {
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/playable-offline-only", { method: "POST", body: { enabled: next } });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Couldn't save Playable offline only. Try again.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="playable-offline-control">
    <label class="playable-offline-label">
      <input
        type="checkbox"
        :checked="props.enabled"
        :disabled="isSaving"
        @change="setEnabled(($event.target as HTMLInputElement).checked)"
      />
      Playable offline only
    </label>
    <p class="playable-offline-hint">
      While Offline mode is on, Study, Listen and Party leave out cards with no downloaded file and no fully cached clip,
      so every card you meet can play. Turning Offline mode off brings them all back.
    </p>
    <p v-if="error" role="alert" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.playable-offline-control {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.playable-offline-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.playable-offline-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.playable-offline-hint {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
