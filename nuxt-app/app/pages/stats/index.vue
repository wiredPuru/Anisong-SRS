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

// Mirrors CollectionHealth in server/utils/stats.ts, same field order (F-09).
interface CollectionHealth {
  totalCards: number;
  neverReviewed: number;
  matureCards: number;
  maturePercent: number | null;
  matureBox: number;
  boxOneStreakRequired: number;
  boxes: { box: number; count: number }[];
  boxOneByStreak: { streak: number; count: number }[];
}

// Mirrors ReviewForecast in server/utils/stats.ts, same field order (F-09).
interface ReviewForecast {
  dueNow: number;
  backlog: number;
  days: { date: string; count: number }[];
  next7: number;
  next30: number;
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

const {
  data: collection,
  pending: collectionPending,
  error: collectionError,
  refresh: refreshCollection,
} = await useFetch<CollectionHealth>("/api/stats", {
  query: { type: "collection" },
});

// Box 1 is several stages deep (a card needs boxOneStreakRequired passes to
// leave it), so the ladder is those buckets followed by boxes 2-5 rather than
// five equal steps. --seg-mix ramps one accent across the whole ladder, so the
// bar reads as progress even though each stage is its own segment.
interface HealthStage {
  key: string;
  label: string;
  count: number;
  mix: string;
}

const healthStages = computed<HealthStage[]>(() => {
  if (!collection.value) return [];
  const { boxOneByStreak, boxes, boxOneStreakRequired, matureBox } = collection.value;

  const stages = [
    ...boxOneByStreak.map((bucket) => ({
      key: `box1-streak-${bucket.streak}`,
      label:
        bucket.streak === 0
          ? "Box 1 - not passed yet"
          : `Box 1 - ${bucket.streak} of ${boxOneStreakRequired} passes`,
      count: bucket.count,
    })),
    ...boxes
      .filter((entry) => entry.box > 1)
      .map((entry) => ({
        key: `box-${entry.box}`,
        label: `Box ${entry.box}${entry.box >= matureBox ? " - mature" : ""}`,
        count: entry.count,
      })),
  ];

  return stages.map((stage, index) => ({
    ...stage,
    mix: `${Math.round(15 + (85 * index) / Math.max(1, stages.length - 1))}%`,
  }));
});

const visibleHealthStages = computed(() => healthStages.value.filter((stage) => stage.count > 0));

function stageWidth(stage: HealthStage): string {
  const total = collection.value?.totalCards ?? 0;
  return total > 0 ? `${(stage.count / total) * 100}%` : "0%";
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${Math.round(value * 100)}%`;
}

const {
  data: forecast,
  pending: forecastPending,
  error: forecastError,
  refresh: refreshForecast,
} = await useFetch<ReviewForecast>("/api/stats", {
  query: { type: "forecast" },
});

const forecastDays = computed(() => forecast.value?.days ?? []);
const maxForecastCount = computed(() => Math.max(1, ...forecastDays.value.map((day) => day.count)));

function forecastDayLabel(date: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

function forecastBarWidth(count: number): string {
  return `${(count / maxForecastCount.value) * 100}%`;
}

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
    await Promise.all([
      refreshOverall(),
      refreshRows(),
      refreshTimeline(),
      refreshCollection(),
      refreshForecast(),
    ]);
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

    <div v-if="overallPending" class="state">

      <ActivityStatus label="Loading overall statistics" />

    </div>
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
        <span class="chart-title">Collection health</span>
      </div>
      <div v-if="collectionPending" class="state">
        <ActivityStatus label="Loading collection health" />
      </div>
      <div v-else-if="collectionError" class="state state-error">
        Couldn't load collection health. Try refreshing.
      </div>
      <p v-else-if="!collection || !collection.totalCards" class="state">
        No cards yet. <NuxtLink to="/cards">Add a card</NuxtLink> to start one.
      </p>
      <template v-else>
        <div class="health-figures">
          <div class="health-figure">
            <span class="health-figure-value">{{ collection.totalCards }}</span>
            <span class="health-figure-label">Total cards</span>
          </div>
          <div class="health-figure">
            <span class="health-figure-value">
              {{ formatPercent(collection.maturePercent) }}
              <span class="health-figure-sub">{{ collection.matureCards }}</span>
            </span>
            <span class="health-figure-label">Mature (box {{ collection.matureBox }}+)</span>
          </div>
          <div class="health-figure">
            <span class="health-figure-value">{{ collection.neverReviewed }}</span>
            <span class="health-figure-label">Never reviewed</span>
          </div>
        </div>
        <div class="health-bar">
          <span
            v-for="stage in visibleHealthStages"
            :key="stage.key"
            class="health-bar-seg"
            :style="{ width: stageWidth(stage), '--seg-mix': stage.mix }"
            :title="`${stage.label} - ${stage.count} card${stage.count === 1 ? '' : 's'}`"
          />
        </div>
        <div class="health-legend">
          <span v-for="stage in healthStages" :key="stage.key" class="health-legend-item">
            <span class="health-legend-dot" :style="{ '--seg-mix': stage.mix }" />
            {{ stage.label }}
            <span class="health-legend-count">{{ stage.count }}</span>
          </span>
        </div>
      </template>
    </div>

    <div class="chart-panel">
      <div class="chart-header">
        <span class="chart-title">Review forecast</span>
        <span v-if="forecast && forecast.next30" class="forecast-totals">
          {{ forecast.next7 }} in 7 days · {{ forecast.next30 }} in 30
        </span>
      </div>
      <div v-if="forecastPending" class="state">
        <ActivityStatus label="Loading review forecast" />
      </div>
      <div v-else-if="forecastError" class="state state-error">Couldn't load the forecast. Try refreshing.</div>
      <p v-else-if="!forecast || !forecast.next30" class="state">Nothing due in the next 30 days.</p>
      <template v-else>
        <div class="forecast-due">
          <span class="health-figure-value">{{ forecast.dueNow }}</span>
          <span class="health-figure-label">
            Due now
            <template v-if="forecast.backlog > forecast.dueNow">
              · {{ forecast.backlog - forecast.dueNow }} held back by the daily new-card limit
            </template>
          </span>
        </div>
        <div class="forecast-days">
          <div v-for="(day, index) in forecastDays" :key="day.date" class="forecast-day">
            <span class="forecast-day-label">{{ forecastDayLabel(day.date, index) }}</span>
            <span class="forecast-day-track">
              <span v-if="day.count" class="forecast-day-fill" :style="{ width: forecastBarWidth(day.count) }" />
            </span>
            <span class="forecast-day-count" :class="{ 'forecast-day-count-zero': !day.count }">{{ day.count }}</span>
          </div>
        </div>
      </template>
    </div>

    <div class="chart-panel">
      <div class="chart-header">
        <span class="chart-title">Reviews and pass rate</span>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-swatch legend-swatch-reviews" /> reviews</span>
          <span class="legend-item"><span class="legend-swatch legend-swatch-rate" /> pass rate</span>
        </div>
      </div>
      <div v-if="timelinePending" class="state">
        <ActivityStatus label="Loading review history" />
      </div>
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

      <div v-if="pending" class="state">

        <ActivityStatus label="Loading statistics breakdown" />

      </div>
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

.forecast-totals {
  font-size: 12px;
  color: var(--muted);
}

.forecast-due {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.forecast-days {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.forecast-day {
  display: grid;
  grid-template-columns: 84px 1fr 40px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.forecast-day-label {
  color: var(--muted);
}

.forecast-day-track {
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--border);
  overflow: hidden;
}

.forecast-day-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--accent);
}

.forecast-day-count {
  text-align: right;
  font-weight: 700;
}

.forecast-day-count-zero {
  color: var(--faint);
  font-weight: 400;
}

.health-figures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.health-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-figure-value {
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.2;
}

.health-figure-sub {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--muted);
}

.health-figure-label {
  font-size: 12px;
  color: var(--muted);
}

.health-bar {
  display: flex;
  height: 14px;
  border-radius: var(--radius-pill);
  background: var(--border);
  overflow: hidden;
}

/* --seg-mix ramps one accent from barely-tinted (a brand new card) to full
   strength (box 5), so the bar reads as a single progression rather than five
   unrelated colours. */
.health-bar-seg {
  background: color-mix(in srgb, var(--accent-secondary) var(--seg-mix), var(--surface-raised));
  border-right: 1px solid var(--surface);
}

.health-bar-seg:last-child {
  border-right: none;
}

.health-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 12px;
  color: var(--muted);
}

.health-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.health-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent-secondary) var(--seg-mix), var(--surface-raised));
}

.health-legend-count {
  color: var(--text);
  font-weight: 700;
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

  .health-figures {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
