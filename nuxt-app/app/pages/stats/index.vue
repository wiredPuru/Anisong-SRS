<script setup lang="ts">
import type { GradingCriterion } from "~/utils/criterionGrading";
import type { ReviewHeatmap } from "~/utils/monthHeatmap";

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

type ThemeKind = "OP" | "ED" | "other";

interface RetentionEntry {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

// Mirrors RetentionStats in server/utils/stats.ts, same field order (F-09).
interface RetentionStats {
  byBox: (RetentionEntry & { box: number })[];
  byThemeKind: (RetentionEntry & { kind: ThemeKind })[];
}

// Mirrors WeekOverWeek in server/utils/stats.ts, same field order (F-09).
interface WeekOverWeek {
  current: { totalReviews: number; passRate: number | null };
  previous: { totalReviews: number; passRate: number | null };
  delta: number | null;
}

// Mirrors DeckTrendEntry in server/utils/stats.ts, same field order (F-09).
interface DeckTrendEntry {
  type: "artist" | "anime";
  id: number;
  label: string;
  coverImageUrl: string | null;
  recentRate: number;
  recentReviews: number;
  olderRate: number;
  olderReviews: number;
  delta: number;
}

interface TrendStats {
  weekOverWeek: WeekOverWeek;
  improved: DeckTrendEntry[];
  declined: DeckTrendEntry[];
}

// Mirrors StudyRecords in server/utils/stats.ts, same field order (F-09).
interface StudyRecords {
  totalDaysStudied: number;
  currentStreak: number;
  longestStreak: { days: number; start: string; end: string } | null;
  bestDay: { date: string; count: number } | null;
}

// Mirror the rhythm shapes in server/utils/stats.ts, same field order (F-09).
interface RhythmBucket {
  totalReviews: number;
  passCount: number;
  passRate: number | null;
}

interface HourOfDayEntry extends RhythmBucket {
  hour: number;
}

interface WeekdayEntry extends RhythmBucket {
  weekday: number;
}

interface StudyRhythm {
  minReviews: number;
  hours: HourOfDayEntry[];
  weekdays: WeekdayEntry[];
}

// Mirrors CardWithDetails in server/utils/cards.ts, same field order (F-09).
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  notes: string | null;
  box: number;
  streak: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  songTitleNative: string;
  themeSlot: string;
  artistId: number;
  artistName: string;
  animeId: number;
  animeAniListId: number;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

// Mirrors TroubleCardEntry and TroubleCards in server/utils/stats.ts, same field order (F-09).
interface TroubleCardEntry {
  card: CardWithDetails;
  totalReviews: number;
  failCount: number;
  currentFailStreak: number;
  lastReviewedAt: string;
}

interface TroubleCards {
  mostFailed: TroubleCardEntry[];
  onFailStreak: TroubleCardEntry[];
  neverPassed: TroubleCardEntry[];
}

type StatsType = "artist" | "anime";

interface TimelineEntry {
  date: string;
  totalReviews: number;
  passCount: number;
  passRate: number | null;
}

// Mirrors RollingPassRate in server/utils/stats.ts (F-09). One entry per
// timeline entry, in the same order.
interface RollingPassRate {
  date: string;
  passRate: number;
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

// Feature 71: which scheduling track every section reads. Only offered once a
// non-title track has anything in it; an unknown or unavailable ?track= falls
// back to the anime-title view rather than an empty page. Named the way Study
// and /decks name the same criterion.

const { data: tracksData, refresh: refreshTracks } = await useFetch<{ tracks: GradingCriterion[] }>("/api/stats", {
  query: { type: "tracks" },
});
const availableTracks = computed<GradingCriterion[]>(() => tracksData.value?.tracks ?? ["title"]);
const activeTrack = computed<GradingCriterion>(() => {
  const requested = route.query.track;
  return availableTracks.value.find((track) => track === requested) ?? "title";
});
const activeTrackNote = computed(() =>
  activeTrack.value === "title" ? null : `Showing the schedule graded on ${describeCriterion(activeTrack.value).spoken}.`,
);
// Omitted for the title track so its requests stay exactly what they were.
const trackQuery = computed(() => (activeTrack.value === "title" ? {} : { track: activeTrack.value }));

function setTrack(track: GradingCriterion) {
  router.push({ query: { ...route.query, track: track === "title" ? undefined : track } });
}

const {
  data: overall,
  pending: overallPending,
  error: overallError,
  refresh: refreshOverall,
} = await useFetch<OverallStats>("/api/stats", {
  query: computed(() => ({ type: "overall", ...trackQuery.value })),
});

const {
  data,
  pending,
  error,
  refresh: refreshRows,
} = await useFetch<{ stats: ArtistStats[] | AnimeStats[] }>("/api/stats", {
  query: computed(() => ({ type: activeType.value, ...trackQuery.value })),
});

const {
  data: collection,
  pending: collectionPending,
  error: collectionError,
  refresh: refreshCollection,
} = await useFetch<CollectionHealth>("/api/stats", {
  query: computed(() => ({ type: "collection", ...trackQuery.value })),
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
  query: computed(() => ({ type: "forecast", ...trackQuery.value })),
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

const {
  data: retention,
  pending: retentionPending,
  error: retentionError,
  refresh: refreshRetention,
} = await useFetch<RetentionStats>("/api/stats", {
  query: computed(() => ({ type: "retention", ...trackQuery.value })),
});

const retentionTotal = computed(() =>
  (retention.value?.byBox ?? []).reduce((sum, entry) => sum + entry.totalReviews, 0),
);

const THEME_KIND_LABELS: Record<ThemeKind, string> = {
  OP: "Openings",
  ED: "Endings",
  other: "Other slots",
};

// "other" only exists for slots neither prefix matched, so it stays hidden
// until something actually lands in it.
const retentionKinds = computed(() =>
  (retention.value?.byThemeKind ?? []).filter((entry) => entry.kind !== "other" || entry.totalReviews > 0),
);

const {
  data: trends,
  pending: trendsPending,
  error: trendsError,
  refresh: refreshTrends,
} = await useFetch<TrendStats>("/api/stats", {
  query: computed(() => ({ type: "trends", ...trackQuery.value })),
});

const {
  data: records,
  pending: recordsPending,
  error: recordsError,
  refresh: refreshRecords,
} = await useFetch<StudyRecords>("/api/stats", {
  query: computed(() => ({ type: "records", ...trackQuery.value })),
});

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatDateLong(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const {
  data: rhythm,
  pending: rhythmPending,
  error: rhythmError,
  refresh: refreshRhythm,
} = await useFetch<StudyRhythm>("/api/stats", {
  query: computed(() => ({ type: "rhythm", ...trackQuery.value })),
});

const {
  data: trouble,
  pending: troublePending,
  error: troubleError,
  refresh: refreshTrouble,
} = await useFetch<TroubleCards>("/api/stats", {
  query: computed(() => ({ type: "trouble", ...trackQuery.value })),
});

type TroubleTab = "mostFailed" | "onFailStreak" | "neverPassed";

const TROUBLE_TABS: { key: TroubleTab; label: string; empty: string }[] = [
  {
    key: "mostFailed",
    label: "Most failed",
    empty: "No card has been failed twice yet. Cards that keep failing show up here.",
  },
  {
    key: "onFailStreak",
    label: "On a fail streak",
    empty: "No card is currently failing twice in a row.",
  },
  {
    key: "neverPassed",
    label: "Never passed",
    empty: "Every card reviewed at least twice has been passed at least once.",
  },
];

const troubleTab = ref<TroubleTab>("mostFailed");
const troubleEntries = computed(() => trouble.value?.[troubleTab.value] ?? []);
const troubleEmptyText = computed(() => TROUBLE_TABS.find((tab) => tab.key === troubleTab.value)?.empty ?? "");

function troubleFigure(entry: TroubleCardEntry): string {
  if (troubleTab.value === "onFailStreak") return `${entry.currentFailStreak} in a row`;
  if (troubleTab.value === "neverPassed") return pluralize(entry.totalReviews, "review");
  return pluralize(entry.failCount, "fail");
}

function troubleContext(entry: TroubleCardEntry): string {
  if (troubleTab.value === "neverPassed") return "0 passes";
  return `of ${pluralize(entry.totalReviews, "review")}`;
}

const { data: mediaLibraryData } = await useFetch<{
  defaultDownloadFolder: string | null;
  playbackMode: "auto" | "audioOnly";
  autoDownload: boolean;
  clipSource: "anisongdb" | "both" | "animethemes";
}>("/api/media-library");
const hasDefaultDownloadFolder = computed(() => Boolean(mediaLibraryData.value?.defaultDownloadFolder));
const audioOnly = computed(() => mediaLibraryData.value?.playbackMode === "audioOnly");
const autoDownload = computed(() => mediaLibraryData.value?.autoDownload ?? false);
const clipSource = computed(() => mediaLibraryData.value?.clipSource ?? "anisongdb");

const previewCard = ref<CardWithDetails | null>(null);

function onPreviewCardUpdated(updated: CardWithDetails) {
  previewCard.value = updated;
  if (!trouble.value) return;
  for (const list of [trouble.value.mostFailed, trouble.value.onFailStreak, trouble.value.neverPassed]) {
    for (const entry of list) {
      if (entry.card.id === updated.id) entry.card = updated;
    }
  }
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const hasRhythm = computed(() => rhythm.value?.hours.some((entry) => entry.totalReviews > 0) ?? false);
const maxHourReviews = computed(() => Math.max(1, ...(rhythm.value?.hours.map((entry) => entry.totalReviews) ?? [])));

// A bucket with too few reviews gets a neutral tier: its rate is shown in the
// tooltip and text, but is too noisy to colour as good or bad.
function rhythmTier(bucket: RhythmBucket): "pass" | "warning" | "fail" | "small" | "empty" {
  if (bucket.passRate === null) return "empty";
  if (bucket.totalReviews < (rhythm.value?.minReviews ?? 0)) return "small";
  return passRateTier(bucket.passRate);
}

function hourName(hour: number): string {
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

function hourAxisLabel(hour: number): string {
  return hour % 6 === 0 ? `${hour % 12 || 12}${hour < 12 ? "a" : "p"}` : "";
}

function hourBarHeight(entry: HourOfDayEntry): string {
  return `${(entry.totalReviews / maxHourReviews.value) * 100}%`;
}

function hourTitle(entry: HourOfDayEntry): string {
  if (!entry.totalReviews) return `${hourName(entry.hour)} - no reviews`;
  const note = rhythmTier(entry) === "small" ? " (small sample)" : "";
  return `${hourName(entry.hour)} - ${pluralize(entry.totalReviews, "review")}, ${formatPassRate(entry.passRate)} pass rate${note}`;
}

const {
  data: heatmap,
  error: heatmapError,
  refresh: refreshHeatmap,
} = await useFetch<ReviewHeatmap>("/api/stats", {
  query: computed(() => ({ type: "heatmap", ...trackQuery.value })),
});

const weekOverWeek = computed(() => trends.value?.weekOverWeek ?? null);
const improvedDecks = computed(() => trends.value?.improved ?? []);
const declinedDecks = computed(() => trends.value?.declined ?? []);
const hasMovers = computed(() => improvedDecks.value.length > 0 || declinedDecks.value.length > 0);

// Percentage points, not a percentage of a percentage: a move from 50% to 60%
// is "+10 pts", never "+20%".
function formatDelta(delta: number): string {
  const points = Math.round(delta * 100);
  return `${points > 0 ? "+" : points < 0 ? "-" : ""}${Math.abs(points)} pts`;
}

function deltaTier(delta: number): "pass" | "fail" | "empty" {
  if (delta > 0) return "pass";
  if (delta < 0) return "fail";
  return "empty";
}

function formatReviewCount(total: number): string {
  return `${total} review${total === 1 ? "" : "s"}`;
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
} = await useFetch<{ entries: TimelineEntry[]; rolling: RollingPassRate[] }>("/api/stats", {
  query: computed(() => ({ type: "timeline", range: range.value, ...trackQuery.value })),
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

const rollingEntries = computed(() => timeline.value?.rolling ?? []);

const rollingPolylinePoints = computed(() =>
  rollingEntries.value
    .map((entry, index) => {
      const x = rollingEntries.value.length > 1 ? (index / (rollingEntries.value.length - 1)) * 100 : 50;
      return `${x},${100 - entry.passRate * 100}`;
    })
    .join(" "),
);

function formatDateShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const refreshing = ref(false);

async function refreshStats() {
  refreshing.value = true;
  try {
    await Promise.all([
      refreshTracks(),
      refreshOverall(),
      refreshRows(),
      refreshTimeline(),
      refreshCollection(),
      refreshForecast(),
      refreshRetention(),
      refreshTrends(),
      refreshHeatmap(),
      refreshRecords(),
      refreshRhythm(),
      refreshTrouble(),
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
  router.push({ query: { ...route.query, type } });
}
</script>

<template>
  <main class="stats">
    <header class="stats-header">
      <h1>Review stats</h1>
      <div class="header-controls">
        <!-- A select rather than a segmented control: up to 11 combinations,
             some as long as "Anime + song + OP/ED + artist". -->
        <label v-if="availableTracks.length > 1" class="track-picker">
          <span class="track-picker-label">Track</span>
          <select
            class="track-select"
            :value="activeTrack"
            @change="setTrack(($event.target as HTMLSelectElement).value as GradingCriterion)"
          >
            <option v-for="track in availableTracks" :key="track" :value="track">
              {{ describeCriterion(track).chip }}
            </option>
          </select>
        </label>
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
              :disabled="!overall || (overall.totalReviews === 0 && availableTracks.length === 1)"
              @click="armClear"
            >
              Clear history
            </button>
          </template>
          <template v-else>
            <span class="clear-confirm-label">{{
              availableTracks.length > 1 ? "Delete all review history, on every track?" : "Delete all review history?"
            }}</span>
            <button type="button" class="clear-confirm-btn" :disabled="clearing" @click="confirmClear">
              {{ clearing ? "Clearing..." : "Confirm" }}
            </button>
            <button type="button" class="clear-cancel-btn" :disabled="clearing" @click="cancelClear">Cancel</button>
          </template>
        </div>
      </div>
    </header>

    <div class="stats-body">
    <p v-if="activeTrackNote" class="track-note">{{ activeTrackNote }}</p>
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
        <span class="chart-title">Records</span>
      </div>
      <div v-if="recordsPending" class="state">
        <ActivityStatus label="Loading records" />
      </div>
      <div v-else-if="recordsError" class="state state-error">Couldn't load records. Try refreshing.</div>
      <p v-else-if="!records || !records.bestDay || !records.longestStreak" class="state">
        No reviews yet. <NuxtLink to="/study">Start a session</NuxtLink> to set your first record.
      </p>
      <div v-else class="health-figures">
        <div class="health-figure">
          <span class="health-figure-value">{{ pluralize(records.longestStreak.days, "day") }}</span>
          <span class="health-figure-label">Longest streak</span>
          <span class="health-figure-note">
            {{ formatDateLong(records.longestStreak.start) }}
            <template v-if="records.longestStreak.start !== records.longestStreak.end">
              - {{ formatDateLong(records.longestStreak.end) }}
            </template>
            · current: {{ records.currentStreak }}
          </span>
        </div>
        <div class="health-figure">
          <span class="health-figure-value">{{ pluralize(records.bestDay.count, "review") }}</span>
          <span class="health-figure-label">Best day</span>
          <span class="health-figure-note">{{ formatDateLong(records.bestDay.date) }}</span>
        </div>
        <div class="health-figure">
          <span class="health-figure-value">{{ records.totalDaysStudied }}</span>
          <span class="health-figure-label">Days studied</span>
        </div>
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
        <span class="chart-title">Retention</span>
        <span class="chart-note">All time, by the box a card was in when you reviewed it</span>
      </div>
      <div v-if="retentionPending" class="state">
        <ActivityStatus label="Loading retention" />
      </div>
      <div v-else-if="retentionError" class="state state-error">Couldn't load retention. Try refreshing.</div>
      <p v-else-if="!retention || !retentionTotal" class="state">
        No reviews yet. <NuxtLink to="/study">Study a card</NuxtLink> to start.
      </p>
      <template v-else>
        <div class="breakdown-list">
          <div v-for="entry in retention.byBox" :key="entry.box" class="breakdown-row">
            <div class="breakdown-row-top">
              <span class="breakdown-label">Box {{ entry.box }}</span>
              <span class="breakdown-rate" :class="`tier-${passRateTier(entry.passRate)}`">
                {{ formatPassRate(entry.passRate) }}
                <span v-if="entry.totalReviews" class="breakdown-count">
                  · {{ entry.totalReviews }} review{{ entry.totalReviews === 1 ? "" : "s" }}
                </span>
              </span>
            </div>
            <div class="breakdown-bar-track">
              <span
                v-if="entry.passRate !== null"
                class="breakdown-bar-fill"
                :class="`tier-${passRateTier(entry.passRate)}`"
                :style="{ width: `${Math.round(entry.passRate * 100)}%` }"
              />
            </div>
          </div>
        </div>
        <div class="kind-strip">
          <div v-for="entry in retentionKinds" :key="entry.kind" class="kind-figure">
            <span class="health-figure-value" :class="`tier-${passRateTier(entry.passRate)}`">
              {{ formatPassRate(entry.passRate) }}
            </span>
            <span class="health-figure-label">
              {{ THEME_KIND_LABELS[entry.kind] }}
              <template v-if="entry.totalReviews">· {{ entry.totalReviews }}</template>
            </span>
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
          <span class="legend-item"><span class="legend-swatch legend-swatch-rolling" /> 7-day average</span>
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
            <polyline
              :points="rollingPolylinePoints"
              fill="none"
              vector-effect="non-scaling-stroke"
              class="chart-line-rolling"
            />
          </svg>
        </div>
        <div class="chart-axis">
          <span>{{ formatDateShort(timelineEntries[0].date) }}</span>
          <span>{{ formatDateShort(timelineEntries[timelineEntries.length - 1].date) }}</span>
        </div>
      </template>
    </div>

    <div class="chart-panel">
      <div class="chart-header">
        <span class="chart-title">Trends</span>
        <span class="chart-note">Last 7 days against the 7 before</span>
      </div>
      <div v-if="trendsPending" class="state">
        <ActivityStatus label="Loading trends" />
      </div>
      <div v-else-if="trendsError" class="state state-error">Couldn't load trends. Try refreshing.</div>
      <p v-else-if="!weekOverWeek || !weekOverWeek.current.totalReviews" class="state">
        No reviews in the last 7 days yet.
      </p>
      <template v-else>
        <div class="week-figures">
          <div class="health-figure">
            <span class="health-figure-value" :class="`tier-${deltaTier(weekOverWeek.delta ?? 0)}`">
              {{ weekOverWeek.delta === null ? "-" : formatDelta(weekOverWeek.delta) }}
            </span>
            <span class="health-figure-label">Week over week</span>
          </div>
          <div class="health-figure">
            <span class="health-figure-value">{{ formatPassRate(weekOverWeek.current.passRate) }}</span>
            <span class="health-figure-label">
              This week · {{ formatReviewCount(weekOverWeek.current.totalReviews) }}
            </span>
          </div>
          <div class="health-figure">
            <span class="health-figure-value" :class="{ 'tier-empty': weekOverWeek.previous.passRate === null }">
              {{ weekOverWeek.previous.passRate === null ? "-" : formatPassRate(weekOverWeek.previous.passRate) }}
            </span>
            <span class="health-figure-label">
              Previous week · {{ formatReviewCount(weekOverWeek.previous.totalReviews) }}
            </span>
          </div>
        </div>
        <p v-if="weekOverWeek.delta === null" class="trend-note">
          Nothing was reviewed in the previous 7 days, so there is no rate to compare against yet.
        </p>
        <div class="mover-block">
          <p v-if="!hasMovers" class="trend-note">
            No deck has enough reviews both inside and before the last 30 days yet, so there is nothing to
            compare. This fills in once a deck has been studied across both windows.
          </p>
          <div v-else class="mover-columns">
            <div class="mover-column">
              <span class="mover-heading">Most improved</span>
              <p v-if="!improvedDecks.length" class="trend-note">No deck has improved yet.</p>
              <div v-for="entry in improvedDecks" :key="`up-${entry.type}-${entry.id}`" class="mover-row">
                <img v-if="entry.coverImageUrl" :src="entry.coverImageUrl" alt="" class="mover-cover" />
                <span v-else class="mover-cover mover-cover-empty" />
                <span class="mover-info">
                  <span class="mover-label">{{ entry.label }}</span>
                  <span class="mover-detail">
                    {{ formatPassRate(entry.olderRate) }} to {{ formatPassRate(entry.recentRate) }} ·
                    {{ formatReviewCount(entry.recentReviews) }} recently
                  </span>
                </span>
                <span class="mover-delta tier-pass">{{ formatDelta(entry.delta) }}</span>
              </div>
            </div>
            <div class="mover-column">
              <span class="mover-heading">Most declined</span>
              <p v-if="!declinedDecks.length" class="trend-note">No deck has declined yet.</p>
              <div v-for="entry in declinedDecks" :key="`down-${entry.type}-${entry.id}`" class="mover-row">
                <img v-if="entry.coverImageUrl" :src="entry.coverImageUrl" alt="" class="mover-cover" />
                <span v-else class="mover-cover mover-cover-empty" />
                <span class="mover-info">
                  <span class="mover-label">{{ entry.label }}</span>
                  <span class="mover-detail">
                    {{ formatPassRate(entry.olderRate) }} to {{ formatPassRate(entry.recentRate) }} ·
                    {{ formatReviewCount(entry.recentReviews) }} recently
                  </span>
                </span>
                <span class="mover-delta tier-fail">{{ formatDelta(entry.delta) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <StatsActivityHeatmap v-if="heatmap" :heatmap="heatmap" />
    <div v-else class="chart-panel">
      <div class="chart-header">
        <span class="chart-title">Study activity</span>
      </div>
      <div v-if="heatmapError" class="state state-error">Couldn't load study activity. Try refreshing.</div>
      <div v-else class="state">
        <ActivityStatus label="Loading study activity" />
      </div>
    </div>

    <div class="chart-panel">
      <div class="chart-header">
        <span class="chart-title">When you study</span>
      </div>
      <div v-if="rhythmPending" class="state">
        <ActivityStatus label="Loading study rhythm" />
      </div>
      <div v-else-if="rhythmError" class="state state-error">Couldn't load study rhythm. Try refreshing.</div>
      <p v-else-if="!rhythm || !hasRhythm" class="state">No reviews yet.</p>
      <template v-else>
        <div class="rhythm-grid">
          <div class="rhythm-section">
            <span class="rhythm-subtitle">Hour of day</span>
            <div class="rhythm-hours">
              <div v-for="entry in rhythm.hours" :key="entry.hour" class="rhythm-hour" :title="hourTitle(entry)">
                <span
                  v-if="entry.totalReviews"
                  class="rhythm-hour-bar"
                  :class="`tier-${rhythmTier(entry)}`"
                  :style="{ height: hourBarHeight(entry) }"
                />
              </div>
            </div>
            <div class="rhythm-axis">
              <span v-for="entry in rhythm.hours" :key="entry.hour" class="rhythm-axis-cell">
                {{ hourAxisLabel(entry.hour) }}
              </span>
            </div>
          </div>
          <div class="rhythm-section">
            <span class="rhythm-subtitle">Day of week</span>
            <div class="breakdown-list">
              <div v-for="day in rhythm.weekdays" :key="day.weekday" class="breakdown-row">
                <div class="breakdown-row-top">
                  <span class="breakdown-label">{{ WEEKDAY_NAMES[day.weekday] }}</span>
                  <span class="breakdown-rate" :class="`tier-${rhythmTier(day)}`">
                    {{ day.passRate === null ? "No reviews" : formatPassRate(day.passRate) }}
                    <span v-if="day.totalReviews" class="breakdown-count">
                      · {{ pluralize(day.totalReviews, "review") }}
                      <template v-if="rhythmTier(day) === 'small'"> (small sample)</template>
                    </span>
                  </span>
                </div>
                <div class="breakdown-bar-track">
                  <span
                    v-if="day.passRate !== null"
                    class="breakdown-bar-fill"
                    :class="`tier-${rhythmTier(day)}`"
                    :style="{ width: `${Math.round(day.passRate * 100)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="rhythm-legend">
          Bar height = reviews, colour = pass rate. Grey means fewer than {{ rhythm.minReviews }} reviews.
        </p>
      </template>
    </div>

    <div class="chart-panel">
      <div class="chart-header">
        <span class="chart-title">Trouble cards</span>
        <div class="tab-seg" role="tablist">
          <button
            v-for="tab in TROUBLE_TABS"
            :key="tab.key"
            type="button"
            class="tab-seg-btn"
            :class="{ active: troubleTab === tab.key }"
            @click="troubleTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
      <div v-if="troublePending" class="state">
        <ActivityStatus label="Loading trouble cards" />
      </div>
      <div v-else-if="troubleError" class="state state-error">Couldn't load trouble cards. Try refreshing.</div>
      <p v-else-if="!troubleEntries.length" class="state">{{ troubleEmptyText }}</p>
      <div v-else class="trouble-list">
        <button
          v-for="entry in troubleEntries"
          :key="entry.card.id"
          type="button"
          class="trouble-row"
          @click="previewCard = entry.card"
        >
          <img v-if="entry.card.animeCoverImageUrl" :src="entry.card.animeCoverImageUrl" alt="" class="mover-cover" />
          <span v-else class="mover-cover mover-cover-empty" />
          <span class="mover-info">
            <span class="mover-label">{{ entry.card.songTitle }}</span>
            <span class="mover-detail">
              {{ entry.card.artistName }} · {{ entry.card.animeTitleEnglish }} · {{ entry.card.themeSlot }}
            </span>
          </span>
          <span class="trouble-figure">
            <span class="trouble-figure-value">{{ troubleFigure(entry) }}</span>
            <span class="trouble-figure-context">{{ troubleContext(entry) }}</span>
          </span>
        </button>
      </div>
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

    <CardPreviewModal
      :card="previewCard"
      :open="previewCard !== null"
      :has-default-download-folder="hasDefaultDownloadFolder"
      :audio-only="audioOnly"
      :auto-download="autoDownload"
      :clip-source="clipSource"
      @close="previewCard = null"
      @updated="onPreviewCardUpdated"
    />
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

.track-note {
  margin: 0 0 16px;
  color: var(--accent-secondary);
  font-size: 13px;
  font-weight: 700;
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

.track-picker {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.track-picker-label {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.track-select {
  min-width: 0;
  max-width: 260px;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  text-overflow: ellipsis;
  cursor: pointer;
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

.health-figure-note {
  font-size: 12px;
  color: var(--faint);
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
  opacity: 0.5;
}

.legend-swatch-rolling {
  background: var(--text);
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
  /* Faded so the steadier rolling line reads on top of it rather than the two
     competing for attention. */
  opacity: 0.5;
}

.chart-line polyline.chart-line-rolling {
  stroke: var(--text);
  stroke-width: 1.8;
  opacity: 1;
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

.breakdown-bar-fill.tier-small {
  background: var(--muted);
  opacity: 0.5;
}

.breakdown-rate.tier-small {
  color: var(--muted);
  font-weight: 400;
}

.rhythm-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 28px;
}

.rhythm-section {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rhythm-subtitle {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rhythm-hours {
  flex: 1;
  min-height: 140px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  border-bottom: 1px solid var(--border);
}

.rhythm-hour {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.rhythm-hour-bar {
  width: 100%;
  min-height: 3px;
  border-radius: 2px 2px 0 0;
}

.rhythm-hour-bar.tier-pass {
  background: var(--pass);
}

.rhythm-hour-bar.tier-warning {
  background: var(--warning);
}

.rhythm-hour-bar.tier-fail {
  background: var(--fail);
}

.rhythm-hour-bar.tier-small {
  background: var(--muted);
  opacity: 0.45;
}

.rhythm-axis {
  display: flex;
  gap: 3px;
  font-size: 11px;
  color: var(--faint);
}

.rhythm-axis-cell {
  flex: 1;
  white-space: nowrap;
}

.rhythm-legend {
  margin: 0;
  font-size: 12px;
  color: var(--faint);
}

.mover-block {
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.mover-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.mover-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.mover-heading {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mover-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mover-cover {
  flex: none;
  width: 34px;
  height: 48px;
  border-radius: var(--radius-xs);
  background: var(--surface-raised);
  object-fit: cover;
}

.mover-cover-empty {
  display: block;
}

.mover-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mover-label {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mover-detail {
  font-size: 12px;
  color: var(--muted);
}

.mover-delta {
  flex: none;
  font-weight: 700;
  white-space: nowrap;
}

.mover-delta.tier-pass {
  color: var(--pass);
}

.mover-delta.tier-fail {
  color: var(--fail);
}

.week-figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
}

.trend-note {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
}

.chart-note {
  color: var(--muted);
  font-size: 12px;
}

.kind-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.kind-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-figure-value.tier-pass {
  color: var(--pass);
}

.health-figure-value.tier-warning {
  color: var(--warning);
}

.health-figure-value.tier-fail {
  color: var(--fail);
}

.health-figure-value.tier-empty {
  color: var(--muted);
}

.trouble-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trouble-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.trouble-row:hover {
  background: var(--surface-raised);
  border-color: var(--border);
}

.trouble-figure {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.trouble-figure-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--fail);
}

.trouble-figure-context {
  font-size: 12px;
  color: var(--muted);
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

  .rhythm-grid {
    grid-template-columns: 1fr;
  }
}
</style>
