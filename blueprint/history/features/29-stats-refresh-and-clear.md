# Feature: Stats refresh + clear

**From build-plan:** feature 29
**Status:** verified

## Goal

Give `/stats` two small controls it's missing: a manual refresh (re-pull the
same numbers without a full page reload) and a destructive "clear" action
that wipes `ReviewLog` history so stats reset to zero - without touching any
card's current Leitner box or due date, since those live on `Card`, not
`ReviewLog`.

## In scope

- A "Refresh" button on `/stats` that re-runs both existing stats fetches
  (overall summary + the active By Artist/By Title list) without a full
  navigation/reload.
- A new `POST /api/stats/clear` route that deletes every row from
  `review_log` and returns how many rows it removed.
- A "Clear history" control on `/stats`, gated behind an inline two-step
  confirm (click once to arm it, click again to actually clear, or cancel) -
  this app has no existing confirm-dialog pattern to reuse (card/deck delete
  are both one-click, per feature 17's precedent), but wiping *all* review
  history app-wide is a broader blast radius than any existing delete
  action, so a lightweight inline confirm is the safeguard rather than a new
  modal component.
- Disabling "Clear history" when there's nothing to clear (`totalReviews`
  is already 0).
- After a successful clear, the page reflects zero immediately (reuses the
  same refresh path as the Refresh button) - no manual reload needed.

## Out of scope

- Any change to `Card.box` or `Card.nextReviewAt` - explicitly untouched,
  per the build-plan line and `project-overview.md`'s data model notes.
- Scoped/partial clearing (per artist, per anime, a date range) - the
  build-plan item says "deletes `ReviewLog` history only," full clear, not a
  filtered one.
- Any export/backup-before-clear step - not in the build-plan line; a
  clear is a clear.
- A reusable confirm-dialog component - this stays a local, inline
  two-click pattern on this one page, not a new shared piece other
  destructive actions get retrofitted to use.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `POST /api/stats/clear` server route** - add
  `clearReviewLog()` to `server/utils/stats.ts` (`db.delete(reviewLog).run()`,
  return the row count via `result.changes`, matching the
  `db.delete(...).run()` / `result.changes` pattern `decks.ts`'s
  `deleteManualDeck` already uses), and a new
  `server/api/stats/clear.post.ts` route calling it, returning
  `{ success: true, deletedCount: number }`. *Done when:* against a dev
  server with existing review history, `POST /api/stats/clear` returns the
  correct deleted count, a follow-up `GET /api/stats?type=overall` shows
  `totalReviews: 0` and `passRate: null`, and the affected cards' `box`/
  `nextReviewAt` (checked via `GET /api/cards`) are unchanged - verified
  with curl against a scratch dev server.
- [x] **Step 2 - Refresh and Clear controls on `/stats`** - in
  `app/pages/stats/index.vue`: destructure `refresh` from both existing
  `useFetch` calls (`overall` and the by-type list) into a `refreshStats()`
  helper; add a "Refresh" button near the heading that calls it (disabled
  and labeled "Refreshing..." while in flight, mirroring the "Adding...
  "/"Downloading..." pending-label convention used elsewhere in the app);
  add a "Clear history" button with the inline two-step confirm described
  above (`confirmingClear` ref - first click arms it and swaps the button to
  "Confirm clear"/"Cancel", second click calls `POST /api/stats/clear` then
  `refreshStats()`), a `clearError` ref surfaced inline on failure
  (`extractErrorMessage`, same convention as every other mutation on this
  page's sibling pages) that also disarms `confirmingClear` back to false so
  a failed attempt never leaves the button stuck on "Confirm clear," and
  disable the whole control when `overall?.totalReviews === 0`. *Done when:* against a scratch dev server
  seeded with review history, clicking Refresh re-fetches without a page
  reload; clicking Clear history requires the confirm step, then the
  overall summary and the active by-type list both show zero/"No reviews
  yet" without a manual reload; Clear history is disabled when there's
  nothing to clear.

## Files / areas

- `nuxt-app/server/utils/stats.ts` - `clearReviewLog()`.
- `nuxt-app/server/api/stats/clear.post.ts` - new route.
- `nuxt-app/app/pages/stats/index.vue` - Refresh + Clear history controls.

## Data / contracts

- `POST /api/stats/clear` -> `{ success: true; deletedCount: number }` (new,
  load-bearing for Step 2's client call, not needed anywhere else).
- No schema changes. `ReviewLog` rows are deleted outright, not soft-deleted
  or archived - matches the build-plan line's "deletes ReviewLog history
  only" wording.

## Testing

No test runner is configured in `AGENTS.md` yet. `clearReviewLog()` is a
single unconditional delete-all with no branching or edge cases worth a
unit test even once a runner exists (unlike, say, the Leitner box interval
math coding-standards calls out as a good candidate) - this rides on the
same API/build verification the rest of this app's server routes use.
Verify via `bun run build`, then the curl sequence in Step 1's done-when
and a manual/browser pass over Step 2's confirm flow.

## Notes for the AI

- `reviewLog.cardId` cascades from `Card` (`onDelete: "cascade"`), not the
  other way around - deleting review log rows never touches `Card` rows, so
  `box`/`nextReviewAt` are safe by construction, not just by not writing to
  them.
- Match the existing `db.delete(x).where(...).run()` /
  `result.changes` pattern already used in `decks.ts` and `cards.ts`, just
  without a `.where()` clause since this clears the whole table.
- `listArtistStats()`/`listAnimeStats()` already left-join `reviewLog`, so
  after a clear they keep listing every artist/anime that has a card (rows
  don't disappear), just with `totalReviews: 0` and `passRate: null` - no
  change needed there.
- Follow the same `extractErrorMessage(err, fallback)` shape already
  duplicated across this app's other pages for the clear action's error
  state (a shared `useApiError` composable is a separately-tracked cleanup
  item, `F-04` in the findings ledger - not this feature's job to fix).
