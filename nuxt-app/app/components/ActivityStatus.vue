<script setup lang="ts">
import type { ImportProgress } from "../utils/importStream";

const props = defineProps<{
  label: string;
  requestKey?: string | number;
  progress?: ImportProgress | null;
  revision?: number;
}>();
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
const { elapsedSeconds, isSlow } = useActivityTimer(
  () => props.requestKey ?? props.label, mounted, () => props.revision,
);
</script>

<template>
  <span class="activity-status">
    <span role="status" aria-live="polite" aria-atomic="true">
      {{ progress?.label ?? label }}...
      <span v-if="progress?.completed !== undefined" class="activity-wait">
        Processed {{ progress.completed }}<template v-if="progress.total !== undefined"> of {{ progress.total }}</template> anime
        <template v-if="progress.skipped">; {{ progress.skipped }} skipped</template>
        <template v-if="progress.unavailable">; {{ progress.unavailable }} unavailable</template>
      </span>
      <span v-if="isSlow" class="activity-wait">
        {{ progress ? "No new progress reported." : "Still waiting for a response." }}
      </span>
    </span>
    <span class="activity-elapsed" aria-live="off">{{ elapsedSeconds }}s elapsed</span>
  </span>
</template>

<style scoped>
.activity-status {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4em 0.75em;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.activity-wait {
  display: block;
}

.activity-elapsed {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-size: 0.9em;
}
</style>
