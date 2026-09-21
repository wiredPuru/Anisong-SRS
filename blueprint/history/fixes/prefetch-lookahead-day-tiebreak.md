# Current Feature

## Title

Lookahead prefetch rarely warms the card the queue actually serves next

## Type

Fix

## Status

verified

## The problem

Feature 41's stream-cache prefetch is supposed to warm the next couple of
due cards in the background while the current one plays. It's wired up
correctly end to end - `useStudySession.fetchNext()`
(`app/composables/useStudySession.ts:90-96`) POSTs
`/api/media/prefetch` for each card in `/api/study/next`'s `upcoming` array,
and `/api/media/prefetch` (`server/api/media/prefetch.post.ts`) really does
fetch and cache the full file server-side. Verified the cache directory
(`.data/stream-cache/`) is actively receiving new files during normal use.

The bug is upstream, in how "upcoming" is chosen. `getNextDueCard` and
`getUpcomingDueCards` (`server/utils/cards.ts:296-316`) both sort the due
pool ascending by `nextReviewAt`, then break ties within the earliest
calendar-day bucket by calling `pickRandomDueOrder`, which picks a **fresh
`Math.random()` draw on every single call** (`server/utils/cards.ts:279-294`).

`/api/study/next` calls both functions back to back for one request, but
the request that matters is the *next* one - the one that fires after the
user answers and the queue actually advances. That request calls
`getNextDueCard` completely independently, with its own fresh random draw
over the same tied pool. Nothing connects "the card `getUpcomingDueCards`
guessed" to "the card `getNextDueCard` actually serves two turns later."

This is silent almost all of the time: a box-1 card that fails keeps its
0-day interval and stays immediately due, so on an active session most due
cards pile up tied on the same calendar day (today). Whenever more than a
couple of cards are tied like that - the common case, per
`build-plan.md`/`project-overview.md`'s activity notes (72 reviews on
2026-09-18, 38 on 2026-09-19) - the odds that the two cards prefetched after
card A are the same two cards actually served after A drop fast (roughly
2/pool_size for a tied pool of that size). The prefetch fires, downloads
real bytes, and just usually downloads the wrong card - so whichever card
actually becomes current still has to start its fetch from zero, which
reads exactly like "it's not using the cache."

Confirmed via `git log`/reading the code, not by reproducing a live queue
mismatch - the fix should add a test that pins down the actual defect
(prediction/serve correlation), not just re-verify the file downloads.

## The fix

Make the same-day tie-break deterministic instead of freshly random on every
call, so a prediction made in one `/api/study/next` response is still true
by the time the next request needs it.

- Replace `pickRandomDueOrder`'s `Math.random()` tie-break
  (`server/utils/cards.ts:279-294`) with a stable pseudo-random rank seeded
  by `(card.id, calendar day in UTC)` - e.g. a small integer hash (not a
  naive polynomial string hash keyed on the low digits of `id`, which
  degenerates back into insertion order for consecutive ids; needs a proper
  bit-mixing finalizer). Earlier-day-first behavior is unchanged; only how a
  same-day tie is broken changes.
- Add an optional `now: Date = new Date()` parameter to
  `pickRandomDueOrder` so the day-seed is injectable in tests without
  mocking `Math.random` or the system clock.
- Tighten `pickRandomDueOrder`'s generic constraint to require `id: number`
  (every real caller - `CardWithDetails` - already has it).
- Same (id, day) always ranks the same, so:
  - Within one calendar day, repeated `/api/study/next` calls draw from the
    same effective ordering, so a card predicted as "upcoming" is what
    actually gets served once the pool ahead of it hasn't changed.
  - The order still isn't fixed forever (the point of the original
    Math.random() call, per its comment: avoid bulk-imported cards always
    surfacing in row-insertion order) - it reshuffles once the day rolls
    over.
- Must not change: earlier-day-always-wins ordering, "never repeats a card /
  stops once pool exhausted" behavior, or the existing callers'
  signatures beyond the new optional `now` param.

## Build steps

- [x] 1. Rewrite `pickRandomDueOrder` in `server/utils/cards.ts` to use a
   deterministic per-(id, day) rank instead of `Math.random()`, per "The
   fix" above. Update `server/utils/cards.test.ts`'s `pickRandomDueOrder`
   describe block to inject explicit `now` values instead of mocking
   `Math.random`, covering: earlier-day-first still wins; same-day order is
   stable across repeated calls on the same seed day (this is the actual
   regression test - it directly encodes "a prediction stays true on the
   next call"); same-day order changes once the day rolls over (proves it's
   not silently degenerated back into insertion order); pool exhaustion;
   the two existing day-bucket-boundary cases.
   Done when: `bun run test` is green, including the rewritten suite, with
   no `Math.random` mocking left in that describe block.

## Verify

- `bun run test` passes.
- Manual: with several box-1 cards due today, watch `.data/stream-cache/`
  while stepping through `/study` - the file(s) for the card that becomes
  current should already exist in the cache (fresh `atime`, not a
  brand-new file appearing only once that card is actually playing).
