<script setup lang="ts">
import { type BrowseAnime, mergePage, selectedForRun, MAX_BROWSE_IMPORT } from "~/utils/browseSelection";
import { importAnimeBatch, type ImportBatchProgress, type ImportBatchResult, type ImportOneResult } from "~/utils/importAnimeBatch";
import { createLatestRequest } from "~/utils/latestRequest";

interface BrowseReply {
  results: BrowseAnime[];
  hasNextPage: boolean;
}

const BROWSE_DEBOUNCE_MS = 300;

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; imported: [] }>();

const draft = ref<StudyFilters>(structuredClone(EMPTY_STUDY_FILTERS));
const results = ref<BrowseAnime[]>([]);
const page = ref(0);
const hasNextPage = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref<string | null>(null);
const unticked = ref(new Set<number>());
const sentinelRef = ref<HTMLElement | null>(null);

const running = ref(false);
const stopRun = ref(false);
const progress = ref<ImportBatchProgress | null>(null);
const summary = ref<ImportBatchResult | null>(null);

const problem = computed(() => studyFiltersProblem(draft.value));
const run = computed(() => selectedForRun(results.value, unticked.value));
const canAdd = computed(() => !running.value && !loading.value && !problem.value && run.value.ids.length > 0);

const requests = createLatestRequest();
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | null = null;

async function fetchPage(nextPage: number): Promise<BrowseReply | null> {
  const isCurrent = requests.start();
  try {
    const reply = await $fetch<BrowseReply>("/api/lookup/anilist-browse", {
      method: "POST",
      body: { filters: toBrowseFilters(draft.value), page: nextPage },
    });
    return isCurrent() ? reply : null;
  } catch (err) {
    if (isCurrent()) loadError.value = extractErrorMessage(err, "Could not search AniList.");
    return null;
  }
}

// A filter change restarts from page 1; an answer that arrives after a newer
// request was sent is dropped, so a slow response cannot overwrite a fresher list.
async function loadFirst() {
  loading.value = true;
  loadingMore.value = false;
  loadError.value = null;
  const reply = await fetchPage(1);
  if (reply) {
    results.value = reply.results;
    page.value = 1;
    hasNextPage.value = reply.hasNextPage;
    unticked.value = new Set();
    loading.value = false;
  } else if (loadError.value) {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNextPage.value || loading.value || loadingMore.value || running.value) return;
  loadingMore.value = true;
  const reply = await fetchPage(page.value + 1);
  if (reply) {
    results.value = mergePage(results.value, reply.results);
    page.value += 1;
    hasNextPage.value = reply.hasNextPage;
    loadingMore.value = false;
  } else if (loadError.value) {
    loadingMore.value = false;
  }
}

watch(draft, () => {
  clearTimeout(debounceTimer);
  if (!props.open || problem.value || running.value) return;
  debounceTimer = setTimeout(() => void loadFirst(), BROWSE_DEBOUNCE_MS);
}, { deep: true });

watch(() => props.open, (open) => {
  clearTimeout(debounceTimer);
  requests.invalidate();
  if (!open) return;
  draft.value = structuredClone(EMPTY_STUDY_FILTERS);
  results.value = [];
  summary.value = null;
  progress.value = null;
  stopRun.value = false;
  void loadFirst();
});

watch(sentinelRef, (el, previous) => {
  if (previous) observer?.unobserve(previous);
  if (el) observer?.observe(el);
});

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function animeMeta(anime: BrowseAnime): string {
  const format = anime.format ? ANIME_FORMAT_LABELS[anime.format] ?? anime.format : null;
  const score = anime.averageScore !== null ? `${anime.averageScore}%` : null;
  return [anime.year, format, score].filter(Boolean).join(" · ");
}

function toggle(id: number) {
  const next = new Set(unticked.value);
  if (!next.delete(id)) next.add(id);
  unticked.value = next;
}

function tickAll() {
  unticked.value = new Set();
}

function untickAll() {
  unticked.value = new Set(results.value.map((anime) => anime.aniListId));
}

function summaryText(result: ImportBatchResult): string {
  const parts = [`Added ${plural(result.added, "card")} from ${plural(result.done - result.failed, "show")}.`];
  if (result.cancelled) parts.push("Stopped early.");
  if (result.failed) parts.push(`${result.failed} failed.`);
  if (result.empty) parts.push(`${result.empty} had nothing addable under your clip settings.`);
  return parts.join(" ");
}

async function add() {
  if (!canAdd.value) return;
  running.value = true;
  stopRun.value = false;
  summary.value = null;
  progress.value = null;
  try {
    summary.value = await importAnimeBatch(
      run.value.ids,
      (aniListId) => $fetch<ImportOneResult>("/api/lookup/import-cards", { method: "POST", body: { aniListId } }),
      { shouldStop: () => stopRun.value, onProgress: (value) => (progress.value = value) },
    );
  } finally {
    running.value = false;
    progress.value = null;
  }
  emit("imported");
  await loadFirst();
}

function close() {
  if (running.value) return;
  emit("close");
}

