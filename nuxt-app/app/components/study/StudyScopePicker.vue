<script setup lang="ts">
import { deckRowLabel, isSameScope, type DeckRowNames, type DeckScopeType, type ScopePick } from "~/utils/scopePick";

interface DeckListRow extends DeckRowNames {
  id: number;
  cardCount: number;
}

interface PickerRow {
  pick: ScopePick;
  label: string;
  cardCount: number;
}

const props = defineProps<{ scope: ScopePick | null; label: string; disabled?: boolean }>();
const emit = defineEmits<{ select: [ScopePick] }>();

const TABS: { type: DeckScopeType; label: string }[] = [
  { type: "anime", label: "By title" },
  { type: "artist", label: "By artist" },
  { type: "created", label: "Created" },
];

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const activeTab = ref<DeckScopeType>("anime");
const query = ref("");
const rows = ref<PickerRow[]>([]);
const pending = ref(false);
const error = ref<string | null>(null);
const requests = createLatestRequest();
let debounce: ReturnType<typeof setTimeout> | null = null;

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
    rows.value = res.decks.map((row) => ({
      pick: { type, id: row.id },
      label: deckRowLabel(type, row),
      cardCount: row.cardCount,
    }));
  } catch (err) {
    if (!isCurrent()) return;
    rows.value = [];
    error.value = extractErrorMessage(err, "Failed to load decks.");
  } finally {
    if (isCurrent()) pending.value = false;
  }
}

function onInput() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(load, 250);
}

function setTab(type: DeckScopeType) {
  if (type === activeTab.value) return;
  if (debounce) clearTimeout(debounce);
  activeTab.value = type;
  query.value = "";
  rows.value = [];
  load();
}

function close() {
  open.value = false;
  if (debounce) clearTimeout(debounce);
  requests.invalidate();
}

function toggle() {
  if (props.disabled) return;
  if (open.value) {
    close();
    return;
  }
  open.value = true;
  rows.value = [];
  load();
}

function choose(pick: ScopePick) {
  close();
  if (!isSameScope(props.scope, pick)) emit("select", pick);
}

function onWindowMouseDown(event: MouseEvent) {
  if (open.value && rootRef.value && !rootRef.value.contains(event.target as Node)) close();
}

function onWindowKeyDown(event: KeyboardEvent) {
  if (open.value && event.key === "Escape") {
    event.stopPropagation();
    close();
  }
}

watch(
  () => props.disabled,
  (isDisabled) => {
    if (isDisabled && open.value) close();
  },
);

onMounted(() => {
  window.addEventListener("mousedown", onWindowMouseDown);
  window.addEventListener("keydown", onWindowKeyDown, true);
});
onBeforeUnmount(() => {
  window.removeEventListener("mousedown", onWindowMouseDown);
  window.removeEventListener("keydown", onWindowKeyDown, true);
  if (debounce) clearTimeout(debounce);
  requests.invalidate();
});
</script>

<template>
  <div ref="rootRef" class="scope-picker">
    <button
      type="button"
      class="chip"
      :class="{ open }"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="chip-label">{{ label }}</span>
      <span class="caret" aria-hidden="true">&#9662;</span>
    </button>

    <div v-if="open" class="popover">
      <button
        type="button"
        class="all-row"
        :class="{ current: isSameScope(scope, { type: 'all' }) }"
        @click="choose({ type: 'all' })"
      >
        All decks
      </button>

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

      <input
        v-model="query"
        type="text"
        placeholder="Search decks..."
        class="search-input"
        autocomplete="off"
        @input="onInput"
      />

      <p v-if="pending && !rows.length" class="state">
        <ActivityStatus :request-key="`${activeTab}:${query}`" label="Loading decks" />
      </p>
      <p v-else-if="error" class="inline-error">{{ error }}</p>
      <ul v-else-if="rows.length" class="results">
        <li v-for="r in rows" :key="r.pick.type === 'all' ? 'all' : r.pick.id">
          <button
            type="button"
            class="result-row"
            :class="{ current: isSameScope(scope, r.pick) }"
            @click="choose(r.pick)"
          >
            <span class="result-name">{{ r.label }}</span>
            <span class="result-count">{{ r.cardCount }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="state">{{ query.trim() ? `No decks match "${query.trim()}".` : "No decks here yet." }}</p>
    </div>
  </div>
</template>

<style scoped>
.scope-picker {
  position: relative;
  flex: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.chip:disabled {
  cursor: default;
}

.chip:not(:disabled):hover,
.chip.open {
  border-color: var(--accent);
}

.chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  flex: none;
  color: var(--muted);
  font-size: 11px;
}

.chip:disabled .caret {
  visibility: hidden;
}

.popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 6;
  width: 320px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.popover > * {
  flex-shrink: 0;
}

.all-row,
.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.all-row:hover,
.result-row:hover {
  border-color: var(--accent);
}

.all-row.current,
.result-row.current {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.tab-seg {
  display: flex;
  align-self: flex-start;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tab-seg-btn {
  padding: 6px 12px;
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
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.state {
  margin: 0;
  padding: 10px 12px;
  color: var(--muted);
  font-size: 13px;
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
  max-height: 280px;
  overflow-y: auto;
}

.result-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-count {
  flex: none;
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
}
</style>
