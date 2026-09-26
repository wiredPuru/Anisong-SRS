<script setup lang="ts">
import type { StudyFilters, StudyListSite, StudySeason, StudyThemeType, TagOption } from "~/utils/studyFilters";

interface StudyFilterOptions {
  yearRange: { min: number; max: number } | null;
  formats: string[];
  genres: string[];
  tags: TagOption[];
  missingDetailsCount: number;
}

type Choice = "include" | "exclude";

// Edited in place, so the caller's draft sees every change and the caller
// decides when to apply it.
const draft = defineModel<StudyFilters>({ required: true });

const SEASONS: { value: StudySeason; label: string }[] = [
  { value: "WINTER", label: "Winter" },
  { value: "SPRING", label: "Spring" },
  { value: "SUMMER", label: "Summer" },
  { value: "FALL", label: "Fall" },
];
const THEME_TYPES: { value: StudyThemeType; label: string }[] = [
  { value: "OP", label: "Openings" },
  { value: "ED", label: "Endings" },
  { value: "IN", label: "Inserts" },
];
const TAG_SUGGESTION_LIMIT = 12;
const LIST_SITE_LABELS: Record<StudyListSite, string> = { anilist: "AniList", mal: "MyAnimeList" };

interface ListAnimeResult {
  aniListIds: number[];
  listSize: number;
  matched: number;
}

const options = ref<StudyFilterOptions | null>(null);
const optionsError = ref<string | null>(null);
const tagQuery = ref("");
const listSite = ref<StudyListSite>("anilist");
const listUsername = ref("");
const listLoading = ref(false);
const listError = ref<string | null>(null);
const listNote = ref<string | null>(null);

// Fetched on every mount, and callers mount the form only while open, so tags
// from anime added since the last open show up without a reload.
onMounted(async () => {
  try {
    options.value = await $fetch<StudyFilterOptions>("/api/study/filter-options");
  } catch (err) {
    optionsError.value = extractErrorMessage(err, "Failed to load filter options.");
  }
});

