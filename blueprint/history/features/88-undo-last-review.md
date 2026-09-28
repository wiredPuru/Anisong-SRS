# Feature: Undo last review

**From build-plan:** feature 88
**Status:** verified

## Goal

Let a mis-pressed Pass or Fail (or a wrong typed-answer pick) be taken back.
Undo reverses the session's most recent review: it deletes the `ReviewLog` row,
restores that track's box, streak, and due date exactly, and serves the card
again so it can be graded properly. It can be repeated to walk back through the
session, newest first.

## In scope

- Two nullable `review_log` columns, `streak_before` and
  `next_review_at_before`, written by every review from now on, inside the same
  transaction as the track update.
- `POST /api/study/review` also returns the new row's `reviewLogId`.
- `POST /api/study/undo` `{ reviewLogId }`: restores the track and deletes the
  row, refusing anything but the latest review for its `(card, criterion)`.
- An optional `prefer` card id on `GET /api/study/next`, served first when it is
  due in the current scope, so an undone card comes straight back with correct
  counts.
- Study: an Undo button plus a `U` hotkey (with the usual hotkey tooltip),
  available for manual Pass/Fail and for typed answers, including from the
  typed result panel. Undo pops the newest `sessionHistory` entry, decrements
  "Card N this session", restores the typed score and combo to their values
  before that round, and re-presents the card.

## Out of scope

- Undoing reviews from an earlier session or after a reload. `sessionHistory` is
  session-only, and pre-88 log rows have no before-state.
- Undo from `/stats`, the session log popup, or anywhere outside Study's main
  controls.
- Redo.
- Undoing a Bury or a Delete (feature 87). Bury writes nothing, and Delete
  cascades the log rows away.
- Suspend (feature 89).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Record the before-state** - migration `0025` adds
  `streak_before` (integer, nullable) and `next_review_at_before` (integer
  timestamp, nullable) to `review_log`, generated through drizzle-kit.
  `readTrackState` also returns `nextReviewAt`: a missing non-title track reads
  as `new Date(0)`, the same "always due" value `trackColumn`'s coalesce already
  uses. `recordReview` wraps the track write and log insert in one
  `db.transaction`, writes both new columns, and returns
  `{ card, reviewLogId }`. The review route passes it through unchanged.
  *Done when:* a Vitest test (in-memory DB, the `studyBury.test.ts` pattern)
  shows a title review and a non-title review each logging the streak and due
  date from before the review, and returning the new row id; existing tests and
  `bun run build` pass.
- [x] **Step 2 - Undo on the server** - `undoReview(reviewLogId)` in
  `server/utils/studyUndo.ts` runs in one transaction:
  1. Load the row. Missing: `{ notFound: true }`.
  2. Null before-state: `{ conflict: "This review was recorded before undo existed and cannot be undone." }`.
  3. Not the highest `id` for its `(cardId, criterion)`: `{ conflict: "A later review of this card has to be undone first." }`.
  4. Restore through `writeTrackState` with `boxBefore`, `streakBefore`,
     `nextReviewAtBefore`. For a non-title track with no other log rows left
     for that `(card, criterion)`, delete the `card_track` row instead, so the
     card goes back to having no track rather than a lookalike row that
     `trackPopulationCondition` would count.
  5. Delete the log row and return `{ card: getCardWithDetails(cardId, criterion) }`.

  `POST /api/study/undo` validates `{ reviewLogId }` (positive safe integer,
  `parseUndoBody` beside it) and maps to 400 / 404 / 409 / 200. *Done when:*
  tests cover restoring a title track, restoring an existing non-title track,
  deleting a first-ever non-title track row, refusing a non-latest row, refusing
  a pre-88 row, 404 for a missing id, and `parseUndoBody`'s rejects; and a pass
  then undo leaves `getNewCardsTodayInfo` back at its earlier count.
- [x] **Step 3 - Serve the undone card first** - `GET /api/study/next` accepts
  an optional `prefer` card id (parsed like `recent`, a single id).
  `getNextDueCard` returns the preferred card when it is in the due pool (same
  scope, filters, and bury rules), otherwise the usual pick. `dueCount`,
  `newCardsToday`, and `upcoming` are computed as before, so they reflect the
  restored state. *Done when:* a test shows `prefer` wins over an earlier-due
  card and over the `recent` ordering, and is ignored when that card is buried,
  outside the scope, or not due.
- [x] **Step 4 - Undo in the session composable and page logic** -
  `useStudySession.submit` keeps its boolean result (the review-submission
  state machine depends on it) and records the saved `reviewLogId` in a
  `lastReviewLogId` ref, and a new `undo(reviewLogId, cardId)` posts to
  `/api/study/undo`. On success it removes `cardId`'s latest occurrence from
  `recentCardIds`, decrements `reviewedCount`, and calls `fetchNext` with
  `prefer`. `SessionHistoryEntry` gains `reviewLogId` and `scoreBefore` (the
  `quizScore` value before a typed round, `null` for manual grading). In
  `study/index.vue`, `undoLastReview()` pops the newest entry only after the
  server succeeds, restores `quizScore` from `scoreBefore`, clears
  `quizResult`, cancels any running score burst, and shows the server's message
  through the existing `error` display on a 409 or 404. Bound to `U` in
  `onKeydown`, including during the typed result phase, where every other key
  is suppressed. Blocked while busy, loading, awaiting the next card, editing,
  or with the history Preview, session log, or filters open. *Done when:* in
  the running app, Pass then `U` brings the same card back at its old box and
  streak (visible in `StudyInfoPanel`), "N left" and "Card N this session"
  return to their earlier values, and `U` twice undoes two reviews in reverse
  order.
