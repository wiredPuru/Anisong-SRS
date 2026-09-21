# Feature: Retention by box + trends

**From build-plan:** feature 68b
**Status:** verified

## Goal

Answer "is my memory actually holding, and is it getting better?" on `/stats`.
68a described the collection as it stands right now; this reads the review log
itself for the two columns nothing has ever touched, `ReviewLog.boxBefore` and
`boxAfter`, plus `Song.themeSlot`, to show pass rate per Leitner box (is box 5
really holding, or are mature cards quietly failing?), a smoothed trend line on
the existing reviews chart, a week-over-week pass-rate delta, and which decks
have moved most in either direction lately.

Every number is retroactive over the full review history. No schema change, no
new logging, nothing about what `/study` records changes.

## In scope

- A **Retention** panel: pass rate per `boxBefore` (boxes 1-5, a stable ladder
  even where a box has no reviews), plus an OP versus ED split derived from
  `Song.themeSlot`.
- A **7-day rolling pass rate** drawn as a second line on the existing
  "Reviews and pass rate" chart, so the jagged per-day line gets a readable
  trend.
- A **week-over-week delta**: last 7 days' pass rate against the 7 days before
  it, with both sample sizes shown.
- **Most improved / most declined decks**: per artist and anime deck, recent
  window rate against the older window rate, ranked both ways.
- Three new read-only concerns on `/api/stats`: `type=retention`,
  `type=trends`, and a `rolling` array added to the existing `type=timeline`
  response.
- All new fetches join the existing "Refresh" button's `Promise.all`.

## Out of scope

- 68c's heatmap, hour-of-day and weekday performance, and records panel; 68d's
  leech list. This step reads `boxBefore`, `result`, and `themeSlot` only, and
  never `reviewedAt`'s clock time.
- Any schema change, migration, or new logging.
- Manual decks in the movers list. Like `getWeakestDecks` and the existing
  breakdown, only artist and anime groupings have per-deck stats to rank.
- Making the header's 30d/90d/All toggle drive the new panels. It stays the
  timeline chart's control; see Data / contracts for the windows each new panel
  uses and how they are labelled.
- Scoping anything to a deck or artist beyond the movers list itself.
- Changing `ReviewTimelineEntry`'s shape. `/api/home` consumes it too, so the
  rolling series ships as a sibling array rather than a new field.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - retention query + pure shaping** - add `getRetentionStats()`
  to `server/utils/stats.ts` returning the `RetentionStats` shape below, plus
  the pure helpers it delegates to: `shapeRetention()` (fills boxes 1-5 and the
  three theme kinds, derives rates via the existing `deriveCounts`) and
  `classifyThemeSlot()`. Group reviews by `reviewLog.boxBefore`, and by theme
  kind through `card -> song`. Wire `type=retention` into
  `server/api/stats.get.ts` and extend its 400 message. Extend
  `server/utils/stats.test.ts`: an empty log, a box with reviews and a box
  without, `classifyThemeSlot` over `"OP1"`, `"ED2"`, `"OP"`, lowercase input,
  and an unrecognised slot falling to `other`.
  *Done when:* `bun run test` passes, and
  `curl 'localhost:3000/api/stats?type=retention'` returns five box entries
  whose `totalReviews` sum equals the Total reviews KPI.

- [x] **Step 2 - Retention panel** - render it on `/stats` below Review
  forecast, above the reviews chart: one row per box with a pass-rate bar,
  sample count, and the existing `tier-*` colouring from the breakdown list,
  then a compact OP / ED strip. A box with no reviews renders as a muted row,
  not a missing one. Same `pending`/`error`/empty states and `ActivityStatus`
  usage as 68a's panels, and add its `refresh()` to `refreshStats()`.
  *Done when:* the panel renders real numbers, a library with no reviews shows
  an empty state rather than five `NaN%` rows, and Refresh updates it.

