<script setup lang="ts">
const props = defineProps<{ enabled: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const isSaving = ref(false);
const error = ref<string | null>(null);

async function setEnabled(next: boolean) {
  error.value = null;
  isSaving.value = true;
  try {
    await $fetch("/api/media-library/japanese-breakdown", { method: "POST", body: { enabled: next } });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Couldn't save Japanese breakdown. Try again.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="japanese-breakdown-control">
    <label class="japanese-breakdown-label">
      <input
        type="checkbox"
        :checked="props.enabled"
        :disabled="isSaving"
        @change="setEnabled(($event.target as HTMLInputElement).checked)"
      />
      Japanese breakdown
    </label>
    <p class="japanese-breakdown-hint">
      Adds a second card on Study, opened with J, that breaks the song and anime titles into kanji with a keyword,
      parts, readings and stroke count, and can show the titles as all hiragana or all katakana.
    </p>
    <p v-if="error" role="alert" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.japanese-breakdown-control {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.japanese-breakdown-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.japanese-breakdown-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.japanese-breakdown-hint {
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