- [x] **Step 5 - Undo button** - an Undo button beside Previous card (in the
  side panel and on the all-caught-up screen, where Previous already lives), shown while `sessionHistory` has entries, disabled under the same
  conditions as the hotkey, with a `<span class="tooltip">` naming `U`, styled
  with existing tokens. The typed result panel (`StudyQuizResult`) gets an
  Undo action next to Continue. *Done when:* screenshots in both themes show
  the button, the tooltip, and the result-panel action; clicking each undoes
  as the hotkey does; after undoing a typed round the score chip shows the
  earlier total and combo.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `nuxt-app/server/db/migrations/0025_*.sql` and `meta/`
- `nuxt-app/server/utils/cardTrack.ts` (`readTrackState`)
- `nuxt-app/server/utils/study.ts` (`recordReview`)
- `nuxt-app/server/utils/studyUndo.ts` (new) and its test
- `nuxt-app/server/api/study/undo.post.ts` (new)
- `nuxt-app/server/api/study/next.get.ts`, `nuxt-app/server/utils/cards.ts` (`getNextDueCard`), `nuxt-app/server/utils/studyRecent.ts`
- `nuxt-app/app/composables/useStudySession.ts`
- `nuxt-app/app/pages/study/index.vue`
- `nuxt-app/app/components/study/StudyQuizResult.vue`

## Data / contracts

- `review_log.streak_before` (integer, nullable) and
  `review_log.next_review_at_before` (integer timestamp, nullable). Null only on
  rows written before this feature. **Load-bearing:** any future writer of
  `review_log` must fill both.
- `POST /api/study/review` -> `{ card: CardWithDetails, reviewLogId: number }`
  (adds `reviewLogId`).
- `POST /api/study/undo` `{ reviewLogId: number }` -> `200 { card: CardWithDetails }`,
  `400` bad body, `404` row gone (card deleted or already undone), `409` not the
  latest for its track or recorded before 88.
- `GET /api/study/next` gains optional `prefer=<cardId>`.
- Client `SessionHistoryEntry { card; result; reviewLogId: number; scoreBefore: QuizScore | null }`.
  `StudySessionLogModal` keeps its own narrower copy and needs no change.

## Testing

Vitest is on, so steps 1-3 each ship tests (in-memory DB per the
`studyBury.test.ts` pattern):

- Step 1: before-state logged for title and non-title tracks, including a
  first-ever non-title review (`streakBefore` 0, `nextReviewAtBefore` epoch 0).
- Step 2: `undoReview` restore, first-track deletion, latest-only refusal,
  pre-88 refusal, not found, daily new-card count restored; `parseUndoBody`.
- Step 3: `prefer` ordering and its three ignore cases.

Steps 4 and 5 are UI. They ride on browser evidence (`playwright-cli`
screenshots and a Pass, Undo, Pass run, plus a typed round undone from the
result panel) and `bun run build`.

## Notes for the AI

- The client never sends box, streak, or dates. The server restores only from
  the log row, so the before-state can't be forged or drift from what was
  written.
- Restore through `writeTrackState` so the title-track-on-`card` and
  `card_track` split stays in one place.
- The server's latest-per-track check is what makes repeated undo safe when a
  card appears more than once in `sessionHistory` (failed, then resurfaced).
- The undone card's `nextReviewAtBefore` was already due when it was served, so
  after the restore it is due again and `prefer` will find it. If filters
  changed in between and it no longer matches, falling back to the normal next
  card is correct, not a bug.
- Pop `sessionHistory` only after the server succeeds, so a failed undo leaves
  Previous and the session log accurate.
- Keep `recordReview` and `undoReview` under 50 lines each. Comments explain
  why, not what; no em dashes.

## As built

- `useStudySession.submit` keeps returning a boolean, because
  `createReviewSubmission` depends on it, and exposes the saved id through a
  `lastReviewLogId` ref instead of returning it (spec step 4 amended).
- The Undo button sits beside Previous card in the side panel and on the "All
  caught up" screen, not in the study header, since that is where Previous
  already lives. Its tooltip hangs from the button's right end so it stays
  inside the side panel. The hotkey legend lists `U undo` in manual mode and on
  the typed result panel.
- The "All caught up" screen keeps showing (with its Undo button and an error
  line) when an undo fails there, instead of being replaced by the page-level
  error state.
- Browser evidence came from the built app on a scratch copy of the database:
  Pass then Fail then `U` `U` restored both cards' box, streak, and due date
  exactly and brought the review count back to where it started; a typed
  Correct (SCORE 100, COMBO 1x, 1/1) undone with `U` returned to 0 / 0x / 0/0;
  undo from "All caught up" served the card again. Over HTTP a repeat undo
  returned 404, a pre-88 row 409, and a malformed body 400.
- Open finding F-20 (`fetchNext` has no stale-response guard) applies to the
  fetch undo makes as much as to any other; it is not made worse here, since
  undo is blocked while a load is in flight.
