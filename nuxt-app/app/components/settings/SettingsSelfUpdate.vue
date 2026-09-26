<script setup lang="ts">
const { status, starting, refresh, start } = useSelfUpdate();
onMounted(refresh);

const progress = computed(() =>
  status.value?.state === "downloading"
    ? { loaded: status.value.receivedBytes, total: status.value.totalBytes ?? 0 }
    : null,
);
</script>

<template>
  <div v-if="status && status.state !== 'unavailable'" class="self-update">
    <button
      v-if="status.state === 'idle'"
      type="button"
      class="self-update-btn"
      :disabled="starting"
      @click="start"
    >
      Download update
    </button>

    <DownloadProgress
      v-else-if="status.state === 'downloading'"
      label="Starting download"
      request-key="self-update"
      :progress="progress && progress.loaded > 0 ? progress : null"
    />

    <p v-else-if="status.state === 'verifying'" class="self-update-state">Verifying...</p>
    <p v-else-if="status.state === 'unpacking'" class="self-update-state">Unpacking...</p>

    <template v-else-if="status.state === 'ready'">
      <p class="self-update-ready">Ready - restart to update</p>
      <button type="button" class="self-update-btn" disabled>Restart to update</button>
      <p class="self-update-hint">Restart comes in the next step.</p>
    </template>

    <template v-else-if="status.state === 'failed'">
      <p class="self-update-error">{{ status.error ?? "The update failed." }}</p>
      <button type="button" class="self-update-btn" :disabled="starting" @click="start">Try again</button>
    </template>
  </div>
  <p v-else-if="status?.reason === 'not-writable'" class="self-update-hint">
    This app's folder can't be written to, so it can't update itself. Use the download link below.
  </p>
</template>

<style scoped>
.self-update {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  max-width: 420px;
}

.self-update > .download-progress {
  align-self: stretch;
}

.self-update-btn {
  padding: 9px 18px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 800;
  cursor: pointer;
}

.self-update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.self-update-state,
.self-update-hint {
  font-size: 13px;
  color: var(--faint);
}

.self-update-ready {
  font-size: 14px;
  color: var(--pass);
}

.self-update-error {
  font-size: 13px;
  color: var(--fail);
}
</style>
