<script setup lang="ts">
import { buildMonthHeatmap, currentMonthKey } from "~/utils/monthHeatmap";
import type { MonthHeatmapCell, ReviewHeatmap, ReviewHeatmapDay } from "~/utils/monthHeatmap";

const props = defineProps<{ heatmap: ReviewHeatmap }>();

function heatmapCellClass(day: ReviewHeatmapDay): string {
  if (day.future || day.count === 0) return "heat-0";
  const max = props.heatmap.maxCount;
  const tier = max > 0 ? Math.min(4, Math.max(1, Math.ceil((day.count / max) * 4))) : 0;
  return `heat-${tier}`;
}

function heatmapCellTitle(day: ReviewHeatmapDay): string {
  return `${day.date} - ${day.count} review${day.count === 1 ? "" : "s"}`;
}

const heatmapView = ref<"month" | "year">("month");

const monthHeatmap = computed(() => {
  const allDays = props.heatmap.weeks.flatMap((week) => week.days);
  return buildMonthHeatmap(allDays, currentMonthKey());
});

function monthCellClass(cell: MonthHeatmapCell): string {
  if (!cell.date || cell.future || cell.count === 0) return "heat-0";
  const max = monthHeatmap.value.maxCount;
  const tier = max > 0 ? Math.min(4, Math.max(1, Math.ceil((cell.count / max) * 4))) : 0;
  return `heat-${tier}`;
}

function monthCellTitle(cell: MonthHeatmapCell): string | undefined {
  if (!cell.date || cell.future) return undefined;
  return `${cell.date} - ${cell.count} review${cell.count === 1 ? "" : "s"}`;
}
</script>

<template>
  <div class="heatmap-panel">
    <div class="panel-header">
      <span class="panel-title">Study activity</span>
      <div class="heatmap-header-right">
        <span v-if="heatmapView === 'month'" class="panel-subtitle"
          >{{ monthHeatmap.totalReviews }} review{{ monthHeatmap.totalReviews === 1 ? "" : "s" }} this month</span
        >
        <span v-else class="panel-subtitle"
          >{{ heatmap.totalReviews }} review{{ heatmap.totalReviews === 1 ? "" : "s" }} in the last year</span
        >
        <div class="tab-seg" role="tablist">
          <button
            type="button"
            class="tab-seg-btn"
            :class="{ active: heatmapView === 'month' }"
            @click="heatmapView = 'month'"
          >
            Month
          </button>
          <button
            type="button"
            class="tab-seg-btn"
            :class="{ active: heatmapView === 'year' }"
            @click="heatmapView = 'year'"
          >
            Year
          </button>
        </div>
      </div>
    </div>
    <template v-if="heatmapView === 'month'">
      <p v-if="!monthHeatmap.totalReviews" class="state">No reviews yet this month.</p>
      <div v-else class="month-heatmap">
        <span class="month-heatmap-label">{{ monthHeatmap.label }}</span>
        <div class="month-grid">
          <span
            v-for="(wd, wdIndex) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
            :key="wdIndex"
            class="month-weekday"
            >{{ wd }}</span
          >
          <template v-for="(week, weekIndex) in monthHeatmap.weeks" :key="weekIndex">
            <span
              v-for="(cell, cellIndex) in week"
              :key="cellIndex"
              class="month-cell"
              :class="[monthCellClass(cell), { 'month-cell-empty': !cell.date }]"
              :title="monthCellTitle(cell)"
            >
              <span v-if="cell.day" class="month-cell-day">{{ cell.day }}</span>
            </span>
          </template>
        </div>
      </div>
    </template>
    <template v-else>
      <p v-if="!heatmap.totalReviews" class="state">No reviews yet.</p>
      <div v-else class="heatmap-scroll">
        <div class="heatmap-grid">
          <div v-for="(week, weekIndex) in heatmap.weeks" :key="weekIndex" class="heatmap-week">
            <span class="heatmap-month-label">{{ week.monthLabel ?? "" }}</span>
            <span
              v-for="day in week.days"
              :key="day.date"
              class="heatmap-cell"
              :class="heatmapCellClass(day)"
              :title="day.future ? undefined : heatmapCellTitle(day)"
            />
          </div>
        </div>
      </div>
    </template>
    <div v-if="heatmapView === 'month' ? monthHeatmap.totalReviews : heatmap.totalReviews" class="heatmap-legend">
      <span>Less</span>
      <span class="heatmap-cell heat-0" />
      <span class="heatmap-cell heat-1" />
      <span class="heatmap-cell heat-2" />
      <span class="heatmap-cell heat-3" />
      <span class="heatmap-cell heat-4" />
      <span>More</span>
    </div>
  </div>
</template>

<style scoped>
.heatmap-panel {
  /* Grid items default to min-width: auto, so without this the .heatmap-grid
     child's max-content width (it needs to fit ~53 unscaled columns) blows
     out the grid track instead of scrolling inside .heatmap-scroll. */
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-weight: 900;
  font-size: 15px;
}

.panel-subtitle {
  font-size: 12px;
  color: var(--faint);
  white-space: nowrap;
}

.heatmap-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Border and glow for the active state, never a fill, since ambient mode
   strips backgrounds with !important. */
.tab-seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.tab-seg-btn {
  padding: 6px 14px;
  border: none;
  border-left: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.tab-seg-btn:first-child {
  border-left: none;
}

.tab-seg-btn.active {
  background: var(--surface-raised);
  color: var(--text);
}

.month-heatmap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.month-heatmap-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 44px);
  gap: 6px;
}

.month-weekday {
  text-align: center;
  font-size: 11px;
  color: var(--faint);
}

.month-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 4px;
  border-radius: var(--radius-xs);
  background: var(--surface-raised);
}

.month-cell-empty {
  background: transparent;
}

.month-cell-day {
  font-size: 11px;
  color: var(--muted);
}

.heatmap-scroll {
  overflow-x: auto;
  padding-bottom: 2px;
}

.heatmap-grid {
  display: flex;
  gap: 3px;
  width: max-content;
}

.heatmap-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heatmap-month-label {
  height: 14px;
  line-height: 14px;
  font-size: 10px;
  color: var(--faint);
  white-space: nowrap;
}

.heatmap-cell {
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 2px;
  background: var(--surface-raised);
}

.heat-1 {
  background: var(--accent);
  opacity: 0.35;
}

.heat-2 {
  background: var(--accent);
  opacity: 0.55;
}

.heat-3 {
  background: var(--accent);
  opacity: 0.75;
}

.heat-4 {
  background: var(--accent);
  opacity: 1;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--faint);
}

.heatmap-legend .heatmap-cell {
  width: 10px;
  height: 10px;
}

.state {
  padding: 24px 28px;
  color: var(--muted);
}
</style>
