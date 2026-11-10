# Fix: Study shows too many new cards before repeating ones in learning

**Type:** Fix
**Status:** verified

## The problem

Studying a deck with many never-reviewed cards (for example Konomi Suzuki)
keeps serving new cards instead of repeating the ones just seen. Cause, in
`getNextDueCard` / `getUpcomingDueCards` (`nuxt-app/server/utils/cards.ts`):

1. **New and learning cards share one pool.** A never-reviewed card is "due"
   (`nextReviewAt` = its creation time) exactly like a box-1 card that was
   just failed or passed once. Nothing separates "introduce something new"
   from "repeat something I am still learning".
2. **Learning cards are demoted, not prioritised.** `orderAwayFromRecent`
   pushes the last 5 reviewed cards behind every other due card. Once a
   learning card leaves that 5-card window it competes in a random draw
   against every untouched card, so with 40 new cards it comes back with
   roughly a 1-in-40 chance per draw.
3. **Older new cards outrank today's learning cards.** `pickRandomDueOrder`
   serves the earliest calendar day first. A new card imported yesterday has
   an earlier `nextReviewAt` than a card failed 2 minutes ago, so it wins.

Box intervals (0 / 1 / 3 / 7 / 14 days) and the box-1 streak setting are not
the problem and stay as they are.

## The fix

Serve the due pool in Anki/Migaku-style tiers instead of one shuffled pool.
Each card is classified for the active grading track (criterion):

- **New:** no `ReviewLog` row for this card and criterion.
- **Learning:** has a review row and is in box 1 (failed, or mid box-1 streak).
- **Review:** box 2 or higher.

Order, first match wins:

1. **Reviews**, most overdue first (today's existing earliest-day-first,
   same-day pseudo-random tie-break).
2. **Learning cards outside the recent window**, so a card comes back after a
   few other cards, not immediately and not after the whole deck.
3. **New cards**, but only while the learning backlog (learning cards in the
   queue, recent ones included) is below a cap of **5**. At the cap, no new
   card is introduced: the learning card reviewed longest ago is served even
   if it is inside the recent window. This is the "more repetition before
   moving on" behaviour.
4. If nothing else exists, today's fallback (recent cards, oldest first).

Implementation shape:

- One pure, exported helper, `orderDueQueue(pool, reviewedIds, recentIds,
  count, now)`, built on the existing `pickRandomDueOrder`, with
  `LEARNING_BACKLOG_CAP = 5`. Replaces `orderAwayFromRecent` at both call
  sites so the prefetch lookahead predicts what is really served next.
- `reviewedIds`: a `Set` of card ids with a `ReviewLog` row for the criterion
  (one query, the same `reviewLog.criterion` filter `baseDueCondition`
  already uses). An undone first review deletes its row, so that card is new
  again, which is correct.
- No schema change, no migration, no new setting, no client change. The
  client's 5-card recent window is unchanged.

Must not break:

- Leitner math in `study.ts` (`computeNextBoxState`) and box-1 streak setting.
- Daily new-card limit, "Study new cards", `dueCount`, `withheldNew`, Home and
  Decks due counts (they never pick a card).
- Scope, filters, theme mix, bury, `prefer` (undo), and infinite/practice
  mode, which has its own picker (`pickPracticeId`).
- Non-title tracks (feature 71/72): classification is per criterion.

Out of scope (say so if wanted later): minute-based learning steps, ease
factors, changing the 0/1/3/7/14 intervals. If new cards are still too many
per day, set Settings > Study pacing > daily new card limit (null today, so
unlimited).

## Build steps

- [x] **Step 1 - Pure queue ordering + tests.** Add `orderDueQueue` and
  `LEARNING_BACKLOG_CAP` to `server/utils/cards.ts`, with tests in
  `server/utils/cards.test.ts`.
  *Done when:* tests pass for: a review card beats learning and new; a
  learning card outside the recent window beats an older new card; with 5
  learning cards and many new, no new card is returned and the learning card
  reviewed longest ago comes first; with fewer than 5 learning cards all in
  the recent window, a new card is returned; only recent learning cards and
  no new cards returns the oldest-recent one; `count > 1` (prefetch) yields
  the same order repeated picks would.

- [x] **Step 2 - Wire into serving.** Add the reviewed-ids lookup and use
  `orderDueQueue` in `getNextDueCard` and `getUpcomingDueCards`; remove
  `orderAwayFromRecent` and its now-dead tests if nothing else uses it.
  *Done when:* `bun run test` is green, `bun run build` succeeds, and in
  `/study` on a deck of 20+ unreviewed cards, failing the first card brings it
  back within about 5 cards, and no more than 5 distinct unfinished cards are
  in play at once before any new card appears.

## Verify

1. `cd nuxt-app && bun run test` and `bun run build`.
2. `bun run dev`, open `/study` scoped to the Konomi Suzuki deck (or any deck
   with 20+ new cards), Typed Answers off for speed.
3. Press Fail on the first card, then answer the following cards Pass. The
   failed card should return within roughly 5 cards.
4. Keep failing: after 5 distinct cards are in learning, no unseen card
   appears until one graduates (passes twice in a row, or the streak you set).
5. Check "N left" in the header and Home's due count are unchanged by the fix.
