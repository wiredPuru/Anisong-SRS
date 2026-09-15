<script setup lang="ts">
import { isUnavailable } from "../../utils/importStream";

const props = defineProps<{ count: number; clipSource: "anisongdb" | "both" | "animethemes" }>();
const emit = defineEmits<{ saved: [] }>();

// The only host this action ever moves a card onto is AMQ's, which
// "animethemes"-only mode excludes - so there's nothing safe for it to do in
// that mode, distinct from "count is 0 because every card already moved".
const disabledByClipSource = computed(() => props.clipSource === "animethemes");

interface SourceRefreshResult {
  checked: number;
  updated: number;
  skipped: number;
  animeUnavailable: number;
}

const isRunning = ref(false);
const error = ref<string | null>(null);
const activity = useImportProgress();
// useState, not ref: emitting `saved` re-runs the page's useFetch, whose
// `pending` state unmounts this whole panel and remounts it, which would
// discard a plain ref and leave the run with no visible outcome.
const result = useState<SourceRefreshResult | null>("gaqSrs:sourceRefreshResult", () => null);

const summary = computed(() => {
  const done = result.value;
  if (!done) return null;
  if (!done.checked) return "Nothing was left to move.";

  const moved = `Moved ${done.updated} of ${done.checked} card${done.checked === 1 ? "" : "s"}.`;
  // Worth naming: a skip is permanent for that card, so a count that never
  // reaches zero is the expected outcome rather than a stuck job.
  const skipped = done.skipped
    ? ` ${done.skipped} had no confident match on AnisongDB and will be skipped again.`
    : "";
  const unavailable = done.animeUnavailable
    ? ` ${done.animeUnavailable} anime couldn't be looked up this time; run it again later.`
    : "";

  return `${moved}${skipped}${unavailable}`;
});

async function moveSources() {
  error.value = null;
  result.value = null;
  isRunning.value = true;
  try {
    result.value = await activity.run<SourceRefreshResult>("/api/lookup/source-refresh", {});
    emit("saved");
  } catch (err) {
    // A provider outage arrives as a plain Error carrying the provider's own
    // message, which extractErrorMessage cannot see: it only reads $fetch's
    // `data` shape, so it would flatten the one useful message to the fallback.
    error.value = isUnavailable(err) && err instanceof Error
      ? err.message
      : extractErrorMessage(err, "Failed to move card sources.");
  } finally {
    isRunning.value = false;
  }
}
</script>

<template>
  <div class="card-source-control">
    <div class="card-source-header">
      <span class="card-source-title">Clip sources</span>
      <span class="card-source-hint">
        Cards added before AnisongDB became the default still stream from the slower animethemes.moe.
      </span>
    </div>

    <p v-if="disabledByClipSource" class="card-source-count card-source-count-clear">
      Not available - your <NuxtLink to="/settings?section=playback">Clip source setting</NuxtLink> only allows
      animethemes.moe, so there's no faster source to move cards to.
    </p>
    <template v-else>
      <p v-if="props.count" class="card-source-count">
        {{ props.count }} {{ props.count === 1 ? "card streams" : "cards stream" }} from animethemes.moe.
      </p>
      <p v-else class="card-source-count card-source-count-clear">Every card already uses the faster source.</p>

      <ActivityStatus
        v-if="isRunning"
        label="Re-resolving clip sources"
        request-key="source-refresh"
        :progress="activity.progress.value"
        :revision="activity.revision.value"
      />
      <button v-else type="button" class="card-source-btn" :disabled="!props.count" @click="moveSources">
        Move cards to the faster source
      </button>

      <p v-if="summary" class="card-source-summary">{{ summary }}</p>
      <p v-if="error" class="control-error">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.card-source-control {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.card-source-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.card-source-title {
  font-weight: 900;
  font-size: 15px;
}

.card-source-hint {
  font-size: 12px;
  color: var(--faint);
}

.card-source-count {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.card-source-count-clear {
  color: var(--muted);
  font-weight: 400;
}

.card-source-count-clear a {
  color: var(--accent);
}

.card-source-btn {
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

.card-source-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.card-source-summary {
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
