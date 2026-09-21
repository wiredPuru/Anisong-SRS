# Feature: Activity heatmap + records

**From build-plan:** feature 68c
**Status:** verified

## Goal

Answer three questions `/stats` cannot today: **how consistently do I study**
(a calendar of review volume), **when do I study and when do I do well** (hour
of day and weekday performance), and **what are my personal bests** (longest
streak ever, best single day, total days studied). The KPI row only shows the
*current* streak, and nothing on the page reads the clock time of
`ReviewLog.reviewedAt`.

Every number comes from rows already written: no schema change, no new
logging, nothing about what Study records changes.

## Design reference

None to capture. The calendar is the existing Home "Study activity" panel
(feature 69) reused as-is, not redrawn. The records panel reuses 68a's
`.health-figures` row; the weekday rows reuse the `.breakdown-*` bars with
`tier-*` colouring.

## In scope

- Extract Home's "Study activity" heatmap panel (month/year toggle, legend,
  empty states) into one shared component, and mount it on `/stats` too.
- A **Records** panel: longest streak ever (with its start and end dates),
  best single day (date and count), total days studied, and the current streak
  alongside for context.
- A **When you study** panel: reviews and pass rate per hour of day (24 bars)
  and per weekday (7 rows), from `reviewedAt`'s local clock time.
- Three new read-only `/api/stats` types: `heatmap`, `records`, `rhythm`.
- Each new fetch joins `refreshStats()`'s `Promise.all`, so Refresh and Clear
  history update the new panels.

## Out of scope

- 68d (leech list, Preview modal on `/stats`).
- Any schema change, migration, or new logging.
- Any visible change to Home. The extraction must leave Home's panel
  pixel-identical; its `/api/home` payload and `heatmap` field are untouched.
- A separate, second heatmap design for `/stats`. Home's panel is the single
  implementation; if it should change later, it changes in one place.
- An hour-by-weekday matrix, goals or targets, deck-scoped versions, and the
  weekday axis labels on the year grid that 69 deliberately deferred.
