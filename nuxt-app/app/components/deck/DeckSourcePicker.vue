<script setup lang="ts">
export interface PickedDeckSource {
  type: "artist" | "anime" | "created";
  id: number;
  label: string;
  cardCount: number;
}

interface DeckListRow {
  id: number;
  name?: string;
  titleEnglish?: string;
  titleRomaji?: string;
  cardCount: number;
}

const props = defineProps<{ modelValue: PickedDeckSource[]; excludeDeckId: number | null }>();
const emit = defineEmits<{ "update:modelValue": [PickedDeckSource[]] }>();

const TABS: { type: PickedDeckSource["type"]; label: string }[] = [
  { type: "anime", label: "By title" },
  { type: "artist", label: "By artist" },
  { type: "created", label: "Created" },
];

const activeTab = ref<PickedDeckSource["type"]>("anime");
const query = ref("");
const results = ref<PickedDeckSource[]>([]);
const pending = ref(false);
const error = ref<string | null>(null);
const requests = createLatestRequest();
let debounce: ReturnType<typeof setTimeout> | null = null;

function toSource(type: PickedDeckSource["type"], row: DeckListRow): PickedDeckSource {
  const label = type === "anime" ? row.titleEnglish || row.titleRomaji || "" : row.name ?? "";
  return { type, id: row.id, label, cardCount: row.cardCount };
}

async function load() {
  const isCurrent = requests.start();
  const type = activeTab.value;
  pending.value = true;
  error.value = null;
  try {
    const res = await $fetch<{ decks: DeckListRow[] }>("/api/decks", {
      query: { type, q: query.value.trim() || undefined },
    });
    if (!isCurrent()) return;
    results.value = res.decks
      .filter((row) => !(type === "created" && row.id === props.excludeDeckId))
      .map((row) => toSource(type, row));
  } catch (err) {
    if (!isCurrent()) return;
    results.value = [];
    error.value = extractErrorMessage(err, "Failed to load decks.");
  } finally {
    if (isCurrent()) pending.value = false;
  }
}

function onInput() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(load, 250);
}

function setTab(type: PickedDeckSource["type"]) {
  if (type === activeTab.value) return;
  activeTab.value = type;
  query.value = "";
  results.value = [];
  load();
}

function isPicked(source: PickedDeckSource): boolean {
  return props.modelValue.some((s) => s.type === source.type && s.id === source.id);
}

function toggle(source: PickedDeckSource) {
  emit(
    "update:modelValue",
    isPicked(source)
      ? props.modelValue.filter((s) => !(s.type === source.type && s.id === source.id))
      : [...props.modelValue, source],
  );
}

onMounted(load);
onScopeDispose(() => {
  if (debounce) clearTimeout(debounce);
  requests.invalidate();
});
</script>

<template>
  <div class="source-picker">
    <ul v-if="modelValue.length" class="chips">
      <li v-for="s in modelValue" :key="`${s.type}:${s.id}`" class="chip">
        <span class="chip-label">{{ s.label }}</span>
        <span class="chip-count">{{ s.cardCount }}</span>
        <button type="button" class="chip-remove" :aria-label="`Remove ${s.label}`" @click="toggle(s)">✕</button>
      </li>
    </ul>

    <div class="tab-seg" role="tablist">
      <button
        v-for="tab in TABS"
        :key="tab.type"
        type="button"
        class="tab-seg-btn"
        :class="{ active: activeTab === tab.type }"
        @click="setTab(tab.type)"
      >
        {{ tab.label }}
      </button>
    </div>

    <input v-model="query" type="text" placeholder="Search decks..." class="search-input" @input="onInput" />

    <p v-if="pending && !results.length" class="state">
      <ActivityStatus :request-key="`${activeTab}:${query}`" label="Loading decks" />
    </p>
    <p v-else-if="error" class="inline-error">{{ error }}</p>
    <ul v-else-if="results.length" class="results">
      <li
        v-for="r in results"
        :key="r.id"
        class="result-row row-clickable"
        :class="{ picked: isPicked(r) }"
        @click="toggle(r)"
      >
        <span class="result-text">
          {{ r.label }}
          <span class="result-count">{{ r.cardCount }} card{{ r.cardCount === 1 ? "" : "s" }}</span>
        </span>
        <button type="button" class="pick-btn" :class="{ picked: isPicked(r) }" @click.stop="toggle(r)">
          {{ isPicked(r) ? "Picked" : "Pick" }}
        </button>
      </li>
    </ul>
    <p v-else class="state">{{ query.trim() ? `No decks match "${query.trim()}".` : "No decks here yet." }}</p>
  </div>
</template>

<style scoped>
.source-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

/* The modal panel scrolls, so a flex column would otherwise squash these to fit. */
.source-picker > * {
  flex-shrink: 0;
}

.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  border: 1px solid var(--accent);
  font-size: 13px;
  max-width: 100%;
}

.chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-count {
  color: var(--muted);
}

.chip-remove {
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
}

.chip-remove:hover {
  color: var(--text);
}

.tab-seg {
  display: flex;
  align-self: flex-start;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tab-seg-btn {
  padding: 8px 16px;
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.tab-seg-btn:first-child {
  border-left: none;
}

.tab-seg-btn.active {
  background: var(--surface-raised);
  color: var(--text);
}

.search-input {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.state {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.inline-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.result-row.picked {
  border-color: var(--accent);
}

.result-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-weight: 700;
}

.result-count {
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
}

.pick-btn {
  flex: none;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.pick-btn.picked {
  background: var(--pass);
  color: var(--pass-ink);
}
</style>
