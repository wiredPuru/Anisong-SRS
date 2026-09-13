<script setup lang="ts">
const props = defineProps<{ missingCount: number }>();
const emit = defineEmits<{ saved: [] }>();

interface CoverBackfillResult {
  checked: number;
  updated: number;
  skipped: number;
}

const isFetching = ref(false);
const error = ref<string | null>(null);
// useState, not ref: emitting `saved` re-runs the page's useFetch, whose
// `pending` state unmounts this whole panel and remounts it, which would
// discard a plain ref and leave the run with no visible outcome.
const result = useState<CoverBackfillResult | null>("gaqSrs:coverBackfillResult", () => null);

const summary = computed(() => {
  const done = result.value;
  if (!done) return null;
  if (!done.checked) return "Nothing was missing.";
  const filled = `Filled ${done.updated} of ${done.checked}.`;
  // Worth naming: a skip is permanent for that anime, so a count that never
  // reaches zero is the expected outcome rather than a stuck job.
  return done.skipped ? `${filled} ${done.skipped} had no match on AniList or no cover art there.` : filled;
});

async function fetchMissing() {
  error.value = null;
  result.value = null;
  isFetching.value = true;
  try {
    result.value = await $fetch<CoverBackfillResult>("/api/lookup/cover-backfill", { method: "POST" });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to fetch cover art.");
  } finally {
    isFetching.value = false;
  }
}
</script>

<template>
  <div class="cover-art-control">
    <div class="cover-art-header">
      <span class="cover-art-title">Cover art</span>
      <span class="cover-art-hint">Anime added while AniList was unreachable have no cover image stored.</span>
    </div>

    <p v-if="props.missingCount" class="cover-art-count">
      {{ props.missingCount }} {{ props.missingCount === 1 ? "anime is" : "anime are" }} missing cover art.
    </p>
    <p v-else class="cover-art-count cover-art-count-clear">Every anime has cover art.</p>

    <ActivityStatus v-if="isFetching" label="Fetching cover art from AniList" request-key="cover-backfill" />
    <button v-else type="button" class="cover-art-btn" :disabled="!props.missingCount" @click="fetchMissing">
      Fetch missing cover art
    </button>

    <p v-if="summary" class="cover-art-summary">{{ summary }}</p>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.cover-art-control {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.cover-art-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cover-art-title {
  font-weight: 900;
  font-size: 15px;
}

.cover-art-hint {
  font-size: 12px;
  color: var(--faint);
}

.cover-art-count {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.cover-art-count-clear {
  color: var(--muted);
  font-weight: 400;
}

.cover-art-btn {
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

.cover-art-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.cover-art-summary {
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
