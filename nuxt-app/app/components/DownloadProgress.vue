<script setup lang="ts">
import { computed } from "vue";
import { downloadPhase, formatDownloadProgress, type DownloadProgress as DownloadProgressData } from "../composables/useCardDownloads";

const props = defineProps<{
  label: string;
  requestKey: string | number;
  progress?: DownloadProgressData | null;
}>();

const phase = computed(() => downloadPhase(props.progress ?? undefined));
const percent = computed(() => {
  const p = props.progress;
  if (!p || p.total <= 0) return 0;
  return Math.min(100, Math.round((p.loaded / p.total) * 100));
});
</script>

<template>
  <ActivityStatus v-if="phase === 'waiting'" :label="label" :request-key="requestKey" />
  <div v-else class="download-progress">
    <div class="download-progress-bar">
      <span :style="{ width: (phase === 'finishing' ? 100 : percent) + '%' }" />
    </div>
    <span class="download-progress-label">{{ formatDownloadProgress(progress ?? undefined) }}</span>
  </div>
</template>

<style scoped>
.download-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.download-progress-bar {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
}

.download-progress-bar > span {
  display: block;
  height: 100%;
  background: var(--accent-secondary);
  transition: width 0.15s ease;
}

.download-progress-label {
  flex: none;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  min-width: 34px;
  text-align: right;
}
</style>
