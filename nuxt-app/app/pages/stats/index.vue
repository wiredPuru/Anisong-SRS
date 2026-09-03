<script setup lang="ts">
interface OverallStats {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
  streakDays: number;
}

type TimelineRange = "30" | "90" | "all";

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

interface TimelineEntry {
  date: string;
  totalReviews: number;
  passCount: number;
  passRate: number | null;
}

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

const range = ref<TimelineRange>("30");

function setRange(next: TimelineRange) {
  range.value = next;
}

function formatStreak(days: number): string {
  if (days === 0) return "No streak yet";
  return `${days} day${days === 1 ? "" : "s"}`;
}

const {
  data: timeline,
  pending: timelinePending,
  error: timelineError,
  refresh: refreshTimeline,
} = await useFetch<{ entries: TimelineEntry[] }>("/api/stats", {
  query: computed(() => ({ type: "timeline", range: range.value })),
});

const timelineEntries = computed(() => timeline.value?.entries ?? []);
const maxTimelineReviews = computed(() => Math.max(1, ...timelineEntries.value.map((e) => e.totalReviews)));

function barHeightPercent(entry: TimelineEntry): number {
  return Math.round((entry.totalReviews / maxTimelineReviews.value) * 100);
}

function timelinePoint(entry: TimelineEntry, index: number): string {
  const x = timelineEntries.value.length > 1 ? (index / (timelineEntries.value.length - 1)) * 100 : 50;
  const y = 100 - (entry.passRate ?? 0) * 100;
  return `${x},${y}`;
}

const timelinePolylinePoints = computed(() => timelineEntries.value.map(timelinePoint).join(" "));

function formatDateShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const refreshing = ref(false);

async function refreshStats() {
  refreshing.value = true;
  try {
    await Promise.all([refreshOverall(), refreshRows(), refreshTimeline()]);
  } finally {
    refreshing.value = false;
  }
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

function passRateTier(passRate: number | null): "pass" | "warning" | "fail" | "empty" {
  if (passRate === null) return "empty";
  if (passRate >= 0.7) return "pass";
  if (passRate >= 0.4) return "warning";
  return "fail";
}

function setType(type: StatsType) {
  router.push({ query: { type } });
}
</script>

<template>
  <main class="stats">
    <header class="stats-header">
      <h1>Review stats</h1>
      <div class="header-controls">
        <div class="tab-seg" role="tablist">
          <button type="button" class="tab-seg-btn" :class="{ active: range === '30' }" @click="setRange('30')">
            30d
          </button>
          <button type="button" class="tab-seg-btn" :class="{ active: range === '90' }" @click="setRange('90')">
            90d
          </button>
          <button type="button" class="tab-seg-btn" :class="{ active: range === 'all' }" @click="setRange('all')">
            All
          </button>
        </div>
        <button type="button" class="refresh-btn" :disabled="refreshing" @click="refreshStats">
          {{ refreshing ? "Refreshing..." : "Refresh" }}
        </button>
        <div class="clear-block">
          <template v-if="!confirmingClear">
            <button
              type="button"
              class="clear-btn"
              :disabled="!overall || overall.totalReviews === 0"
              @click="armClear"
            >
              Clear history
            </button>
          </template>
          <template v-else>
            <span class="clear-confirm-label">Delete all review history?</span>
            <button type="button" class="clear-confirm-btn" :disabled="clearing" @click="confirmClear">
              {{ clearing ? "Clearing..." : "Confirm" }}
            </button>
            <button type="button" class="clear-cancel-btn" :disabled="clearing" @click="cancelClear">Cancel</button>
          </template>
        </div>
      </div>
    </header>

    <div class="stats-body">
    <p v-if="clearError" class="inline-error">{{ clearError }}</p>

    <div v-if="overallPending" class="state">Loading...</div>
    <div v-else-if="overallError" class="state state-error">Couldn't load stats. Try refreshing.</div>
    <div v-else-if="overall" class="kpi-row">
      <div class="kpi-tile">
        <span class="kpi-label">Total reviews</span>
        <span class="kpi-value">{{ overall.totalReviews }}</span>
      </div>
      <div class="kpi-tile">
        <span class="kpi-label">Pass rate</span>
        <span class="kpi-value" :class="{ 'kpi-value-pass': overall.passRate !== null }">
          {{ formatPassRate(overall.passRate) }}
        </span>
      </div>
      <div class="kpi-tile">
        <span class="kpi-label">Streak</span>
        <span class="kpi-value" :class="{ 'kpi-value-accent': overall.streakDays > 0 }">
          {{ formatStreak(overall.streakDays) }}
        </span>
      </div>
    </div>

    <div class="chart-panel">
      <div class="chart-header">
        <span class="chart-title">Reviews and pass rate</span>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-swatch legend-swatch-reviews" /> reviews</span>
          <span class="legend-item"><span class="legend-swatch legend-swatch-rate" /> pass rate</span>
        </div>
      </div>
      <div v-if="timelinePending" class="state">Loading...</div>
      <div v-else-if="timelineError" class="state state-error">Couldn't load the chart. Try refreshing.</div>
      <p v-else-if="!timelineEntries.length" class="state">No reviews in this range yet.</p>
      <template v-else>
        <div class="chart-plot">
          <div
            v-for="entry in timelineEntries"
            :key="entry.date"
            class="chart-bar"
            :style="{ height: `${barHeightPercent(entry)}%` }"
            :title="`${formatDateShort(entry.date)} - ${entry.totalReviews} review${entry.totalReviews === 1 ? '' : 's'}, ${formatPassRate(entry.passRate)} pass rate`"
          />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="chart-line">
            <polyline :points="timelinePolylinePoints" fill="none" vector-effect="non-scaling-stroke" />
          </svg>
        </div>
        <div class="chart-axis">
          <span>{{ formatDateShort(timelineEntries[0].date) }}</span>
          <span>{{ formatDateShort(timelineEntries[timelineEntries.length - 1].date) }}</span>
        </div>
      </template>
    </div>

    <div class="breakdown-panel">
      <div class="breakdown-header">
        <span class="chart-title">Breakdown</span>
        <div class="toggle">
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: activeType === 'artist' }"
            @click="setType('artist')"
          >
            By Artist
          </button>
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: activeType === 'anime' }"
            @click="setType('anime')"
          >
            By Title
          </button>
        </div>
      </div>

      <div v-if="pending" class="state">Loading...</div>
      <div v-else-if="error" class="state state-error">Couldn't load stats. Try refreshing.</div>
      <template v-else>
        <div v-if="rows.length" class="breakdown-list">
          <div v-for="row in rows" :key="row.id" class="breakdown-row">
            <div class="breakdown-row-top">
              <span class="breakdown-label">
                {{ row.label }}
                <span v-if="row.sublabel" class="breakdown-sublabel">{{ row.sublabel }}</span>
              </span>
              <span class="breakdown-rate" :class="`tier-${passRateTier(row.passRate)}`">
                {{ formatPassRate(row.passRate) }}
                <span class="breakdown-count">
                  · {{ row.totalReviews }} review{{ row.totalReviews === 1 ? "" : "s" }}
                </span>
              </span>
            </div>
            <div class="breakdown-bar-track">
              <span
                v-if="row.passRate !== null"
                class="breakdown-bar-fill"
                :class="`tier-${passRateTier(row.passRate)}`"
                :style="{ width: `${Math.round(row.passRate * 100)}%` }"
              />
            </div>
          </div>
        </div>
        <p v-else class="state">No decks yet. <NuxtLink to="/cards">Add a card</NuxtLink> to start one.</p>
      </template>
    </div>
    </div>
  </main>
