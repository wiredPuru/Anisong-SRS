<script setup lang="ts">
import { AUDIO_FIRST_STYLE_OPTIONS, type AudioFirstStyle } from "~/utils/audioFirst";

const props = defineProps<{ cardId: number; modelValue: AudioFirstStyle; disabled?: boolean }>();
const emit = defineEmits<{ changed: [AudioFirstStyle] }>();

const saving = ref(false);
const error = ref<string | null>(null);

async function choose(value: string) {
  const style = AUDIO_FIRST_STYLE_OPTIONS.find((option) => option.value === value)?.value;
  if (!style || style === props.modelValue) return;
  error.value = null;
  saving.value = true;
  try {
    await $fetch("/api/cards/audio-first", { method: "POST", body: { ids: [props.cardId], audioFirst: true, style } });
    emit("changed", style);
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to change the style.");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="audio-first-style">
    <label class="audio-first-style-label">
      <span title="How Study hides the picture. Listen always hides it fully.">Hide picture by</span>
      <select
        :value="modelValue"
        :disabled="disabled || saving"
        @change="choose(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="option in AUDIO_FIRST_STYLE_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <p v-if="error" class="audio-first-style-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.audio-first-style {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.audio-first-style-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
}

select {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
}

.audio-first-style-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}
</style>
