<script setup lang="ts">
import { browseAnimeMeta, selectedForRun, MAX_BROWSE_IMPORT } from "~/utils/browseSelection";
import { deckTargetProblem, NO_DECK_TARGET, resolveDeckTarget, type DeckTarget } from "~/utils/deckTarget";
import { importAnimeBatch, type ImportBatchProgress, type ImportBatchResult, type ImportOneResult } from "~/utils/importAnimeBatch";
import { createLatestRequest } from "~/utils/latestRequest";
import { libraryFilterActive, libraryQuery, type LibraryFilter } from "~/utils/libraryFilter";

const BROWSE_DEBOUNCE_MS = 300;

// applied: the library filter the Cards list is already showing, so reopening
// starts from it instead of an empty form.
const props = defineProps<{ open: boolean; applied: LibraryFilter }>();
const emit = defineEmits<{ close: []; imported: []; "show-library": [filter: LibraryFilter] }>();

type Mode = "add" | "library";
const mode = ref<Mode>("add");

const draft = ref<StudyFilters>(structuredClone(EMPTY_STUDY_FILTERS));
const libraryDraft = ref<StudyFilters>(structuredClone(EMPTY_STUDY_FILTERS));
const downloadedOnly = ref(false);
const matchCount = ref<number | null>(null);
const matchLoading = ref(false);
const matchError = ref<string | null>(null);
const { results, hasNextPage, loading, loadingMore, loadError, loadFirst: fetchFirst, loadMore: fetchMore, invalidate } = useAniListBrowse(draft);
const unticked = ref(new Set<number>());
const sentinelRef = ref<HTMLElement | null>(null);

const running = ref(false);
const stopRun = ref(false);
const progress = ref<ImportBatchProgress | null>(null);
const summary = ref<ImportBatchResult | null>(null);
const deckTarget = ref<DeckTarget>(NO_DECK_TARGET);
const deckSummaryId = ref<number | null>(null);
const runError = ref<string | null>(null);

const problem = computed(() => studyFiltersProblem(draft.value));
const libraryFilter = computed<LibraryFilter>(() => ({ filters: libraryDraft.value, downloadedOnly: downloadedOnly.value }));
const libraryProblem = computed(() => studyFiltersProblem(libraryDraft.value));
const libraryActive = computed(() => libraryFilterActive(libraryFilter.value));
const canShow = computed(() => libraryActive.value && !libraryProblem.value && !matchLoading.value && matchCount.value !== null);
const run = computed(() => selectedForRun(results.value, unticked.value));
const targetProblem = computed(() => deckTargetProblem(deckTarget.value));
const canAdd = computed(() => !running.value && !loading.value && !problem.value && !targetProblem.value && run.value.ids.length > 0);

const matchRequests = createLatestRequest();
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | null = null;

async function loadFirst() {
  if (await fetchFirst()) unticked.value = new Set();
}

function loadMore() {
  if (!running.value) void fetchMore();
}

// The library list route already answers "how many", so the count asks it for
// the first page and reads `total`; nothing is fetched until a filter is set.
async function loadMatchCount() {
  const isCurrent = matchRequests.start();
  matchError.value = null;
  if (!libraryActive.value || libraryProblem.value) {
    matchCount.value = null;
    matchLoading.value = false;
    return;
  }
  matchLoading.value = true;
  try {
    const reply = await $fetch<{ total: number }>("/api/cards", { query: { page: 1, ...libraryQuery(libraryFilter.value) } });
    if (isCurrent()) matchCount.value = reply.total;
  } catch (err) {
    if (isCurrent()) {
      matchCount.value = null;
      matchError.value = extractErrorMessage(err, "Could not search your library.");
    }
  } finally {
    if (isCurrent()) matchLoading.value = false;
  }
}

watch(draft, () => {
  clearTimeout(debounceTimer);
  if (!props.open || mode.value !== "add" || problem.value || running.value) return;
  debounceTimer = setTimeout(() => void loadFirst(), BROWSE_DEBOUNCE_MS);
}, { deep: true });

watch([libraryDraft, downloadedOnly], () => {
  clearTimeout(debounceTimer);
  if (!props.open || mode.value !== "library") return;
  debounceTimer = setTimeout(() => void loadMatchCount(), BROWSE_DEBOUNCE_MS);
}, { deep: true });

watch(mode, (next) => {
  clearTimeout(debounceTimer);
  if (!props.open) return;
  if (next === "add") void loadFirst();
  else void loadMatchCount();
});

watch(() => props.open, (open) => {
  clearTimeout(debounceTimer);
  invalidate();
  matchRequests.invalidate();
  if (!open) {
    mode.value = "add";
    return;
  }
  libraryDraft.value = structuredClone(toRaw(props.applied.filters));
  downloadedOnly.value = props.applied.downloadedOnly;
  matchCount.value = null;
  matchError.value = null;
  draft.value = structuredClone(EMPTY_STUDY_FILTERS);
  results.value = [];
  summary.value = null;
  progress.value = null;
  stopRun.value = false;
  runError.value = null;
  deckTarget.value = NO_DECK_TARGET;
  void loadFirst();
});

