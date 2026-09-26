<script setup lang="ts">
import type { StudyFilters } from "~/utils/studyFilters";

// Client copies of server/utils/deckFilterPreview.ts, same field order.
interface FilteredAnime {
  id: number;
  aniListId: number;
  titleEnglish: string;
  titleRomaji: string;
  titleNative: string;
  coverImageUrl: string | null;
  year: number | null;
  format: string | null;
  cardCount: number;
}

interface FilteredAnimePreview {
  anime: FilteredAnime[];
  totalCards: number;
}

export interface CopyFilteredResult {
  added: number;
  alreadyInDeck: number;
}

const PREVIEW_DEBOUNCE_MS = 300;

// With `create`, the modal makes the deck itself from `name`, then adds into it.
const props = defineProps<{ open: boolean; deckId: number | null; deckName: string; create?: boolean }>();
const emit = defineEmits<{ close: []; copied: [CopyFilteredResult]; created: [number] }>();

const draft = ref<StudyFilters>(structuredClone(EMPTY_STUDY_FILTERS));
const preview = ref<FilteredAnimePreview | null>(null);
const previewLoading = ref(false);
const previewError = ref<string | null>(null);
// The filters behind the list on screen, which Add sends rather than a newer
// draft whose preview has not arrived yet.
const shownFilters = ref<string | undefined>(undefined);
// Unticked rather than ticked, so a show that starts matching after a filter
// change arrives ticked.
const unticked = ref(new Set<number>());
const name = ref("");
const createdDeckId = ref<number | null>(null);
const targetDeckId = computed(() => (props.create ? createdDeckId.value : props.deckId));
const submitting = ref(false);
const error = ref<string | null>(null);
const summary = ref<string | null>(null);

const problem = computed(() => studyFiltersProblem(draft.value));

// Each request takes a number; an answer arriving after a newer request was
// sent is dropped, so a slow response can't overwrite a fresher list.
let latestRequest = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

async function loadPreview() {
  const request = ++latestRequest;
  const filters = filtersQueryValue(draft.value);
  previewLoading.value = true;
  previewError.value = null;
  try {
    const result = await $fetch<FilteredAnimePreview>("/api/decks/filter-preview", {
      method: "POST",
      body: { filters },
    });
    if (request === latestRequest) {
      preview.value = result;
      shownFilters.value = filters;
    }
  } catch (err) {
    if (request === latestRequest) previewError.value = extractErrorMessage(err, "Failed to load matching shows.");
  } finally {
    if (request === latestRequest) previewLoading.value = false;
  }
}

// A draft with a problem keeps the last list: the server would only reject it.
watch(draft, () => {
  clearTimeout(debounceTimer);
  if (!props.open || problem.value) return;
  debounceTimer = setTimeout(() => void loadPreview(), PREVIEW_DEBOUNCE_MS);
}, { deep: true });

watch(
  () => props.open,
  (open) => {
    clearTimeout(debounceTimer);
    latestRequest += 1;
    if (!open) {
      createdDeckId.value = null;
      return;
    }
    name.value = props.deckName;
    draft.value = structuredClone(EMPTY_STUDY_FILTERS);
    preview.value = null;
    unticked.value = new Set();
    error.value = null;
    summary.value = null;
    void loadPreview();
  },
);

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function animeMeta(anime: FilteredAnime): string {
  const parts = [anime.year, anime.format ? ANIME_FORMAT_LABELS[anime.format] ?? anime.format : null].filter(Boolean);
  return [...parts, plural(anime.cardCount, "card")].join(" · ");
}

const tickedAnime = computed(() => (preview.value?.anime ?? []).filter((anime) => !unticked.value.has(anime.id)));
const tickedCardTotal = computed(() => tickedAnime.value.reduce((sum, anime) => sum + anime.cardCount, 0));
const hasTarget = computed(() => targetDeckId.value !== null || (props.create === true && name.value.trim() !== ""));
const canAdd = computed(
  () => hasTarget.value && !submitting.value && !previewLoading.value && !problem.value && tickedAnime.value.length > 0,
);

function toggleAnime(id: number) {
  const next = new Set(unticked.value);
  if (!next.delete(id)) next.add(id);
  unticked.value = next;
}

function tickAll() {
  unticked.value = new Set();
}

function untickAll() {
  unticked.value = new Set(preview.value?.anime.map((anime) => anime.id));
}

function describe(result: CopyFilteredResult): string {
  let text = `Added ${plural(result.added, "card")}`;
  if (result.alreadyInDeck) text += ` (${result.alreadyInDeck} already in deck)`;
  return `${text}.`;
}

