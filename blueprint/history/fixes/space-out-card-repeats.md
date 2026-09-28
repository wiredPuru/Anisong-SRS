# Space out repeats of the same card in Study

**Type:** Fix
**Status:** verified

## The problem

In a Study session the same card can come up two or three times in a row, so
by the second showing the answer is already fresh and the review means nothing.

The cause is how `getNextDueCard` (`server/utils/cards.ts`) picks a card, not
the Leitner rules themselves:

- A card in box 1 stays there until it gets `boxOneStreakRequired` (default 3)
  passes in a row, and every box-1 review (pass or fail) sets `nextReviewAt` to
  now (`computeNextBoxState`, `server/utils/study.ts`). So a learning card is
  immediately due again after each of its first reviews.
- `pickRandomDueOrder` picks among the cards due on the earliest day using
  `dailyTieBreakRank(id, dayKey)`, a rank that stays the same all day on
  purpose (it keeps the prefetch guess accurate). A just-reviewed card lands
  back in today's group with the same rank. If it had the lowest rank before,
  it still does, so it wins again, and again, until it leaves box 1. That is
  exactly the "three times in a row" pattern.

The server never learns what was just shown: `GET /api/study/next` takes only
scope, `includeNew`, and filters.

## The fix

Let the client tell the server which cards it just reviewed, and have the
server serve something else whenever anything else is due.

- **Client:** `useStudySession` keeps `recentCardIds`, the ids of the last
  `RECENT_CARD_WINDOW` (5) cards reviewed this session, newest last, with no
  duplicates (a re-reviewed id moves to the end). Each successful `submit()`
  adds to it. A scope change clears it, like `reviewedCount`; a filter change
  keeps it. `fetchNext()` sends it as `recent=<id>,<id>,...`, and leaves the
  param out when the list is empty. Nothing is persisted.
- **Server:** a pure `orderAwayFromRecent(pool, recentIds, count, now)` in
  `server/utils/cards.ts` splits the due pool into cards not in `recentIds` and
  cards that are.
  - If any non-recent card is due, it picks from those with the existing
    `pickRandomDueOrder` unchanged, so earliest-day-first and the stable daily
    tie-break still hold.
  - Only when *every* due card is recent does it serve a recent one, choosing
    the one reviewed longest ago (the earliest in `recentIds`). With two due
    cards they alternate instead of one repeating.
  - A lone due card still repeats. There is nothing else to show, and holding
    it back would stall the session.
- `getNextDueCard` and `getUpcomingDueCards` both take `recentIds` and go
  through it, so the prefetch guess matches what gets served next:
  `getUpcomingDueCards` treats the card being served now as the most recent.
- **Parsing:** `parseRecentCardIds(raw)` in a new `server/utils/studyRecent.ts`.
  An absent or empty value returns `[]`. Otherwise it expects comma-separated
  positive integers, at most 20 (the client sends 5; the cap only bounds the
  input), and returns `{ error }` for anything else. The route answers `400`
  for an error, the same way `parseStudyFilters` is handled.

Must not break:

- Scheduling, `ReviewLog`, boxes, intervals, and `dueCount`. This changes only
  *which* due card is served first, never whether a card is due or how many
  are left.
- Cards due on an earlier day still come before today's.
- The daily new-card cap, filters, criteria tracks, and the stable tie-break
  (`pickRandomDueOrder`'s existing tests stay green).
- Home, Decks, and Stats, which never call these functions with a recent list.

## Build steps

- [x] **1. Server: recent-aware ordering + parser.** Add `parseRecentCardIds`
  (`server/utils/studyRecent.ts`) and `orderAwayFromRecent`, thread `recentIds`
  (default `[]`) through `getNextDueCard` and `getUpcomingDueCards`, and read
  `recent` in `server/api/study/next.get.ts`. Tests: `studyRecent.test.ts`
  (absent, empty, valid, duplicates, non-numeric, zero/negative, over the cap)
  and `orderAwayFromRecent` cases in `cards.test.ts` (non-recent always wins
  when present; all recent picks the oldest-reviewed; two cards alternate; a
  lone card repeats; an earlier-day card still beats today's; an empty
  `recentIds` matches `pickRandomDueOrder` exactly).
  **Done when:** `bun run test` passes with the new cases, and
  `GET /api/study/next?type=all&recent=<current card id>` returns a different
  card whenever more than one is due.
- [x] **2. Client: send the recent list.** `useStudySession` tracks
  `recentCardIds` as above and sends it from `fetchNext()`. Confirm the
  typed-answers path records reviews through the same `submit()`, so both
  modes feed the list.
  **Done when:** in a session with several due box-1 cards, passing a card
  never serves that same card next, and the request URL carries `recent=`.

## Verify

- `bun run test` and `bun run build` from `nuxt-app/`.
- Study a scope with several new or box-1 cards. Pass the first card three
  times whenever it comes up: other cards should show in between, not the same
  card back to back.
- Study a scope with exactly two due cards: they alternate.
- A scope with one due card still serves it, and "All caught up" still appears
  once nothing is due.
