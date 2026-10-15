<script setup lang="ts">
const props = defineProps<{ disabled?: boolean }>();
const { kinds, setKind } = useBulkDownloadKinds();
</script>

<template>
  <div class="kind-toggles" role="group" aria-label="What Download all fetches">
    <label class="kind-toggle" :class="{ on: kinds.video }">
      <input
        type="checkbox"
        :checked="kinds.video"
        :disabled="props.disabled"
        @change="setKind('video', ($event.target as HTMLInputElement).checked)"
      />
      Video
    </label>
    <label class="kind-toggle" :class="{ on: kinds.audio }">
      <input
        type="checkbox"
        :checked="kinds.audio"
        :disabled="props.disabled"
        @change="setKind('audio', ($event.target as HTMLInputElement).checked)"
      />
      Audio
    </label>
  </div>
</template>

<style scoped>
.kind-toggles {
  display: inline-flex;
  gap: 6px;
}

.kind-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
}

.kind-toggle.on {
  color: var(--text);
  border-color: var(--accent);
}

.kind-toggle input {
  margin: 0;
}

.kind-toggle:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