function onKeydown(event: KeyboardEvent) {
  if (props.open && event.key === "Escape" && !event.isComposing) close();
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) void loadMore();
  });
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  clearTimeout(debounceTimer);
  observer?.disconnect();
});
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="close">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="card-browse-title">
      <button type="button" class="close-btn" aria-label="Close" :disabled="running" @click="close">✕</button>

      <h2 id="card-browse-title">Browse by filters</h2>
      <p class="subtitle">
        Search AniList's whole catalog by genre, tag, year, and more, then add the shows you want. Most popular first.
      </p>

      <div class="columns">
        <div class="filters-col">
          <StudyFilterForm v-model="draft" catalog />
          <p v-if="problem" class="inline-error">{{ problem }}</p>
        </div>

        <div class="results-col">
          <div class="results-head">
            <span v-if="!loading">{{ plural(results.length, "show") }}{{ hasNextPage ? "+" : "" }} loaded</span>
            <span v-if="loading" class="results-loading">Searching AniList...</span>
            <span v-if="results.length" class="tick-actions">
              <button type="button" class="link-btn" :disabled="running" @click="tickAll">Tick all</button>
              <button type="button" class="link-btn" :disabled="running" @click="untickAll">Untick all</button>
            </span>
          </div>
          <p v-if="loadError" class="inline-error">{{ loadError }}</p>
          <p v-else-if="!loading && !results.length" class="empty-note">No shows on AniList match these filters.</p>
          <ul v-if="results.length" class="anime-list">
            <li v-for="anime in results" :key="anime.aniListId">
              <label class="anime-row" :class="{ unticked: unticked.has(anime.aniListId), 'in-library': anime.inLibrary }">
                <input
                  type="checkbox"
                  class="anime-check"
                  :checked="!anime.inLibrary && !unticked.has(anime.aniListId)"
                  :disabled="running || anime.inLibrary"
                  @change="toggle(anime.aniListId)"
                />
                <img v-if="anime.coverImageUrl" :src="anime.coverImageUrl" alt="" class="anime-cover" loading="lazy" />
                <span v-else class="anime-cover anime-cover-empty" aria-hidden="true" />
                <span class="anime-text">
                  <span class="anime-title">{{ anime.titleRomaji }}</span>
                  <span class="anime-meta">{{ animeMeta(anime) }}</span>
                </span>
                <span v-if="anime.inLibrary" class="library-badge">In library &middot; {{ plural(anime.cardCount, "card") }}</span>
              </label>
            </li>
          </ul>
          <div v-if="hasNextPage" ref="sentinelRef" class="sentinel" />
          <p v-if="loadingMore" class="results-loading">Loading more...</p>
        </div>
      </div>

      <div v-if="running" class="run-progress" role="status">
        <span>Importing {{ (progress?.done ?? 0) + 1 }} of {{ progress?.total ?? run.ids.length }}<span v-if="progress?.current"> &middot; {{ progress.current }}</span></span>
        <progress class="run-bar" :value="progress?.done ?? 0" :max="progress?.total ?? run.ids.length" />
        <button type="button" class="cancel-btn" :disabled="stopRun" @click="stopRun = true">{{ stopRun ? "Stopping..." : "Cancel" }}</button>
      </div>
      <p v-if="summary" class="summary">{{ summaryText(summary) }}</p>
      <p v-if="run.truncated" class="picked-note">Only the first {{ MAX_BROWSE_IMPORT }} ticked shows are added per run.</p>

      <div class="modal-actions">
        <span v-if="run.ids.length" class="picked-note">{{ plural(run.ids.length, "show") }} ticked</span>
        <button type="button" class="cancel-btn" :disabled="running" @click="close">{{ summary ? "Done" : "Cancel" }}</button>
        <button type="button" class="done-btn" :disabled="!canAdd" @click="add">
          {{ running ? "Adding..." : `Add ${plural(run.ids.length, "show")}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: var(--z-modal);
}

.panel {
  position: relative;
  width: 100%;
  max-width: 960px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border-radius: calc(var(--radius) + 8px);
  background: var(--bg);
  border: 2px solid var(--outline);
  box-shadow: var(--shadow-soft);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
}

h2 {
  margin: 0 24px 0 0;
  font-size: 20px;
  font-weight: 800;
}

.subtitle {
  margin: -4px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.name-input {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.name-input:disabled {
  opacity: 0.6;
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  min-height: 0;
  flex: 1;
}

.filters-col,
.results-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.results-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  min-height: 20px;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}

.tick-actions {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.link-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.results-loading,
.empty-note {
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
}

.empty-note {
  margin: 0;
}

.anime-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.anime-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
}

.anime-row.unticked {
  opacity: 0.55;
}

.anime-check {
  flex-shrink: 0;
}

.anime-cover {
  width: 36px;
  height: 50px;
  flex-shrink: 0;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.anime-cover-empty {
  background: var(--surface-raised);
}

.anime-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.anime-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.anime-meta {
  font-size: 12px;
  color: var(--muted);
}

.summary {
  margin: 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--pass);
  color: var(--text);
  font-size: 14px;
}

.inline-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}

.picked-note {
  margin-right: auto;
  color: var(--muted);
  font-size: 13px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.cancel-btn,
.done-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}

.done-btn {
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
}

.cancel-btn:disabled,
.done-btn:disabled,
.link-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 820px) {
  .panel {
    padding: 20px;
    overflow-y: auto;
  }

  .columns {
    flex: none;
    grid-template-columns: minmax(0, 1fr);
  }

  .filters-col,
  .results-col {
    overflow-y: visible;
  }
}

.anime-row.in-library {
  opacity: 0.6;
  cursor: default;
}

.library-badge {
  margin-left: auto;
  flex: none;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--pass);
  color: var(--pass);
  font-size: 12px;
  font-weight: 700;
}

.sentinel {
  height: 1px;
}

.run-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
}

.run-bar {
  flex: 1;
  accent-color: var(--accent);
}
</style>
