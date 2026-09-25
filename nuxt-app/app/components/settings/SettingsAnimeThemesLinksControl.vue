<script setup lang="ts">
import { isUnavailable } from "../../utils/importStream";

const props = defineProps<{ missingCount: number }>();
const emit = defineEmits<{ saved: [] }>();

interface LinkBackfillResult {
  checked: number;
  filled: number;
  notFound: number;
  unavailable: number;
}

const isRunning = ref(false);
const error = ref<string | null>(null);
const activity = useImportProgress();
// useState, not ref: emitting `saved` re-runs the page's useFetch, whose
// `pending` state unmounts this whole panel and remounts it, which would
// discard a plain ref and leave the run with no visible outcome.
const result = useState<LinkBackfillResult | null>("gaqSrs:animeThemesLinksResult", () => null);

const summary = computed(() => {
  const done = result.value;
  if (!done) return null;
  if (!done.checked) return "Nothing was missing.";

  const filled = `Filled links for ${done.filled} of ${done.checked} anime.`;
  // A not-found anime stays in the count, so name it rather than leave a
  // number that never reaches zero looking like a stuck job.
  const notFound = done.notFound ? ` ${done.notFound} weren't found on AnimeThemes.moe.` : "";
  const unavailable = done.unavailable
    ? ` ${done.unavailable} couldn't be checked this time and will be tried again later.`
    : "";

  return `${filled}${notFound}${unavailable}`;
});

async function fillLinks() {
  error.value = null;
  result.value = null;
  isRunning.value = true;
  try {
    result.value = await activity.run<LinkBackfillResult>("/api/lookup/animethemes-links", {});
    emit("saved");
  } catch (err) {
    error.value = isUnavailable(err) && err instanceof Error
      ? err.message
      : extractErrorMessage(err, "Failed to fetch AnimeThemes.moe links.");
  } finally {
    isRunning.value = false;
  }
}
</script>

<template>
  <div class="links-control">
    <div class="links-header">
      <span class="links-title">AnimeThemes.moe links</span>
      <span class="links-hint">
        Cards added before links existed don't know which AnimeThemes.moe page to open.
      </span>
    </div>

    <p v-if="props.missingCount" class="links-count">
      {{ props.missingCount }} {{ props.missingCount === 1 ? "anime is" : "anime are" }} missing links.
    </p>
    <p v-else class="links-count links-count-clear">Every anime has its links.</p>

    <ActivityStatus
      v-if="isRunning"
      label="Fetching AnimeThemes.moe links"
      request-key="animethemes-links"
      :progress="activity.progress.value"
      :revision="activity.revision.value"
    />
    <button v-else type="button" class="links-btn" :disabled="!props.missingCount" @click="fillLinks">
      Fill AnimeThemes.moe links
    </button>

    <p v-if="summary" class="links-summary">{{ summary }}</p>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.links-control {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.links-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.links-title {
  font-weight: 900;
  font-size: 15px;
}

.links-hint {
  font-size: 12px;
  color: var(--faint);
}

.links-count {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.links-count-clear {
  color: var(--muted);
  font-weight: 400;
}

.links-btn {
  align-self: flex-start;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.links-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.links-summary {
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
