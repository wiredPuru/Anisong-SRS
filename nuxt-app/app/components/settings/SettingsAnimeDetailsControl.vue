<script setup lang="ts">
const props = defineProps<{ missingCount: number }>();
const emit = defineEmits<{ saved: [] }>();

interface AnimeDetailsBackfillResult {
  checked: number;
  updated: number;
  skipped: number;
}

const isFetching = ref(false);
const error = ref<string | null>(null);
// useState for the same reason as SettingsCoverArtControl: `saved` refetches
// the page, which remounts this panel and would drop a plain ref.
const result = useState<AnimeDetailsBackfillResult | null>("gaqSrs:animeDetailsBackfillResult", () => null);

const summary = computed(() => {
  const done = result.value;
  if (!done) return null;
  if (!done.checked) return "Nothing was missing.";
  const filled = `Filled ${done.updated} of ${done.checked}.`;
  return done.skipped ? `${filled} ${done.skipped} were not found on AniList and will not be checked again.` : filled;
});

async function fetchMissing() {
  error.value = null;
  result.value = null;
  isFetching.value = true;
  try {
    result.value = await $fetch<AnimeDetailsBackfillResult>("/api/lookup/anime-details-backfill", { method: "POST" });
    emit("saved");
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to fetch anime details.");
  } finally {
    isFetching.value = false;
  }
}
</script>

<template>
  <div class="details-control">
    <div class="details-header">
      <span class="details-title">Anime details</span>
      <span class="details-hint">Year, season, format, AniList score, genres, and tags, used by Study filters.</span>
    </div>

    <p v-if="props.missingCount" class="details-count">
      {{ props.missingCount }} {{ props.missingCount === 1 ? "anime is" : "anime are" }} missing details.
    </p>
    <p v-else class="details-count details-count-clear">Every anime has details.</p>

    <ActivityStatus v-if="isFetching" label="Fetching anime details from AniList" request-key="anime-details-backfill" />
    <button v-else type="button" class="details-btn" :disabled="!props.missingCount" @click="fetchMissing">
      Fetch missing details
    </button>

    <p v-if="summary" class="details-summary">{{ summary }}</p>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.details-control {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.details-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.details-title {
  font-weight: 900;
  font-size: 15px;
}

.details-hint {
  font-size: 12px;
  color: var(--faint);
}

.details-count {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.details-count-clear {
  color: var(--muted);
  font-weight: 400;
}

.details-btn {
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

.details-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.details-summary {
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