- [x] **Step 3 - 7-day rolling pass rate on the chart** - add the pure
  `rollingPassRates(entries, windowDays)` helper and return its output as a
  `rolling` array alongside `entries` from `type=timeline`. Draw it as a second
  polyline on the existing `.chart-plot` SVG, with its own legend entry.
  Test the helper: a single day, consecutive days, a multi-day gap (the window
  is calendar days, not the previous 7 *entries*), and that a heavy day
  outweighs a light one instead of the two rates being averaged.
  *Done when:* `bun run test` passes, the chart shows a visibly smoother second
  line over the same range, and `/` (Home) still renders its own 30-day chart
  unchanged.

- [x] **Step 4 - week-over-week delta** - add `getWeekOverWeek()` and its pure
  `shapeWeekOverWeek()`, exposed as part of a new `type=trends` response.
  Current window is the last 7 days, previous is the 7 before that, both
  weighted by review volume. Render it as one figure in a new **Trends** panel
  below the chart: the delta in percentage points, its direction, and both
  windows' sample sizes. Test the helper: both windows empty, a previous window
  with no reviews (delta must be `null`, never treated as a gain from zero),
  and a real improvement and decline.
  *Done when:* `bun run test` passes and the figure reads plausibly against the
  same two weeks on the chart.

- [x] **Step 5 - deck movers query + ranking** - add `getDeckTrends()` and the
  pure `shapeDeckTrends()`, extending the `type=trends` response with
  `improved` and `declined`. Per artist and anime grouping, compare the recent
  window's rate against the older window's, require `TREND_MIN_REVIEWS` in
  *each* window, drop a deck with no older baseline, and exclude a zero delta
  from both lists. Test the helper: a deck below the threshold in one window
  only, a deck with no older reviews, an exact tie, and correct ranking and
  truncation at `TREND_LIMIT` in both directions.
  *Done when:* `bun run test` passes and no deck appears in both lists.

- [x] **Step 6 - movers UI in the Trends panel** - render `improved` and
  `declined` as two short labelled lists under the delta figure, each row
  showing the deck label, its anime cover where present (matching Home's
  weakest-decks panel), the two rates, and the delta. Same loading, error, and
  empty states; a library with too little history shows one honest "not enough
  history yet" state rather than two empty lists.
  *Done when:* both lists render on a library with history, the empty state
  shows on a fresh one, and Refresh updates the panel.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/stats.ts` | three new query functions, their pure helpers, and the new constants |
| `nuxt-app/server/utils/stats.test.ts` | new cases for every pure helper added here |
| `nuxt-app/server/api/stats.get.ts` | `retention` and `trends` branches, `timeline`'s extended response, updated 400 message |
| `nuxt-app/app/pages/stats/index.vue` | Retention and Trends panels, the second chart line, client-side type copies, refresh wiring, scoped styles |

`server/api/home.get.ts` and `app/pages/index.vue` are deliberately untouched;
step 3 must not change the shape they already read.

## Data / contracts

Declared server-side in `server/utils/stats.ts`, copied by hand into
`app/pages/stats/index.vue` in the same field order, per F-09.

```ts
type ThemeKind = "OP" | "ED" | "other";

interface RetentionEntry {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;   // null when totalReviews is 0
}

interface RetentionStats {
  byBox: (RetentionEntry & { box: number })[];        // always 5 entries, box 1..5
  byThemeKind: (RetentionEntry & { kind: ThemeKind })[]; // always 3 entries
}

interface WeekOverWeek {
  current: { totalReviews: number; passRate: number | null };
  previous: { totalReviews: number; passRate: number | null };
  delta: number | null;   // current - previous, null when either side is null
}

interface DeckTrendEntry {
  type: "artist" | "anime";
  id: number;
  label: string;
  coverImageUrl: string | null;   // anime only, null for artist, same as WeakestDeckEntry
  recentRate: number;
  recentReviews: number;
  olderRate: number;
  olderReviews: number;
  delta: number;                  // recentRate - olderRate, never 0 in either list
}