</template>

<style scoped>
/* Fills the content column, like /study, /cards, and /decks after 50b-50d. */
.stats {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stats-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 28px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
}

.stats-header h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  line-height: 1;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tab-seg {
  display: flex;
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

.refresh-btn {
  flex: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.clear-btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-confirm-label {
  color: var(--fail);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.clear-confirm-btn,
.clear-cancel-btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
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
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}

.stats-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.kpi-tile {
  padding: 18px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kpi-value {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 400;
  line-height: 1.2;
}

.kpi-value-pass {
  color: var(--pass);
}

.kpi-value-accent {
  color: var(--accent);
}

.chart-panel {
  padding: 22px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chart-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.chart-title {
  font-weight: 900;
  font-size: 15px;
}

.chart-legend {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.legend-swatch-reviews {
  background: var(--accent);
}

.legend-swatch-rate {
  background: var(--accent-secondary);
}

.chart-plot {
  position: relative;
  height: 230px;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

.chart-bar {
  flex: 1;
  min-height: 2px;
  background: var(--accent-glow);
  border-radius: 2px 2px 0 0;
}

.chart-line {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.chart-line polyline {
  stroke: var(--accent-secondary);
  stroke-width: 1.4;
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--faint);
}

.toggle {
  display: flex;
  gap: 8px;
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

/* Border and glow, never a fill: .toggle-btn is in main.css's ambient-glass
   block, which replaces its background with !important. A solid fill here
   would be stripped under ambient mode and leave --accent-ink, which is near
   black, on dark glass. */
.toggle-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 14px var(--accent-glow);
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

.breakdown-panel {
  padding: 22px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.breakdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.breakdown-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.breakdown-row-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.breakdown-label {
  font-weight: 700;
  min-width: 0;
}

.breakdown-sublabel {
  color: var(--muted);
  font-weight: 400;
  margin-left: 4px;
}

.breakdown-rate {
  flex: none;
  font-weight: 700;
  white-space: nowrap;
}

.breakdown-rate.tier-pass {
  color: var(--pass);
}

.breakdown-rate.tier-warning {
  color: var(--warning);
}

.breakdown-rate.tier-fail {
  color: var(--fail);
}

.breakdown-rate.tier-empty {
  color: var(--muted);
  font-weight: 400;
}

.breakdown-count {
  color: var(--muted);
  font-weight: 400;
  font-size: 12px;
}

.breakdown-bar-track {
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--border);
  overflow: hidden;
}

.breakdown-bar-fill {
  display: block;
  height: 100%;
}

.breakdown-bar-fill.tier-pass {
  background: var(--pass);
}

.breakdown-bar-fill.tier-warning {
  background: var(--warning);
}

.breakdown-bar-fill.tier-fail {
  background: var(--fail);
}

/* 50h: same breakpoint as .study-grid. Placed last so it wins the
   source-order tiebreak over the earlier same-specificity base rules. */
@media (max-width: 820px) {
  .stats-header,
  .header-controls {
    flex-wrap: wrap;
  }

  .kpi-row {
    grid-template-columns: 1fr;
  }
}
</style>