function toBound(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function toggleList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function genreChoice(genre: string): Choice | null {
  if (draft.value.genresInclude.includes(genre)) return "include";
  if (draft.value.genresExclude.includes(genre)) return "exclude";
  return null;
}

// Off, then include, then exclude, then off again.
function cycleGenre(genre: string) {
  const choice = genreChoice(genre);
  draft.value.genresInclude = draft.value.genresInclude.filter((entry) => entry !== genre);
  draft.value.genresExclude = draft.value.genresExclude.filter((entry) => entry !== genre);
  if (choice === null) draft.value.genresInclude.push(genre);
  else if (choice === "include") draft.value.genresExclude.push(genre);
}

const selectedTags = computed(() => [
  ...draft.value.tagsInclude.map((name) => ({ name, choice: "include" as Choice })),
  ...draft.value.tagsExclude.map((name) => ({ name, choice: "exclude" as Choice })),
]);

const chosenTags = computed(() => new Set([...draft.value.tagsInclude, ...draft.value.tagsExclude]));

// Searching reaches every tag, single-show ones included; the empty-search
// breakdown lists only tags two or more shows share.
const tagSuggestions = computed(() => {
  const query = tagQuery.value.trim().toLowerCase();
  if (!query) return [];
  return countTags(options.value?.tags ?? [], draft.value.tagMinRank, chosenTags.value)
    .filter((tag) => tag.name.toLowerCase().includes(query))
    .slice(0, TAG_SUGGESTION_LIMIT);
});

const sharedTags = computed(() => tagBreakdown(options.value?.tags ?? [], draft.value.tagMinRank, chosenTags.value));

function addTag(name: string) {
  draft.value.tagsInclude.push(name);
  tagQuery.value = "";
}

function flipTag(name: string, choice: Choice) {
  removeTag(name);
  (choice === "include" ? draft.value.tagsExclude : draft.value.tagsInclude).push(name);
}

function removeTag(name: string) {
  draft.value.tagsInclude = draft.value.tagsInclude.filter((entry) => entry !== name);
  draft.value.tagsExclude = draft.value.tagsExclude.filter((entry) => entry !== name);
}

async function fetchList(site: StudyListSite, username: string) {
  listLoading.value = true;
  listError.value = null;
  listNote.value = null;
  try {
    const result = await $fetch<ListAnimeResult>("/api/study/list-anime", { query: { site, username } });
    draft.value.listAniListIds = result.aniListIds;
    draft.value.listSource = { site, username, fetchedAt: new Date().toISOString() };
    listNote.value = `${result.matched} of the ${result.listSize} anime on that Completed list ${result.matched === 1 ? "is" : "are"} in your library.`;
  } catch (err) {
    listError.value = extractErrorMessage(err, `Could not load that ${LIST_SITE_LABELS[site]} list.`);
  } finally {
    listLoading.value = false;
  }
}

function useList() {
  const username = listUsername.value.trim();
  if (username) void fetchList(listSite.value, username);
}

function removeList() {
  draft.value.listAniListIds = null;
  draft.value.listSource = null;
  listNote.value = null;
}

const listCheckedOn = computed(() => {
  const fetchedAt = draft.value.listSource?.fetchedAt;
  return fetchedAt ? new Date(fetchedAt).toLocaleDateString() : "";
});
</script>

<template>
  <div class="filter-form">
    <p v-if="optionsError" class="control-error">{{ optionsError }}</p>
    <p v-else-if="options?.missingDetailsCount" class="details-note">
      {{ options.missingDetailsCount }} {{ options.missingDetailsCount === 1 ? "anime is" : "anime are" }}
      missing some AniList details, so filters on them (such as season) leave those anime out.
      <NuxtLink to="/settings">Fetch them in Settings</NuxtLink>.
    </p>

    <section class="group">
      <h3 class="group-title">Theme</h3>
      <div class="pill-row">
        <button
          v-for="type in THEME_TYPES"
          :key="type.value"
          type="button"
          class="pill"
          :class="{ include: draft.themeTypes.includes(type.value) }"
          :aria-pressed="draft.themeTypes.includes(type.value)"
          @click="draft.themeTypes = toggleList(draft.themeTypes, type.value)"
        >
          {{ type.label }}
        </button>
      </div>
    </section>

    <section class="group">
      <h3 class="group-title">Anime list <span class="group-hint">only shows on someone's Completed list</span></h3>
      <template v-if="draft.listSource">
        <div class="list-row">
          <span class="list-chip">
            {{ LIST_SITE_LABELS[draft.listSource.site] }} &middot; {{ draft.listSource.username }}
            &middot; {{ draft.listAniListIds?.length ?? 0 }} in your library
          </span>
          <button
            type="button"
            class="text-btn"
            :disabled="listLoading"
            @click="fetchList(draft.listSource.site, draft.listSource.username)"
          >
            Refresh
          </button>
          <button type="button" class="text-btn" :disabled="listLoading" @click="removeList">Remove</button>
        </div>
        <p class="empty-hint">Checked {{ listCheckedOn }}. Anime added to your library since then join after Refresh.</p>
      </template>
      <form v-else class="list-row" @submit.prevent="useList">
        <select v-model="listSite" class="list-site" aria-label="List site">
          <option value="anilist">AniList</option>
          <option value="mal">MyAnimeList</option>
        </select>
        <input v-model="listUsername" class="list-username" type="text" placeholder="Username" aria-label="List username" autocomplete="off">
        <button type="submit" class="text-btn" :disabled="!listUsername.trim() || listLoading">Use list</button>
      </form>
      <ActivityStatus v-if="listLoading" label="Fetching that Completed list" request-key="study-list-anime" />
      <p v-if="listError" class="control-error">{{ listError }}</p>
      <p v-else-if="listNote" class="empty-hint">{{ listNote }}</p>
    </section>

    <section class="group">
      <h3 class="group-title">Year <span class="group-hint">pick seasons to narrow within those years</span></h3>
      <div class="range-row">
        <input
          class="bound-input"
          type="number"
          inputmode="numeric"
          aria-label="From year"
          :placeholder="String(options?.yearRange?.min ?? 'From')"
          :value="draft.yearMin ?? ''"
          @input="draft.yearMin = toBound(($event.target as HTMLInputElement).value)"
        >
        <span aria-hidden="true">to</span>
        <input
          class="bound-input"
          type="number"
          inputmode="numeric"
          aria-label="To year"
          :placeholder="String(options?.yearRange?.max ?? 'To')"
          :value="draft.yearMax ?? ''"
          @input="draft.yearMax = toBound(($event.target as HTMLInputElement).value)"
        >
      </div>
      <div class="pill-row" role="group" aria-label="Season">
        <button
          v-for="season in SEASONS"
          :key="season.value"
          type="button"
          class="pill"
          :class="{ include: draft.seasons.includes(season.value) }"
          :aria-pressed="draft.seasons.includes(season.value)"
          @click="draft.seasons = toggleList(draft.seasons, season.value)"
        >
          {{ season.label }}
        </button>
      </div>
    </section>

    <section class="group">
      <h3 class="group-title">AniList score</h3>
      <div class="range-row">
        <input
          class="bound-input"
          type="number"
          inputmode="numeric"
          aria-label="Minimum score"
          placeholder="0"
          :value="draft.scoreMin ?? ''"
          @input="draft.scoreMin = toBound(($event.target as HTMLInputElement).value)"
        >
        <span aria-hidden="true">to</span>
        <input
          class="bound-input"
          type="number"
          inputmode="numeric"
          aria-label="Maximum score"
          placeholder="100"
          :value="draft.scoreMax ?? ''"
          @input="draft.scoreMax = toBound(($event.target as HTMLInputElement).value)"
        >
      </div>
    </section>

    <section v-if="options?.formats.length" class="group">
      <h3 class="group-title">Format</h3>
      <div class="pill-row">
        <button
          v-for="format in options.formats"
          :key="format"
          type="button"
          class="pill"
          :class="{ include: draft.formats.includes(format) }"
          :aria-pressed="draft.formats.includes(format)"
          @click="draft.formats = toggleList(draft.formats, format)"
        >
          {{ ANIME_FORMAT_LABELS[format] ?? format }}
        </button>
      </div>
    </section>

    <section v-if="options?.genres.length" class="group">
      <h3 class="group-title">Genres <span class="group-hint">tap once to require, twice to exclude</span></h3>
      <div class="pill-row">
        <button
          v-for="genre in options.genres"
          :key="genre"
          type="button"
          class="pill"
          :class="genreChoice(genre)"
          @click="cycleGenre(genre)"
        >
          <span v-if="genreChoice(genre)" aria-hidden="true">{{ genreChoice(genre) === "include" ? "+" : "−" }}</span>
          {{ genre }}
          <span class="sr-only">{{ genreChoice(genre) === "include" ? "(required)" : genreChoice(genre) === "exclude" ? "(excluded)" : "" }}</span>
        </button>
      </div>
    </section>

    <section class="group">
      <h3 class="group-title">Tags <span class="group-hint">tap a chosen tag to switch require / exclude</span></h3>
      <div v-if="selectedTags.length" class="pill-row">
        <span v-for="tag in selectedTags" :key="tag.name" class="tag-chip" :class="tag.choice">
          <button type="button" class="tag-chip-flip" @click="flipTag(tag.name, tag.choice)">
            {{ tag.choice === "include" ? "+" : "−" }} {{ tag.name }}
          </button>
          <button type="button" class="tag-chip-remove" :aria-label="`Remove ${tag.name}`" @click="removeTag(tag.name)">✕</button>
        </span>
      </div>
      <input v-model="tagQuery" class="tag-search" type="search" placeholder="Search tags, e.g. Cute Girls Doing Cute Things" aria-label="Search tags">
      <template v-if="tagQuery.trim()">
        <div v-if="tagSuggestions.length" class="pill-row">
          <button v-for="tag in tagSuggestions" :key="tag.name" type="button" class="pill" @click="addTag(tag.name)">
            {{ tag.name }} <span class="tag-count">{{ tag.count }}</span>
          </button>
        </div>
        <p v-else-if="options" class="empty-hint">No tag in your library matches that.</p>
      </template>
      <template v-else-if="options?.tags.length">
        <p class="breakdown-label">Shared by 2+ shows <span class="tag-count">{{ sharedTags.length }}</span></p>
        <div v-if="sharedTags.length" class="pill-row tag-breakdown">
          <button v-for="tag in sharedTags" :key="tag.name" type="button" class="pill" @click="addTag(tag.name)">
            {{ tag.name }} <span class="tag-count">{{ tag.count }}</span>
          </button>
        </div>
        <p v-else class="empty-hint">No tag is shared by 2+ shows at this relevance.</p>
      </template>
      <label class="rank-row">
        <span>Tag must be at least {{ draft.tagMinRank }}% relevant</span>
        <input v-model.number="draft.tagMinRank" type="range" min="0" max="100" step="5">
      </label>
    </section>
  </div>
</template>

<style scoped>
.filter-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.empty-hint,
.group-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
}

