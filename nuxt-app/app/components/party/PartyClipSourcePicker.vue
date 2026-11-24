<script setup lang="ts">
type ClipSource = "anisongdb" | "both" | "animethemes";

const OPTIONS: { value: ClipSource; label: string }[] = [
  { value: "anisongdb", label: "AnisongDB" },
  { value: "both", label: "Both" },
  { value: "animethemes", label: "AnimeThemes" },
];

const clipSource = ref<ClipSource | null>(null);
const saving = ref(false);
const failed = ref(false);

onMounted(async () => {
  try {
    clipSource.value = (await $fetch<{ clipSource: ClipSource }>("/api/party/host/clip-source")).clipSource;
  } catch {
    clipSource.value = null;
  }
});

async function change(value: ClipSource) {
  const previous = clipSource.value;
  clipSource.value = value;
  saving.value = true;
  failed.value = false;
  try {
    clipSource.value = (await $fetch<{ clipSource: ClipSource }>("/api/party/host/clip-source", { method: "POST", body: { clipSource: value } })).clipSource;
  } catch {
    clipSource.value = previous;
    failed.value = true;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <label
    v-if="clipSource"
    class="clip-source"
    title="Where song clips play from. Songs about to play switch over; one with no match keeps its own clip and shows a warning. Same setting as the main app's Settings > Playback."
  >
    Source
    <select :value="clipSource" :disabled="saving" @change="change(($event.target as HTMLSelectElement).value as ClipSource)">
      <option v-for="option in OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <span v-if="failed" class="clip-source-error" role="alert">Not saved</span>
  </label>
</template>

<style scoped>
.clip-source {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.clip-source select {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font: inherit;
  font-weight: 700;
}

.clip-source-error {
  color: var(--fail);
  font-size: 13px;
}
</style>