- Re-timezoning old reviews. Hours and weekdays use the machine's current
  local timezone, the same `'localtime'` grouping the rest of `stats.ts` uses.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - extract the heatmap panel into a shared component** - move
  Home's `.heatmap-panel` template, its month/year state, `heatmapCellClass`,
  `monthCellClass` and the two cell-title helpers, and the heatmap and legend
  CSS into `app/components/stats/StatsActivityHeatmap.vue` (registers as
  `<StatsActivityHeatmap>`; the filename must start with the folder name). It
  takes one prop, `heatmap: ReviewHeatmap`. Move the client-side
  `ReviewHeatmapWeek` and `ReviewHeatmap` types next to `ReviewHeatmapDay` in
  `app/utils/monthHeatmap.ts` so Home, `/stats` and the component share one
  copy. Layout concerns (`grid-column: 1 / -1` on Home's grid) stay in Home,
  applied via a class on the component; `min-width: 0` stays in the component.
  The component carries its own copies of the header, title and `.state`
  styles, with values identical to Home's so nothing shifts. Capture Home
  screenshots **before** editing (month view, year view, at about 1440px and
  under 820px) to compare against.
  *Done when:* Home's panel matches the before screenshots in both views at
  both widths, the month/year toggle and tooltips still work, `bun run test`
  and `bun run build` pass, and Home no longer contains the heatmap markup or
  its CSS.

- [x] **Step 2 - heatmap on /stats** - add `type=heatmap` to
  `server/api/stats.get.ts` returning the existing `getReviewHeatmap()` (update
  the 400 message), then mount `<StatsActivityHeatmap>` on `/stats` directly
  below "Trends", with its own `useFetch`, `pending`/`error` states, and
  `refresh()` in `refreshStats()`. Empty state is the component's own.
  *Done when:* `/stats` shows the same grid and totals as Home for the same
  moment, the toggle works, an errored fetch shows a message in that panel
  only, and Refresh updates it.

- [x] **Step 3 - records query + pure shaping** - add `getStudyRecords()`
  delegating to the pure `shapeStudyRecords()`, and `type=records`. One query:
  every distinct local day with its review count over the whole log. Pull the
  consecutive-day logic into pure helpers (`currentStreakFromDates`,
  `longestStreakFromDates`) that work on `YYYY-MM-DD` keys via UTC day numbers,
  and make the existing `getStudyStreak()` call `currentStreakFromDates`, so the
  Records panel and the KPI streak can never disagree. Ties resolve to the most
  recent run or day. Tests: empty log gives null records and zero counts; a
  single day; two runs, longer wins; equal runs, most recent wins; a run across
  a month end and a leap day; a gap of exactly one missing day breaks a run;
  best day ties; current streak alive when the last review was yesterday and
  dead after a two-day gap (pinning `getStudyStreak`'s existing behaviour).
  *Done when:* `bun run test` passes, `records.currentStreak` equals
  `/api/stats?type=overall`'s `streakDays`, and best day, total days and
  longest streak match the `sqlite3` queries under Testing.

- [x] **Step 4 - Records panel** - a `.chart-panel` titled "Records" directly
  below the KPI row, using `.health-figures` with three figures: Longest streak
  ("12 days", sub-line "3 Aug - 14 Aug", and "current: 3" so a run near the
  record reads as such), Best day ("87 reviews", sub-line the date), and Days
  studied. Client type copy, `useFetch`, `pending`/`error`/empty ("No reviews
  yet.") states, `refresh()` in `refreshStats()`.
  *Done when:* the panel shows real numbers matching step 3's checks, a
  singular value reads "1 day" not "1 days", and Clear history followed by
  Refresh shows the empty state.

- [x] **Step 5 - rhythm query + pure shaping** - add `RHYTHM_MIN_REVIEWS` (5),
  `getStudyRhythm()` delegating to the pure `shapeStudyRhythm()`, and
  `type=rhythm`. Two grouped queries on `strftime('%H' | '%w', reviewedAt,
  'unixepoch', 'localtime')` with the existing `passCountExpr`, cast to
  integer. The shaper always returns 24 hour entries and 7 weekday entries
  (Sunday first, `0` = Sunday, matching the heatmap's Sunday-start), zero-filled
  with a null rate where nothing was reviewed. Tests: empty log; unreviewed
  hours and weekdays filled in; rate from pooled counts, not averaged; rows
  outside 0-23 or 0-6 ignored; `minReviews` passed through.
  *Done when:* `bun run test` passes and both arrays match the `sqlite3`
  `strftime` queries under Testing, hour for hour.

- [x] **Step 6 - When you study panel** - directly above Breakdown. Hour of
  day: 24 columns, height proportional to that hour's reviews, coloured by
  `passRateTier` only when the hour has at least `minReviews` (otherwise a
  neutral tint), axis labels at 12a, 6a, 12p, 6p, and a `title` per bar with
  the hour, count and rate. Weekday: seven `.breakdown-row`s (Sun..Sat) with
  rate, review count and a `tier-*` bar, a row under `minReviews` shown
  neutral with its numbers. One line of legend text ("bar height = reviews,
  colour = pass rate"). Client type copy, states, `refresh()` wiring. Add the
  new grid to the existing 820px `@media` if it needs to collapse.
  *Done when:* the panel matches step 5's curl, an hour with no reviews renders
  as an empty column not a zero-height glitch, the panel is legible at under
  820px, and Refresh updates it.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/app/components/stats/StatsActivityHeatmap.vue` | new - the extracted, shared heatmap panel |
| `nuxt-app/app/utils/monthHeatmap.ts` | shared client types for the heatmap payload |
| `nuxt-app/app/pages/index.vue` | swap the inline panel for the component; remove its now-dead script and CSS |
| `nuxt-app/app/pages/stats/index.vue` | heatmap, Records and When you study panels, type copies, refresh wiring, styles |
| `nuxt-app/server/utils/stats.ts` | records and rhythm queries and pure shapers; streak helpers |
| `nuxt-app/server/utils/stats.test.ts` | tests for the new pure helpers |
| `nuxt-app/server/api/stats.get.ts` | three new `?type=` branches and the updated 400 message |

Not touched: `server/api/home.get.ts`, `getReviewHeatmap()` itself, the schema.

## Data / contracts

Declared server-side in `server/utils/stats.ts`, copied by hand into
`app/pages/stats/index.vue` in the same field order (F-09). The heatmap
payload types are the exception: they are client-only, so they live once in
`app/utils/monthHeatmap.ts`. Rates are fractions 0-1.

```ts
export const RHYTHM_MIN_REVIEWS = 5;   // flag, never hide

interface StudyRecords {
  totalDaysStudied: number;
  currentStreak: number;               // same value as OverallStats.streakDays
  longestStreak: { days: number; start: string; end: string } | null;  // date keys; null with no reviews
  bestDay: { date: string; count: number } | null;
}

interface RhythmBucket { totalReviews: number; passCount: number; passRate: number | null }
interface HourOfDayEntry extends RhythmBucket { hour: number }      // 0..23, always 24
interface WeekdayEntry extends RhythmBucket { weekday: number }     // 0 = Sunday .. 6, always 7
interface StudyRhythm { minReviews: number; hours: HourOfDayEntry[]; weekdays: WeekdayEntry[] }

// client-only, app/utils/monthHeatmap.ts; mirrors ReviewHeatmap in server/utils/stats.ts
interface ReviewHeatmapWeek { days: ReviewHeatmapDay[]; monthLabel: string | null }
interface ReviewHeatmap { weeks: ReviewHeatmapWeek[]; maxCount: number; totalReviews: number }
```

Load-bearing: `<StatsActivityHeatmap>`'s single `heatmap` prop, and the
streak helpers, which `getStudyStreak` now depends on.

## Testing

`bun run test` (Vitest) is configured, so the logic gate is on.

- **Steps 3 and 5 are logic-bearing and ship tests** for the pure helpers only,
  following 68a and 68b: the DB-touching function stays thin, the shaping it
  delegates to is pure and covered. Edge cases are listed per step.
- **Steps 1, 2, 4, 6 are UI** and ride on browser evidence (`playwright-cli`
  or `bun run measure --shot`) plus a clean `bun run build`: each panel
  populated, empty and erroring, at about 1440px and under 820px. Step 1's
  evidence is a before/after comparison of Home, not just "it renders".
- **Cross-check against SQL**, not against the code under test (read-only, on
  the real database):

  ```sql
  -- best day
  select date(reviewed_at,'unixepoch','localtime') d, count(*) c from review_log group by d order by c desc, d desc limit 1;
  -- total days studied
  select count(distinct date(reviewed_at,'unixepoch','localtime')) from review_log;
  -- longest streak (gaps and islands)
  with d as (select distinct date(reviewed_at,'unixepoch','localtime') day from review_log),
       n as (select day, julianday(day) - row_number() over (order by day) g from d)
  select min(day), max(day), count(*) from n group by g order by count(*) desc, max(day) desc limit 1;
  -- hour of day / weekday
  select cast(strftime('%H',reviewed_at,'unixepoch','localtime') as int) h, count(*), sum(result='pass') from review_log group by h;
  select cast(strftime('%w',reviewed_at,'unixepoch','localtime') as int) w, count(*), sum(result='pass') from review_log group by w;
  ```
- **Empty-state evidence must not use "Clear history" on the real database.**
  Start a second dev server with `GAQ_SRS_DATA_DIR` pointing at a scratch
  directory, on another port, so an empty log is real and the user's history is
  never touched. Error-state evidence: abort one `type` request in the browser.
- Manual path: `/stats` on the real library; compare Records to the KPI streak,
  hover a heatmap cell and an hour bar, then open Home and confirm its heatmap
  is unchanged.

## Notes for the AI

- All queries are **server-side**; the page calls `/api/stats` and never
  touches Drizzle. No new route file: extend the `?type=` switch.
- **Never average rates.** Rhythm buckets sum counts, then derive one rate;
  reuse `deriveCounts` and `passCountExpr`.
- **Day arithmetic on date keys uses UTC day numbers** parsed from
  `YYYY-MM-DD`, never local `Date` subtraction, so a DST change cannot make two
  consecutive days look 23 or 25 hours apart.
- `getStudyStreak()` keeps its exact semantics (a streak survives until the end
  of the day after the last review); the refactor only moves its logic into a
  pure helper. Step 3's tests pin that behaviour.
- `reviewedAt` is unix seconds; `strftime` needs the `'unixepoch'` modifier and
  `'localtime'` to read the user's clock, as `reviewDateExpr` already does.
  `strftime` returns text, so cast to integer before shaping.
- Step 1 is a pure refactor: no behaviour, copy or style change on Home. If a
  before/after comparison shows any difference, fix the component, not the
  screenshot. Scoped styles do not cross into a child, so the component needs
  its own header/title/`.state` rules; give them the same values as Home's.
- Reuse `passRateTier`, `formatPassRate`, and the `.health-figures`,
  `.breakdown-*`, `.chart-panel`, `.state` classes. Every colour and radius is
  a `var(--token)`; no literals. Dynamic widths and heights via `:style` are the
  existing pattern; static inline styles are not.
- A brand-new library (no reviews) is a real first-run state in every panel:
  no `NaN%`, no divide-by-zero, an explanatory empty state.
- No em dashes in code comments or copy, per `coding-standards.md`. Comment
  only the non-obvious: the UTC day numbers, the streak tie-break, the
  Sunday-first weekday order.
