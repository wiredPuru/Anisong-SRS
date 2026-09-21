# Feature: Homepage study activity heatmap

**From build-plan:** feature 69
**Status:** verified

## Goal

Add a GitHub-contribution-style calendar heatmap to Home's dashboard showing
cards studied (review count) per day over roughly the past year, so study
consistency is visible at a glance in the same familiar grid-of-colored-squares
format GitHub uses for commit/PR activity.

## Design reference

No image needed. The target format is a well-known, unambiguous UI convention
(GitHub's contribution graph): week columns of 7 day-cells, Sunday-start,
color-graded by activity level, with month labels above the columns and a
"Less -> More" legend. The exact visual spec (cell sizing, color tiers, layout)
is fully specified in the Build steps below.

## In scope

- A pure grid-shaping function in `server/utils/stats.ts` that turns a list of
  per-day review counts into a Sunday-aligned week grid spanning the trailing
  ~53 weeks, ending today: zero-filling days with no reviews, marking days
  after today (inside the current week) as blank/`future`, computing a 5-tier
  relative intensity per day, and placing a month label on the week column that
  first contains that month's 1st.
- A DB-fetch wrapper that queries `ReviewLog` grouped by local day for that
  window (reusing the file's existing `reviewDateExpr`/local-date helpers) and
  feeds the shape function.
- Wiring the resulting `heatmap` field into `/api/home`'s response.
- A new "Study activity" panel on `/` (`app/pages/index.vue`): the week grid,
  month labels, a legend, a native `title`-attribute tooltip per cell showing
  the exact date and review count, an empty state when there's no review
  history, and a horizontally-scrollable wrapper so the ~53-column grid
  degrades to scroll rather than breaking layout under the existing 820px
  narrow breakpoint.
- Colors via `var(--accent)` at increasing opacity for the 4 non-zero tiers and
  `var(--surface-raised)` for tier 0/future - no new design tokens.

## Out of scope

- Weekday axis labels (GitHub's left-hand Mon/Wed/Fri labels) - visual
  polish, deferred; the grid reads correctly without them.
- Clicking a cell to navigate anywhere - cells are hover-only, like GitHub's
  own (mostly) non-interactive cells.
- Any change to the existing "Last 30 days" bar chart, maturity stats,
  weakest-decks, or recent-cards panels, or their `/api/home` fields.
- Feature 68c's separate, later `/stats`-page calendar heatmap (bundled with
  hour-of-day/weekday performance and a records panel) - different page,
  different scope, not affected by this feature.
- Any schema change or new logging - this reads `ReviewLog.reviewedAt`, which
  is already written by every `/api/study/review` call.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Heatmap grid logic + tests** - In `server/utils/stats.ts`, add
  a day-key generator that finds the most recent Sunday on/before
  `today - (53*7 - 1)` days and walks forward through the Saturday on/after
  today (mirroring `forecastDayKeys`'s existing pattern), plus
  `shapeReviewHeatmap(input: { countsByDate: {date, count}[]; dayKeys: string[]; todayKey: string })`
  returning `{ weeks: { days: { date, count, future }[]; monthLabel: string | null }[]; maxCount: number; totalReviews: number }`.
  Tier math and month-label placement live in this function. *Done when:*
  `bun run test` passes new cases in `server/utils/stats.test.ts` covering: a
  known count map lands on the right cells; days after today in the trailing
  week are marked `future` and excluded from `maxCount`/`totalReviews`; the
  week containing a month's 1st gets that month's label and no other week
  does; an all-zero window returns `maxCount: 0` with no division-by-zero.
- [x] **Step 2 - Wire into `/api/home`** - Add `getReviewHeatmap()` to
  `server/utils/stats.ts` (queries `reviewLog` grouped by local day over the
  window via the existing `reviewDateExpr` helper, then calls
  `shapeReviewHeatmap`), and add a `heatmap` field to the object returned by
  `server/api/home.get.ts`. *Done when:* requesting `/api/home` from the
  running dev server returns a `heatmap` object whose shape matches Step 1's
  types and whose counts match the real review history already in the local
  database.
- [x] **Step 3 - Home page panel** - In `app/pages/index.vue`, add a
  full-width "Study activity" panel between the hero panel and the existing
  two-column row (activity-panel + side-panel), rendering: week columns of 7
  day-cells (11px squares, small gap), month labels above columns, a "Less ->
  More" legend, a native `:title` tooltip per non-future cell reading
  `"{date} - {count} review(s)"` (matching the existing `chart-bar` tooltip
  convention in this same file), an empty state ("No reviews yet.") when
  `totalReviews` is 0, and an `overflow-x: auto` wrapper. Cell color: tier 0
  and `future` use `var(--surface-raised)`; tiers 1-4 use `var(--accent)` at
  4 increasing opacity steps. *Done when:* `bun run dev`, load `/`, and
  visually confirm the grid renders with colors matching known review
  history, hovering a colored cell shows its date/count, and the panel
  scrolls horizontally rather than breaking layout at the 820px breakpoint
  and narrower.
- [x] **Step 4 - Month view, default, with a Month/Year toggle** - Requested
  after Step 3 landed: default the panel to a single-month calendar
  highlight rather than the full 53-week grid, with a toggle back to the
  year view. Add `app/utils/monthHeatmap.ts` exporting `currentMonthKey()`
  and a pure `buildMonthHeatmap(days, monthKey)` that filters the
  already-fetched `heatmap.weeks` days down to one calendar month, pads
  leading/trailing cells to full weeks (Sunday-first, like a real calendar),
  and computes `maxCount`/`totalReviews` scaled to that month alone (not the
  year's). No new API call - reuses the `heatmap` data `/api/home` already
  returns. In `index.vue`, add a `tab-seg`/`tab-seg-btn` toggle (matching
  the existing convention in `decks/index.vue`/`stats.vue`) defaulting to
  "Month", larger day-numbered cells for the month view, and keep the
  existing Step 3 grid unchanged as the "Year" view. *Done when:*
  `bun run test` passes new cases in `monthHeatmap.test.ts` (month
  boundaries, leading/trailing padding, per-month max scaling, a
  future-day cell), and a browser check confirms the panel opens on the
  Month view showing the current calendar month with correct day numbers
  and colors, the toggle switches to the unchanged Year view and back, and
  narrow-width behavior still holds for both.

## Files / areas

- `nuxt-app/server/utils/stats.ts` - new types (`ReviewHeatmapDay`,
  `ReviewHeatmapWeek`, `ReviewHeatmap`), day-key generator, `shapeReviewHeatmap`,
  `getReviewHeatmap`
- `nuxt-app/server/utils/stats.test.ts` - new test cases for the grid logic
- `nuxt-app/server/api/home.get.ts` - add `heatmap` to the response
- `nuxt-app/app/pages/index.vue` - new panel (script, template, scoped styles),
  plus the Step 4 Month/Year toggle
- `nuxt-app/app/utils/monthHeatmap.ts` - Step 4: `currentMonthKey()`,
  `buildMonthHeatmap()`, and their types
- `nuxt-app/app/utils/monthHeatmap.test.ts` - Step 4 test cases

## Data / contracts

New server-side types (`server/utils/stats.ts`), returned as `heatmap` on
`/api/home`'s response and hand-duplicated client-side in `index.vue` per this
project's established client/server type-duplication convention
(`coding-standards.md`):

```ts
interface ReviewHeatmapDay {
  date: string; // local date key, YYYY-MM-DD
  count: number;
  future: boolean; // true for days after today within the current week
}

interface ReviewHeatmapWeek {
  days: ReviewHeatmapDay[]; // always 7, Sunday first
  monthLabel: string | null; // set only on the week that first contains that month's 1st
}

interface ReviewHeatmap {
  weeks: ReviewHeatmapWeek[];
  maxCount: number; // largest non-future day count in the window, for tier scaling
  totalReviews: number; // sum of non-future counts, for the panel subtitle
}
```

No schema change - reads the existing `ReviewLog.reviewedAt` column only.

## Testing

Vitest is configured, so the logic-test gate is on.

- Step 1 (`shapeReviewHeatmap` and the day-key generator) is exactly the
  in-scope pure logic the gate targets - date-grid bucketing and tier math
  with clear right/wrong answers - and ships its tests in the same diff,
  following the `forecastDayKeys`/`shapeForecast` precedent already in this
  file (feature 68a).
- Steps 2-3 are integration/UI (DB wiring, component rendering) and are
  exempt per `coding-standards.md`; verify them with the real `/api/home`
  response and a visual check in the running dev server instead of a unit
  test.

## Notes for the AI

- Reuse `reviewDateExpr` / `toLocalDateKey` / `forecastDayKeys` already in
  `server/utils/stats.ts` instead of reimplementing local-date handling -
  this file already has the exact SQLite `date(..., 'unixepoch', 'localtime')`
  convention and a tested day-key generator to build from.
- Follow the DB-fetch/pure-shape split `getReviewForecast()` /
  `shapeForecast()` established (feature 68a) so the grid logic stays
  unit-testable without touching the DB in tests.
- Match the existing `chart-bar` native `:title` tooltip convention in
  `index.vue`, not the custom `<span class="tooltip">` pattern - that one is
  reserved for hotkeyed buttons (feature 10's convention).
- Color via `var(--accent)` opacity steps only, no new CSS custom properties,
  per `coding-standards.md`'s "no hard-coded colors."
- Keep this additive: don't touch the existing hero, 30-day-chart, maturity
  stats, weakest-decks, or recent-cards panels, or their `/api/home` fields.
