# Current Feature

## Title: Daily new-card limit for study sessions

**Type:** Fix

**Status:** verified

## The problem

`getNextDueCard` (`nuxt-app/server/utils/cards.ts:188-197`) serves every due
card in `nextReviewAt` order with no distinction between a brand-new card and
one already in progress. Because new cards default to `box: 1, nextReviewAt:
now` (immediately due), importing a whole artist's or anime's catalog (feature
37) dumps its entire backlog into the very next study session at once - there
is no way to pace how many new cards get introduced per day, unlike
Anki/Migaku's "new cards per day" setting.

## The fix

A single global, toggleable daily cap on how many never-before-studied cards
get introduced per calendar day. Reviews and relapses (box 1 again after a
fail, but previously studied) are never capped - only truly new cards are.

- **Storage:** add a nullable `dailyNewCardLimit` integer column to the
  existing `mediaLibrarySettings` singleton row (`server/db/schema.ts`), via a
  Drizzle migration - the same pattern feature 8 used to add
  `defaultDownloadFolder` to this row rather than a new table. `null` = the
  cap is off (today's unlimited behavior); a number = the cap is on at that
  value. This one field doubles as both the on/off flag and the stored
  number.
- **Settings util** (`server/utils/mediaLibrary.ts`): add `getDailyNewCardLimit(): number | null`
  and `setDailyNewCardLimit(limit: number | null): { error: string } | { dailyNewCardLimit: number | null }`
  next to the existing `getDefaultDownloadFolder`/`setDefaultDownloadFolder`.
  Validation: `limit` must be `null` or a non-negative integer (`0` is valid -
  "reviews only, no new cards today"); reject negative or non-integer values.
- **API:** `server/api/media-library.get.ts` adds `dailyNewCardLimit` to its
  response. New `server/api/media-library/daily-new-card-limit.post.ts`
  (mirrors `default-download-folder.post.ts`'s body-validation shape: check
  `body.limit` is `null` or a `number`, then delegate to the util and surface
  `{ error }` as a 400).
- **"New card" definition:** a card with **zero** `ReviewLog` rows ever - not
  `box === 1`, since a card that failed back down to box 1 after being
  studied before is a relapse, not new, and must not count against the
  budget.
- **"Introduced today" count:** the number of distinct cards whose
  *first-ever* review (`min(reviewedAt)` across all their `review_log` rows)
  falls today (local server time - single-user local app, no timezone
  handling needed). Presenting a card via `/api/study/next` does not consume
  the budget; only actually recording a review via `/api/study/review`
  does, since that's what first inserts a `review_log` row for that card.
  Follow `server/utils/stats.ts`'s existing convention of dropping to a raw
  `sql` template for a query-builder gap (it has no existing `min()`/`distinct`
  usage yet) - group `review_log` by `cardId`, `having(min(reviewedAt) >=
  <start-of-today-in-epoch-seconds>)`, count the rows. Compare epoch seconds
  (matching how the `timestamp`-mode column is actually stored via
  `unixepoch()`), not a raw `Date`, to avoid a driver binding mismatch.
- **Scheduling change** (`getNextDueCard`, `server/utils/cards.ts`): when
  `dailyNewCardLimit` is set and today's introduced-count has reached it, add
  a condition restricting results to cards that already have at least one
  `review_log` row (e.g. `inArray(card.id, db.select({ id: reviewLog.cardId }).from(reviewLog))`),
  so due reviews/relapses keep surfacing normally while brand-new cards stop
  appearing until tomorrow. When the limit is `null` or not yet reached, no
  change from today's behavior.
- **Visibility (must not be a silent behavior change):** `/api/study/next`'s
  response gains a `newCardsToday: { introduced: number; limit: number | null }`
  field (computed the same way as the scheduling check) alongside the
  existing `card`. Thread it through `useStudySession.ts` as new state, and
  render a chip in `study/index.vue`'s existing `.scope-row` (next to the
  `.count` "Card N this session" span) reading "New cards today: N/Y",
  shown only when `limit !== null`. Give it a distinct visual state (e.g. a
  modifier class) when `introduced >= limit`, reusing the existing `.chip`
  pill styling rather than inventing new UI chrome.
- **Settings UI** (`app/pages/settings.vue`): a clearly visible on/off
  control (checkbox + label) plus a number input, in a bordered card block
  matching the existing `.download-folder-picker` treatment. Turning it on
  with no prior value defaults to `20` (Anki's own default), not `0` or
  blank. Follow the page's established pattern: local `is...ing`/`...Error`
  refs, `$fetch` on `@change` (not per-keystroke), `await refresh()` after a
  successful call, errors shown via the existing `.add-error` style. Keep a
  local ref for the last-typed number so toggling off (which persists `null`
  server-side) and back on in the same session restores it instead of
  resetting to the `20` default every time.

Must not break:

- `sessionComplete` ("All caught up! Nothing due right now.") must still mean
  *no due card at all*. The cap must never cause that message while
  due-but-not-new cards remain - it only removes new cards from
  contention, it never manufactures a false "nothing due."
- Boxes 2-5 and the box-1 learning-streak scheduling (previous fix) are
  unaffected - this only adds an extra filter condition to which cards are
  eligible, not how a served card's box/streak changes on review.

## Build steps

1. [x] **Schema, migration, and settings util** - add `dailyNewCardLimit` to
   `mediaLibrarySettings` in `schema.ts`, generate + apply the migration,
   add `getDailyNewCardLimit`/`setDailyNewCardLimit` to `mediaLibrary.ts`.
   Done when: the dev DB has the new nullable column and the two util
   functions round-trip a value correctly (manual check via a temp script or
   the API once step 2 exposes it).

2. [x] **API surface** - add `dailyNewCardLimit` to `GET /api/media-library`'s
   response and create `POST /api/media-library/daily-new-card-limit`. Done
   when: `curl`ing the GET route shows the field, and POSTing a valid/invalid
   value succeeds/400s as expected.

3. [x] **Scheduling + visibility data** - implement the "introduced today" count
   and the cap-aware filter in `getNextDueCard`, and add `newCardsToday` to
   `/api/study/next`'s response. Done when: with a low limit (e.g. `1`) set,
   introducing one new card via a real review makes a second never-reviewed
   card stop appearing from `/api/study/next` while a due review/relapse
   card (if any) still appears; `newCardsToday.introduced` increments
   correctly after each first-time review.

4. [x] **UI** - add the Settings toggle + number input, and the `/study`
   scope-row chip (with its "reached" visual state). Done when: toggling the
   setting on `/settings` persists and reloads correctly, and the chip on
   `/study` shows "New cards today: N/Y" that updates as new cards get
   reviewed, changing appearance once N reaches Y.

## Verify

- Set the daily limit to `1` in Settings. Confirm it persists after a page
  reload.
- On `/study` (scope: all), review one never-before-seen card. The chip
  should read "New cards today: 1/1" (or similar) and switch to its
  "reached" state.
- Confirm a second never-reviewed card does *not* appear next, but any
  genuinely due review/relapse card still does.
- If there are zero due review cards left after the cap kicks in, confirm
  the session correctly shows "All caught up!" rather than incorrectly
  serving a new card.
- Turn the limit off (uncheck it) and confirm new cards resume appearing
  immediately, and the chip disappears.
- Turn it back on in the same session without reloading and confirm the
  number input remembers the last value you'd set (not reset to `20`).
- No test runner is configured in this project yet; the "introduced today"
  aggregate query is a reasonable `/tests` candidate later, but it's
  optional here.
