<script setup lang="ts">
import { isUnavailable } from "../../utils/importStream";

const props = defineProps<{ uncheckedCount: number }>();
const emit = defineEmits<{ saved: [] }>();

interface MatchBackfillResult {
  checked: number;
  matched: number;
  missing: number;
  unavailable: number;
}

const isRunning = ref(false);
const error = ref<string | null>(null);
const activity = useImportProgress();
// useState, not ref: emitting `saved` re-runs the page's useFetch, whose
// `pending` state unmounts this whole panel and remounts it, which would
// discard a plain ref and leave the run with no visible outcome.
const result = useState<MatchBackfillResult | null>("gaqSrs:animeThemesMatchResult", () => null);

const summary = computed(() => {
  const done = result.value;
  if (!done) return null;
  if (!done.checked) return "Nothing was left to check.";

  const matched = `Found ${done.matched} of ${done.checked} on AnimeThemes.moe.`;
  const missing = done.missing ? ` ${done.missing} genuinely aren't there.` : "";
  const unavailable = done.unavailable
    ? ` ${done.unavailable} couldn't be checked this time and will be tried again later.`
    : "";

  return `${matched}${missing}${unavailable}`;
});

async function checkSongs() {
  error.value = null;
  result.value = null;
  isRunning.value = true;
  try {
    result.value = await activity.run<MatchBackfillResult>("/api/lookup/animethemes-match", {});
    emit("saved");
  } catch (err) {
    error.value = isUnavailable(err) && err instanceof Error
      ? err.message
      : extractErrorMessage(err, "Failed to check songs against AnimeThemes.moe.");
  } finally {
    isRunning.value = false;
  }
}
</script>

<template>
  <div class="match-control">
    <div class="match-header">
      <span class="match-title">AnimeThemes.moe match</span>
      <span class="match-hint">
        Cards added before this check existed have never been checked against AnimeThemes.moe, so the setting below
        can't yet tell which of them it actually has.
      </span>
    </div>

    <p v-if="props.uncheckedCount" class="match-count">
      {{ props.uncheckedCount }} {{ props.uncheckedCount === 1 ? "song hasn't" : "songs haven't" }} been checked.
    </p>
    <p v-else class="match-count match-count-clear">Every song has been checked.</p>

    <ActivityStatus
      v-if="isRunning"
      label="Checking songs against AnimeThemes.moe"
      request-key="animethemes-match"
      :progress="activity.progress.value"
      :revision="activity.revision.value"
    />
    <button v-else type="button" class="match-btn" :disabled="!props.uncheckedCount" @click="checkSongs">
      Check against AnimeThemes.moe
    </button>

    <p v-if="summary" class="match-summary">{{ summary }}</p>
    <p v-if="error" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.match-control {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.match-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.match-title {
  font-weight: 900;
  font-size: 15px;
}

.match-hint {
  font-size: 12px;
  color: var(--faint);
}

.match-count {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.match-count-clear {
  color: var(--muted);
  font-weight: 400;
}

.match-btn {
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

.match-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.match-summary {
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