// Only a failed create returns null; the error is already shown.
async function ensureTargetDeck(): Promise<number | null> {
  if (!props.create) return props.deckId;
  if (createdDeckId.value !== null) return createdDeckId.value;
  try {
    const res = await $fetch<{ deck: { id: number } }>("/api/decks", { method: "POST", body: { name: name.value.trim() } });
    createdDeckId.value = res.deck.id;
    emit("created", res.deck.id);
    return res.deck.id;
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to create deck.");
    return null;
  }
}

async function add() {
  if (!canAdd.value) return;
  submitting.value = true;
  error.value = null;
  summary.value = null;
  const wasCreated = createdDeckId.value !== null;
  const deckId = await ensureTargetDeck();
  if (deckId === null) {
    submitting.value = false;
    return;
  }
  try {
    const result = await $fetch<CopyFilteredResult>("/api/decks/copy-filtered", {
      method: "POST",
      body: { deckId, animeIds: tickedAnime.value.map((anime) => anime.id), filters: shownFilters.value },
    });
    summary.value = describe(result);
    emit("copied", result);
  } catch (err) {
    const message = extractErrorMessage(err, "Failed to add cards.");
    // The deck is kept rather than rolled back, so a retry adds into it.
    error.value = props.create && !wasCreated ? `Deck created, but adding cards failed: ${message}` : message;
  } finally {
    submitting.value = false;
  }
}

function close() {
  if (submitting.value) return;
  emit("close");
}

// Escape closes even from a field, as in StudyFiltersModal: nearly every control
// here is a form input, and Escape is never typed text.
function onKeydown(event: KeyboardEvent) {
  if (props.open && event.key === "Escape" && !event.isComposing) close();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  clearTimeout(debounceTimer);
});
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="close">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="deck-filter-cards-title">
      <button type="button" class="close-btn" aria-label="Close" @click="close">✕</button>

      <h2 id="deck-filter-cards-title">{{ create ? "New deck from filters" : "Add cards from filters" }}</h2>
      <p v-if="create" class="subtitle">Name the deck, then filter your library and pick the shows whose cards it starts with.</p>
      <p v-else class="subtitle">
        Filter your library, then add the matching shows' cards to {{ deckName }}. Cards already in it are skipped.
      </p>

      <input
        v-if="create"
        v-model="name"
        type="text"
        placeholder="Deck name"
        aria-label="Deck name"
        class="name-input"
        :disabled="submitting || createdDeckId !== null"
      />

      <div class="columns">
        <div class="filters-col">
          <StudyFilterForm v-model="draft" />
          <p v-if="problem" class="inline-error">{{ problem }}</p>
        </div>

        <div class="results-col">
          <div class="results-head">
            <span v-if="preview">
              {{ plural(preview.anime.length, "show") }}, {{ plural(preview.totalCards, "card") }}
            </span>
            <span v-if="previewLoading" class="results-loading">Loading...</span>
            <span v-if="preview?.anime.length" class="tick-actions">
              <button type="button" class="link-btn" :disabled="submitting" @click="tickAll">Tick all</button>
              <button type="button" class="link-btn" :disabled="submitting" @click="untickAll">Untick all</button>
            </span>
          </div>
          <p v-if="previewError" class="inline-error">{{ previewError }}</p>
          <p v-else-if="preview && !preview.anime.length" class="empty-note">
            No shows in your library match these filters.
          </p>
          <ul v-if="preview?.anime.length" class="anime-list">
            <li v-for="anime in preview.anime" :key="anime.id">
              <label class="anime-row" :class="{ unticked: unticked.has(anime.id) }">
                <input
                  type="checkbox"
                  class="anime-check"
                  :checked="!unticked.has(anime.id)"
                  :disabled="submitting"
                  @change="toggleAnime(anime.id)"
                />
                <img v-if="anime.coverImageUrl" :src="anime.coverImageUrl" alt="" class="anime-cover" loading="lazy" />
                <span v-else class="anime-cover anime-cover-empty" aria-hidden="true" />
                <span class="anime-text">
                  <span class="anime-title">{{ anime.titleRomaji }}</span>
                  <span class="anime-meta">{{ animeMeta(anime) }}</span>
                </span>
              </label>
            </li>
          </ul>
        </div>
      </div>

      <p v-if="summary" class="summary">{{ summary }}</p>
      <p v-if="error" class="inline-error">{{ error }}</p>

      <div class="modal-actions">
        <span v-if="preview?.anime.length" class="picked-note">
          {{ plural(tickedAnime.length, "show") }}, {{ plural(tickedCardTotal, "card") }}
        </span>
        <button type="button" class="cancel-btn" :disabled="submitting" @click="close">
          {{ summary ? "Done" : "Cancel" }}
        </button>
        <button type="button" class="done-btn" :disabled="!canAdd" @click="add">
          {{ submitting ? "Adding..." : create && createdDeckId === null ? "Create and add" : "Add" }}
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
</style>
