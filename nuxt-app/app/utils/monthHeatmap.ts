export interface ReviewHeatmapDay {
  date: string;
  count: number;
  future: boolean;
}

export interface ReviewHeatmapWeek {
  days: ReviewHeatmapDay[];
  monthLabel: string | null;
}

export interface ReviewHeatmap {
  weeks: ReviewHeatmapWeek[];
  maxCount: number;
  totalReviews: number;
}

export interface MonthHeatmapCell {
  date: string | null;
  day: number | null;
  count: number;
  future: boolean;
}

export interface MonthHeatmap {
  label: string;
  weeks: MonthHeatmapCell[][];
  maxCount: number;
  totalReviews: number;
}

const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function currentMonthKey(today: Date = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

const BLANK_CELL: MonthHeatmapCell = { date: null, day: null, count: 0, future: false };

// Builds a standard Sunday-first month calendar from the same flattened day
// list the year heatmap already fetched - no extra API call. maxCount/
// totalReviews scale to this month alone, not the year, so a busy month
// elsewhere can't wash out an ordinary one.
export function buildMonthHeatmap(days: ReviewHeatmapDay[], monthKey: string): MonthHeatmap {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const byDate = new Map(days.map((entry) => [entry.date, entry]));

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = new Date(year, monthIndex, 1).getDay();

  const cells: MonthHeatmapCell[] = Array.from({ length: leadingBlanks }, () => ({ ...BLANK_CELL }));

  let maxCount = 0;
  let totalReviews = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
    const entry = byDate.get(date);
    const future = entry?.future ?? false;
    const count = future ? 0 : (entry?.count ?? 0);
    if (!future) {
      totalReviews += count;
      if (count > maxCount) maxCount = count;
    }
    cells.push({ date, day, count, future });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ ...BLANK_CELL });
  }

  const weeks: MonthHeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { label: `${MONTH_NAMES_FULL[monthIndex]} ${year}`, weeks, maxCount, totalReviews };
}

export interface MonthSummary {
  activeDays: number;
  elapsedDays: number;
  bestDay: { day: number; count: number } | null;
  averagePerActiveDay: number;
}

/** Totals shown beside the month calendar. `todayKey` is a local YYYY-MM-DD
    date; days after it are not elapsed even when the heatmap has no entry for
    them, since its grid ends with the current week. */
export function summarizeMonth(month: MonthHeatmap, todayKey: string): MonthSummary {
  let activeDays = 0;
  let elapsedDays = 0;
  let bestDay: MonthSummary["bestDay"] = null;
  for (const cell of month.weeks.flat()) {
    if (cell.date === null || cell.future || cell.date > todayKey) continue;
    elapsedDays++;
    if (cell.count === 0) continue;
    activeDays++;
    if (!bestDay || cell.count > bestDay.count) bestDay = { day: cell.day ?? 0, count: cell.count };
  }
  const averagePerActiveDay = activeDays ? Math.round((month.totalReviews / activeDays) * 10) / 10 : 0;
  return { activeDays, elapsedDays, bestDay, averagePerActiveDay };
}