interface TrendStats {
  weekOverWeek: WeekOverWeek;
  improved: DeckTrendEntry[];
  declined: DeckTrendEntry[];
}

// type=timeline response, extended
interface TimelineResponse {
  entries: ReviewTimelineEntry[];                  // unchanged
  rolling: { date: string; passRate: number }[];   // same length and order as entries
}
```

Exported constants, so a label and the number behind it cannot drift (the
`MATURE_BOX` precedent):

- `ROLLING_WINDOW_DAYS = 7`
- `TREND_RECENT_DAYS = 30` - the movers' recent window; everything before it is
  the older window
- `TREND_MIN_REVIEWS = 3` - required in each window, matching the threshold
  Home's weakest-decks panel already uses
- `TREND_LIMIT = 3` - rows per list

Window semantics, stated in the panel copy so no number is unexplained:

- **Retention** is all time, like the KPI row. It ignores the header's
  30d/90d/All toggle, which stays the chart's control.
- **Rolling** windows on *calendar* days, not on the previous 7 entries.
  `getReviewTimeline` only returns days that had reviews, so a 7-entry window
  would silently stretch across weeks of not studying.
- **Week over week** is the last 7 days against the 7 before, independent of
  the toggle.
- **Movers** are the last `TREND_RECENT_DAYS` days against everything older.

Every rate is derived from summed counts, never averaged from other rates - the
comment above `summarizeTimeline` is the reason, and it applies to all four new
aggregates.

## Testing

`bun run test` (Vitest) is configured, so the logic gate is on.

- **Logic-bearing steps (1, 3, 4, 5) each ship tests in the same diff**, and
  only for the pure helpers - `shapeRetention`, `classifyThemeSlot`,
  `rollingPassRates`, `shapeWeekOverWeek`, `shapeDeckTrends` - following the
  split 68a established: the DB-touching function stays thin, the shaping it
  delegates to is pure and fully covered. Edge cases are named per step above.
- **UI-only steps (2, 6) ride on browser evidence**: screenshots of each panel
  populated, empty, and erroring, plus a clean `bun run build`. Step 3's chart
  change is verified the same way on top of its helper test.
- Manual path: `/stats` against the real library. Check the box rows' review
  counts sum to the Total reviews KPI, the rolling line tracks the per-day line
  without matching its spikes, and Home's chart is unchanged.

## Notes for the AI

- All queries are **server-side**. The page calls `/api/stats` and never
  touches Drizzle. No new route file - extend the existing `?type=` switch, the
  same call 68a made, since the app has no dynamic route segments.
- Reuse `deriveCounts` and `passCountExpr` rather than writing new rate math.
- A box or theme kind with zero reviews keeps its row with a `null` rate, the
  way `shapeCollectionHealth` fills every box. A stable set of rows beats a
  shape that changes with the data.
- `boxBefore` is what the card's box was *going into* the review, which is the
  only one that answers "did box 5 hold". Do not use `boxAfter` for retention.
- `themeSlot` is free text (`"OP1"`, `"ED2"`, and whatever a deck import or a
  hand edit left behind), so classify defensively and keep an `other` bucket
  rather than assuming the two prefixes.
- A previous window with no reviews makes the week-over-week delta `null`, not
  a 100 point gain. Same for a deck with no older baseline: it is excluded, not
  ranked as infinitely improved.
- Panels reuse the page's existing `.chart-panel` / `.chart-title` / `.state`
  classes, the breakdown list's `tier-*` colouring, and `ActivityStatus`.
  Every colour and radius is a `var(--token)` from `main.css`; no literals.
- A brand-new library (0 cards, 0 reviews) is a real first-run state for all
  three panels and must render an empty state, never `NaN%` or a divide by
  zero.
- No em dashes in code, comments, or copy, per `coding-standards.md`.
