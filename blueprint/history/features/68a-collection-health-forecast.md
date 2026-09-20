# Feature: Collection health + review forecast

**From build-plan:** feature 68a
**Status:** verified

## Goal

Give `/stats` its first two panels that describe the *collection* rather than
past reviews: where every card sits in the Leitner system right now, and how
much work is coming. Today the page answers "how have I done?" three ways and
"what shape is my library in?" not at all, even though `Card.box`,
`Card.streak`, and `Card.nextReviewAt` are all stored and read by nobody in
`server/utils/stats.ts`.

This is the first of feature 68's four sub-features, so it also sets the
section pattern (panel markup, loading/error/empty states, refresh wiring)
that 68b-68d follow.

## In scope

- A **Collection health** panel: total cards, a box 1-5 distribution bar,
  percent mature, and a never-reviewed count.
- Box 1 shown as its streak-to-graduate sub-stages, not one bucket -
  `computeNextBoxState` needs `boxOneStreakRequired` (default 3) consecutive
  passes to promote a card out of box 1, so a single "box 1" number hides
  most of the early progress.
- A **Review forecast** panel: due now, then a per-day count for the next 7
  days, plus a 30-day total.
- Two new read-only `/api/stats` types (`collection`, `forecast`) following
  the existing `?type=` switch.
- Both panels join the existing "Refresh" button's `Promise.all`.

## Out of scope

- 68b's retention-by-box and trend work, 68c's heatmap and records, 68d's
  leech list. This step adds no review-log analytics at all.
- Any schema change, migration, or new logging. Every number here comes from
  rows already written.
- Scoping the forecast to a deck or artist. Whole-library only, same as every
  other number on `/stats` today.
- Changing the Leitner intervals, the maturity threshold's effect on
  scheduling, or anything `/study` does.
- A forecast chart. Seven labelled day rows plus a total; 68c owns the
  heavier charting.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - collection health query + pure shaping helpers** - add
  `getCollectionHealth()` to `server/utils/stats.ts` returning the
  `CollectionHealth` shape below, plus the pure helper
  `shapeCollectionHealth()` it delegates the bucketing and percentage work
  to. Wire `type=collection` into `server/api/stats.get.ts`. Ship
  `server/utils/stats.test.ts` covering the helper: empty library, a library
  where every card is unreviewed, box-1 streak buckets at 0 through
  `boxOneStreakRequired - 1`, and a full spread across boxes 1-5.
  *Done when:* `bun run test` passes with the new file, and
  `curl 'localhost:3000/api/stats?type=collection'` returns counts that add
  up to the real `/cards` total.

- [x] **Step 2 - Collection health panel** - render it on `/stats` below the
  KPI row, above the existing chart: total cards, percent mature, never
  reviewed, and a horizontal segmented bar of boxes 1-5 with a legend and a
  per-segment `title` tooltip. Box 1's segment splits by streak. Include
  `pending`/`error`/empty states matching the chart panel's existing markup,
  and add its `refresh()` to `refreshStats()`.
  *Done when:* the panel renders real numbers on `/stats`, an empty library
  shows "No cards yet" rather than a zero-width bar, and Refresh updates it.

- [x] **Step 3 - forecast query + pure day bucketing** - add
  `getReviewForecast()` and its pure helper `shapeForecast()`, plus
  `type=forecast` on the route. `dueNow` must come from the existing
  `getDueCardCount({ type: "all" })` so `/stats` can never disagree with
  `/study`'s own "cards left" counter; the future buckets are raw
  `nextReviewAt` counts. Extend `stats.test.ts` for the helper: no upcoming
  cards, cards landing on the same local day, a card overdue from last week,
  and the 7/30-day boundaries.
  *Done when:* `bun run test` passes, and `dueNow` matches the number
  `/study` shows for the same library at the same moment.

