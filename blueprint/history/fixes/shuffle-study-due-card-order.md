# Fix: Study serves due cards in a fixed order per artist/anime instead of shuffling

**Type:** Fix
**Status:** verified

## The problem

`getNextDueCard()` (`nuxt-app/server/utils/cards.ts`) always picks the single
most-overdue due card via `orderBy(asc(card.nextReviewAt))`. Cards added
together (e.g. a bulk artist import, feature 37b) all get the same
`nextReviewAt` default at creation, so they're exact ties - SQLite breaks
those ties by row insertion order, which never changes. The result: starting
a Study session on the same artist/anime/all scope serves the same first
card, then the same second, and so on, every time - it looks "structured"
rather than random, even though nothing about the Leitner scheduling itself
is wrong.

`getUpcomingDueCards()` (used to prefetch the next 2 clips) has the identical
ordering and the identical tie-break, so it also always predicted the same
"upcoming" cards in the same order.

## The fix

Kept the Leitner box/interval math in `server/utils/study.ts`
(`computeNextBoxState`) completely untouched - this is about presentation
order, not scheduling. Card *selection* now shuffles among currently-due
cards, but only within same-day ties: cards that are more genuinely overdue
(due on an earlier calendar day) still come first. This keeps "working with
the algorithm": a card overdue by a week still generally surfaces before one
that just became due today, but which card comes first *within* today's due
batch is no longer fixed by insertion order.

Added one pure, testable helper in `server/utils/cards.ts`:

```ts
export function pickRandomDueOrder<T extends { nextReviewAt: Date }>(pool: readonly T[], count: number): T[]
```

`pool` must already be sorted ascending by `nextReviewAt`. It repeatedly:
1. Finds the earliest remaining calendar-day bucket (`Math.floor(nextReviewAt.getTime() / DAY_MS)`).
2. Picks uniformly at random among the remaining cards in that bucket.
3. Removes the picked card and repeats until `count` picks are made or the pool is exhausted.

Used from both:
- `getNextDueCard()` - fetches the full due pool (same query/condition as before, just without the implicit `.get()` single-row cutoff) ordered by `nextReviewAt` asc, then returns `pickRandomDueOrder(pool, 1)[0]`.
- `getUpcomingDueCards()` - same pool, `pickRandomDueOrder(pool, limit)` - keeps the prefetch list consistent with what `getNextDueCard` tends to actually serve next, instead of drifting from it.

Unaffected: daily new-card limit behavior, scope filtering (all/artist/anime),
`getDueCardCount`/`getWithheldNewCount`/`getDueCardBreakdown` (they don't pick
a card), and the Leitner box/streak/interval logic in `study.ts`.

## Build steps

- [x] **Step 1 - Add `pickRandomDueOrder` and wire it into both selection
  functions**, replacing the previous `orderBy(asc(nextReviewAt)).get()` /
  `.limit(limit)` single-deterministic-order behavior with the pooled random
  pick described above.
  *Done when:* `server/utils/cards.test.ts` seeds several cards with
  identical `nextReviewAt` (same-day tie) plus one clearly overdue card from
  an earlier day, mocks `Math.random`, and asserts (a) the earlier-day card
  always wins first, and (b) varying the mocked random value changes which
  same-day card is picked.

## Verify

- `bun run test` - 8 files, 51 tests passed, including the new
  `cards.test.ts` coverage (empty pool, earlier-day priority, same-day
  shuffling, no-repeat/exhaustion, and UTC calendar-day bucket edges).
- `bun run build` - clean production build.
- Manual: start Study on an artist/scope with several due cards, restart the
  session a few times - order varies instead of repeating identically, while
  a genuinely more-overdue card still tends to come up first.