watch(sentinelRef, (el, previous) => {
  if (previous) observer?.unobserve(previous);
  if (el) observer?.observe(el);
});

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
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
  if (deckSummaryId.value !== null) parts.push(`${plural(result.addedToDeck, "card")} joined the deck.`);
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
  runError.value = null;
  let deckId: number | null;
  try {
    deckId = await resolveDeckTarget(
      deckTarget.value,
      async (name) => (await $fetch<{ deck: { id: number } }>("/api/decks", { method: "POST", body: { name } })).deck.id,
      (next) => { deckTarget.value = next; },
    );
  } catch (err) {
    runError.value = extractErrorMessage(err, "Could not create the deck.");
    running.value = false;
    return;
  }
  deckSummaryId.value = deckId;
  try {
    summary.value = await importAnimeBatch(
      run.value.ids,
      (aniListId) => $fetch<ImportOneResult>("/api/lookup/import-cards", {
        method: "POST",
        body: deckId === null ? { aniListId } : { aniListId, deckId },
      }),
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

function showInLibrary() {
  if (!canShow.value) return;
  emit("show-library", { filters: structuredClone(toRaw(libraryDraft.value)), downloadedOnly: downloadedOnly.value });
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
      <div class="mode-seg" role="group" aria-label="What to do with the filters">
        <button type="button" class="mode-seg-btn" :class="{ active: mode === 'add' }" :aria-pressed="mode === 'add'" :disabled="running" @click="mode = 'add'">
          Add from AniList
        </button>
        <button type="button" class="mode-seg-btn" :class="{ active: mode === 'library' }" :aria-pressed="mode === 'library'" :disabled="running" @click="mode = 'library'">
          Search my library
        </button>
      </div>
      <p class="subtitle">
        <template v-if="mode === 'add'">
          Search AniList's whole catalog by genre, tag, year, and more, then add the shows you want. Most popular first.
        </template>
        <template v-else>
          Find cards you already have, such as the insert songs you have downloaded. Searching adds and changes nothing.
        </template>
      </p>

      <template v-if="mode === 'add'">
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
                    <span class="anime-meta">{{ browseAnimeMeta(anime) }}</span>
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
        <p v-if="runError" class="inline-error">{{ runError }}</p>
        <p v-if="run.truncated" class="picked-note">Only the first {{ MAX_BROWSE_IMPORT }} ticked shows are added per run.</p>

        <DeckTargetPicker v-model="deckTarget" :disabled="running" />
        <p v-if="targetProblem" class="picked-note">{{ targetProblem }}</p>

        <div class="modal-actions">
          <span v-if="run.ids.length" class="picked-note">{{ plural(run.ids.length, "show") }} ticked</span>
          <button type="button" class="cancel-btn" :disabled="running" @click="close">{{ summary ? "Done" : "Cancel" }}</button>
          <button type="button" class="done-btn" :disabled="!canAdd" @click="add">
            {{ running ? "Adding..." : `Add ${plural(run.ids.length, "show")}` }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="columns">
          <div class="filters-col">
            <label class="downloaded-row">
              <input v-model="downloadedOnly" type="checkbox" />
              <span>Downloaded only <span class="downloaded-hint">has a local video or audio file</span></span>
            </label>
            <StudyFilterForm v-model="libraryDraft" hide-list />
            <p v-if="libraryProblem" class="inline-error">{{ libraryProblem }}</p>
          </div>

          <div class="results-col">
            <p v-if="matchError" class="inline-error">{{ matchError }}</p>
            <p v-else-if="!libraryActive" class="empty-note">Pick a filter, or tick Downloaded only, to see how many cards match.</p>
            <p v-else-if="matchLoading && matchCount === null" class="results-loading">Searching your library...</p>
            <p v-else-if="matchCount !== null" class="match-count" :class="{ stale: matchLoading }">
              {{ plural(matchCount, "card") }} match
            </p>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="cancel-btn" @click="close">Close</button>
          <button type="button" class="done-btn" :disabled="!canShow" @click="showInLibrary">
            {{ matchCount !== null && libraryActive ? `Show ${plural(matchCount, "card")}` : "Show cards" }}
          </button>
        </div>
      </template>
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
  border: 1px solid var(--outline);
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

.mode-seg {
  display: flex;
  flex: none;
  align-self: flex-start;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.mode-seg-btn {
  padding: 8px 16px;
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.mode-seg-btn:first-child {
  border-left: none;
}

.mode-seg-btn.active {
  background: var(--surface-raised);
  color: var(--text);
}

.mode-seg-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.downloaded-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.downloaded-hint {
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}

.match-count {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: var(--text);
}

.match-count.stale {
  opacity: 0.5;
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