.details-note {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--muted);
  font-size: 13px;
}

.details-note a {
  color: var(--accent-secondary);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}

.group-hint {
  font-size: 12px;
  margin-left: 6px;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.pill.include,
.tag-chip.include {
  border-color: var(--pass);
  color: var(--pass);
}

.pill.exclude,
.tag-chip.exclude {
  border-color: var(--fail);
  color: var(--fail);
}

.tag-count {
  color: var(--faint);
  font-weight: 400;
}

.breakdown-label {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.tag-breakdown {
  max-height: 180px;
  overflow-y: auto;
  padding: 2px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
}

.tag-chip-flip,
.tag-chip-remove {
  border: none;
  background: transparent;
  color: inherit;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.tag-chip-flip {
  padding: 6px 4px 6px 12px;
}

.tag-chip-remove {
  padding: 6px 10px 6px 4px;
  color: var(--faint);
}

.range-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 13px;
}

.list-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.list-chip {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--pass);
  color: var(--pass);
  font-size: 13px;
  font-weight: 700;
}

.list-username {
  flex: 1;
  min-width: 140px;
}

.bound-input,
.tag-search,
.list-site,
.list-username {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.bound-input {
  width: 96px;
}

.rank-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--muted);
  font-size: 13px;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}

.text-btn {
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.text-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