- [x] **Step 4 - Review forecast panel** - render it beside or below
  Collection health: a "due now" figure, seven labelled day rows each with a
  count and a proportional bar, and a "next 30 days" total. Same
  loading/error/empty states, same `refreshStats()` wiring.
  *Done when:* the panel shows seven days with today first, a library with
  nothing scheduled shows an empty state, and Refresh updates it.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/stats.ts` | the two new query functions and their pure helpers |
| `nuxt-app/server/utils/stats.test.ts` | new - first test file for this module |
| `nuxt-app/server/api/stats.get.ts` | two new `?type=` branches and the updated 400 message |
| `nuxt-app/app/pages/stats/index.vue` | both panels, their client-side type copies, refresh wiring, scoped styles |

`server/utils/cards.ts` is read from (for `getDueCardCount`) but not changed.

## Data / contracts

Declared server-side in `server/utils/stats.ts`, copied by hand into
`app/pages/stats/index.vue` in the same field order - the project's documented
convention (F-09), not drift.

```ts
interface CollectionHealth {
  totalCards: number;
  neverReviewed: number;
  matureCards: number;            // box >= MATURE_BOX
  maturePercent: number | null;   // null when totalCards is 0
  boxOneStreakRequired: number;   // from settings, so the UI can label buckets
  boxes: { box: number; count: number }[];          // always 5 entries, box 1..5
  boxOneByStreak: { streak: number; count: number }[]; // 0 .. required-1
}

interface ReviewForecast {
  dueNow: number;      // getDueCardCount({ type: "all" }) - honours the daily new-card limit
  backlog: number;     // nextReviewAt <= now, ignoring that limit
  days: { date: string; count: number }[];  // 7 entries, local date keys, today first
  next7: number;
  next30: number;
}
```

- `MATURE_BOX` is **4** (the first interval of a week or longer). Exported as
  a named constant so it is tunable in one place, and stated in the panel's
  own label so the number is never unexplained.
- `dueNow` and `backlog` can differ: `baseDueCondition` withholds unreviewed
  cards once the daily new-card limit is hit. Show `dueNow`; mention the
  backlog only when it is larger.
- Local date keys use the same `toLocalDateKey` helper already in `stats.ts`,
  so a day boundary means the same thing everywhere on the page.

## Testing

`bun run test` (Vitest) is configured, so the logic gate is on. There is no
`stats.test.ts` today; this feature creates it.

- **Steps 1 and 3 are logic-bearing and must ship tests** - but only for the
  pure helpers (`shapeCollectionHealth`, `shapeForecast`), following the
  convention in `cards.test.ts`: the DB-touching query function stays thin
  and untested, the shaping it delegates to is pure and fully covered. Edge
  cases named per step above.
- **Steps 2 and 4 are UI and ride on browser evidence** - screenshots of each
  panel populated, empty, and erroring, plus a clean `bun run build`.
- Manual path: `/stats` with a real library, then compare the forecast's "due
  now" against `/study`'s own counter, and the box counts against the card
  total on `/cards`.

## Notes for the AI

- All queries are **server-side**; the page calls `/api/stats` and never
  touches Drizzle. No new route file - extend the existing `?type=` switch,
  since the app has no dynamic route segments anywhere and shouldn't gain one
  here.
- Match `deriveCounts`/`summarizeTimeline`'s existing split: a thin function
  that queries, a pure function that shapes. That split is what makes the
  tests possible.
- Panels reuse the page's existing `.chart-panel`/`.chart-title`/`.state`
  classes and `ActivityStatus` loading component rather than inventing new
  ones. Every colour and radius is a `var(--token)` from `main.css`; no
  literals (feature 62b swept the last of them out).
- Never average per-day rates or per-box rates - the comment above
  `summarizeTimeline` explains why. Nothing here should need a rate average,
  but 68b will.
- A brand-new library (0 cards, 0 reviews) is a real first-run state and must
  render as an empty state, not `NaN%` or a divide-by-zero.
- No em dashes in code comments or copy, per `coding-standards.md`.
