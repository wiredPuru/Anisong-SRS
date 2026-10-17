<script setup lang="ts">
import { isOfflineModeError } from "~/utils/networkMode";

interface AnimeMetadataRefreshResult {
  animeId: number;
  aniListId: number;
  refreshedAt: string;
}

const props = defineProps<{
  animeId: number;
  reloadMetadata: () => Promise<void>;
}>();

const pending = ref(false);
const error = ref<string | null>(null);
const success = ref(false);
const { offlineMode } = useNetworkMode();
const refused = ref(false);
const offline = computed(() => offlineMode.value === true || refused.value);
const requests = createLatestRequest();
onScopeDispose(requests.invalidate);

watch(() => props.animeId, () => {
  requests.invalidate();
  pending.value = false;
  error.value = null;
  success.value = false;
  refused.value = false;
});

async function refresh() {
  if (pending.value || offline.value) return;
  const isCurrent = requests.start();
  const animeId = props.animeId;
  pending.value = true;
  error.value = null;
  success.value = false;
  let saved = false;
  try {
    await $fetch<AnimeMetadataRefreshResult>("/api/lookup/anime-metadata-refresh", {
      method: "POST",
      body: { animeId },
    });
    saved = true;
    await props.reloadMetadata();
    if (isCurrent()) success.value = true;
  } catch (failure) {
    if (isCurrent() && isOfflineModeError(failure)) {
      refused.value = true;
    } else if (isCurrent()) {
      error.value = saved
        ? "Metadata refreshed, but the library could not be reloaded. Reload this page."
        : extractErrorMessage(failure, "Failed to refresh anime metadata. Please try again later.");
    }
  } finally {
    if (isCurrent()) pending.value = false;
  }
}
</script>

<template>
  <div class="metadata-refresh">
    <button
      type="button"
      class="refresh-btn"
      :disabled="pending || offline"
      title="Refresh titles and filter details from AniList for every card of this anime. Local covers and media stay unchanged."
      @click="refresh"
    >
      {{ pending ? "Refreshing anime metadata..." : "Refresh anime metadata" }}
    </button>
    <OfflineNotice v-if="offline" message="Refreshing metadata needs online mode." />
    <p v-if="success" class="refresh-summary" role="status">Anime metadata refreshed for all its cards.</p>
    <p v-if="error" class="refresh-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.metadata-refresh {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.refresh-btn {
  align-self: flex-start;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-summary,
.refresh-error {
  margin: 0;
  font-size: 13px;
}

.refresh-summary {
  color: var(--muted);
}

.refresh-error {
  color: var(--fail);
}
</style>
