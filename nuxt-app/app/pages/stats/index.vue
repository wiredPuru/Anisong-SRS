<script setup lang="ts">
interface OverallStats {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

interface ArtistStats {
  id: number;
  name: string;
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

interface AnimeStats {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

type StatsType = "artist" | "anime";

interface StatsRow {
  id: number;
  label: string;
  sublabel: string | null;
  totalReviews: number;
  passRate: number | null;
}

const route = useRoute();
const router = useRouter();

const activeType = computed<StatsType>(() => (route.query.type === "anime" ? "anime" : "artist"));

const {
  data: overall,
  pending: overallPending,
  error: overallError,
  refresh: refreshOverall,
} = await useFetch<OverallStats>("/api/stats", {
  query: { type: "overall" },
});

const {
  data,
  pending,
  error,
  refresh: refreshRows,
} = await useFetch<{ stats: ArtistStats[] | AnimeStats[] }>("/api/stats", {
  query: computed(() => ({ type: activeType.value })),
});

const refreshing = ref(false);

async function refreshStats() {
  refreshing.value = true;
  try {
    await Promise.all([refreshOverall(), refreshRows()]);
  } finally {
    refreshing.value = false;
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

const confirmingClear = ref(false);
const clearing = ref(false);
const clearError = ref<string | null>(null);

function armClear() {
  clearError.value = null;
  confirmingClear.value = true;
}

function cancelClear() {
  confirmingClear.value = false;
}

async function confirmClear() {
  clearError.value = null;
  clearing.value = true;
  try {
    await $fetch("/api/stats/clear", { method: "POST" });
    confirmingClear.value = false;
    await refreshStats();
  } catch (err) {
    confirmingClear.value = false;
    clearError.value = extractErrorMessage(err, "Failed to clear review history.");
  } finally {
    clearing.value = false;
  }
}

const rows = computed<StatsRow[]>(() => {
  if (!data.value) return [];
  if (activeType.value === "artist") {
    return (data.value.stats as ArtistStats[]).map((s) => ({
      id: s.id,
      label: s.name,
      sublabel: null,
      totalReviews: s.totalReviews,
      passRate: s.passRate,
    }));
  }
  return (data.value.stats as AnimeStats[]).map((s) => ({
    id: s.id,
    label: s.titleEnglish,
    sublabel: s.titleRomaji,
    totalReviews: s.totalReviews,
    passRate: s.passRate,
  }));
});

function formatPassRate(passRate: number | null): string {
  if (passRate === null) return "No reviews yet";
  return `${Math.round(passRate * 100)}%`;
}

function setType(type: StatsType) {
  router.push({ query: { type } });
}
</script>

<template>
  <main class="stats">
    <div class="header-row">
      <h1>Review Stats</h1>
      <button type="button" class="refresh-btn" :disabled="refreshing" @click="refreshStats">
        {{ refreshing ? "Refreshing..." : "Refresh" }}
      </button>
    </div>
    <p class="hint">Guess-rate tracking from your study history.</p>

    <div v-if="overallPending" class="state">Loading...</div>
    <div v-else-if="overallError" class="state state-error">Couldn't load stats. Try refreshing.</div>
    <template v-else-if="overall">
      <div class="summary">
        <div class="summary-stat">
          <span class="summary-value">{{ overall.totalReviews }}</span>
          <span class="summary-label">Total reviews</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value" :class="{ 'summary-value-pass': overall.passRate !== null }">
            {{ formatPassRate(overall.passRate) }}
          </span>
          <span class="summary-label">Overall pass rate</span>
        </div>
      </div>

      <div class="clear-block">
        <template v-if="!confirmingClear">
          <button
            type="button"
            class="clear-btn"
            :disabled="overall.totalReviews === 0"
            @click="armClear"
          >
            Clear history
          </button>
        </template>
        <template v-else>
          <span class="clear-confirm-label">Delete all review history? This can't be undone.</span>
          <button type="button" class="clear-confirm-btn" :disabled="clearing" @click="confirmClear">
            {{ clearing ? "Clearing..." : "Confirm clear" }}
          </button>
          <button type="button" class="clear-cancel-btn" :disabled="clearing" @click="cancelClear">Cancel</button>
        </template>
      </div>
      <p v-if="clearError" class="inline-error">{{ clearError }}</p>
    </template>

    <div class="toggle">
      <button type="button" class="toggle-btn" :class="{ active: activeType === 'artist' }" @click="setType('artist')">
        By Artist
      </button>
      <button type="button" class="toggle-btn" :class="{ active: activeType === 'anime' }" @click="setType('anime')">
        By Title
      </button>
    </div>

    <div v-if="pending" class="state">Loading...</div>
    <div v-else-if="error" class="state state-error">Couldn't load stats. Try refreshing.</div>
    <template v-else>
      <ul v-if="rows.length" class="stats-list">
        <li v-for="row in rows" :key="row.id" class="stats-row">
          <div class="stats-info">
            <span class="stats-label">{{ row.label }}</span>
            <span v-if="row.sublabel" class="stats-sublabel">{{ row.sublabel }}</span>
          </div>
          <div class="stats-numbers">
            <span class="stats-rate" :class="{ 'stats-rate-empty': row.passRate === null }">
              {{ formatPassRate(row.passRate) }}
            </span>
            <span class="stats-count">{{ row.totalReviews }} review{{ row.totalReviews === 1 ? "" : "s" }}</span>
          </div>
        </li>
      </ul>
      <p v-else class="state">No decks yet. <NuxtLink to="/cards/new">Add a card</NuxtLink> to start one.</p>
    </template>
  </main>
</template>

<style scoped>
.stats {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
}

.refresh-btn {
  flex: none;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint {
  margin: 0 0 16px;
  color: var(--muted);
}

.summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.summary-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.summary-value {
  font-size: 24px;
  font-weight: 800;
}

.summary-value-pass {
  color: var(--pass);
}

.summary-label {
  color: var(--muted);
  font-size: 14px;
}

.clear-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.clear-btn {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-confirm-label {
  color: var(--fail);
  font-size: 14px;
  font-weight: 700;
}

.clear-confirm-btn,
.clear-cancel-btn {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.clear-confirm-btn {
  border: none;
  background: var(--fail);
  color: var(--fail-ink);
}

.clear-cancel-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}

.clear-confirm-btn:disabled,
.clear-cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.inline-error {
  margin: -12px 0 20px;
  color: var(--fail);
  font-size: 14px;
}

.toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.toggle-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.toggle-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.state a {
  color: var(--accent);
}

.state-error {
  color: var(--fail);
  border-color: var(--fail);
}

.stats-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.stats-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stats-label {
  font-weight: 700;
}

.stats-sublabel {
  color: var(--muted);
  font-size: 14px;
}

.stats-numbers {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.stats-rate {
  font-weight: 700;
  color: var(--pass);
}

.stats-rate-empty {
  color: var(--muted);
  font-weight: 400;
  font-size: 14px;
}

.stats-count {
  color: var(--muted);
  font-size: 14px;
}
</style>
