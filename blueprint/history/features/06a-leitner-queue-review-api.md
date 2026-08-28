# Feature: Leitner queue + review API

**From build-plan:** feature 6a
**Status:** verified

## Goal

The scheduling engine behind the study session: the Leitner box/interval
rules, a "what's due right now" query (optionally scoped to one deck, per
feature 5's `{ type, id }` shape), and the endpoint that records a
pass/fail and advances a card. This ships no UI - feature 6b's study
screen is the client. Verified the same way features 3-5 were: build,
boot, curl.

## In scope

- Leitner box/interval rules, locked here since nothing upstream defines
  them: 5 boxes, `box -> interval` of `{1: 0 days, 2: 1 day, 3: 3 days, 4:
  7 days, 5: 14 days}`. Pass advances one box (capped at 5); fail resets to
  box 1. Box 1's 0-day interval is what makes a failed card "due again
  immediately" - see Notes for why that's load-bearing for 6b's session
  loop.
- `GET /api/study/next?type=all|artist|anime&id=<number>` - the single
  most-overdue due card for the given scope, or `null` if nothing's due
  right now
- `POST /api/study/review` - given a `cardId` and `pass`/`fail`, applies
  the Leitner rules, updates the card's `box`/`nextReviewAt`, and writes a
  `ReviewLog` row
- Extending the deck-identifier shape from feature 5 (`{ type: "artist" |
  "anime"; id: number }`) with a third `{ type: "all" }` case for
  study-scope selection

## Out of scope

- Any UI - feature 6b builds the session screen against these two
  endpoints
- Video/audio playback, pass/fail keyboard controls - 6b
- Language display toggles / furigana - 6c
- A "session" as a stored or tracked concept - there's no session id,
  start/end, or server-side queue state. Each `GET /api/study/next` call
  is independently computed from `nextReviewAt`; a failed card simply
  becomes due again (interval 0) and will resurface on a later call. This
  is a deliberate simplicity choice, not a placeholder for a real session
  construct later
- Changing the Leitner box count or interval values based on user
  preference - fixed constants, no settings UI for this
- Any change to `Card`/`ReviewLog`'s schema - both already have every
  field this feature needs, from feature 1

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Leitner queue + review API** - add
  `nuxt-app/server/utils/study.ts` (`computeNextBoxState(currentBox,
  result): { box, nextReviewAt }` implementing the box/interval table
  above, `recordReview(cardId, result)` that loads the card, applies
  `computeNextBoxState`, updates `card`, inserts a `ReviewLog` row with
  `boxBefore`/`boxAfter`, and returns the updated `CardWithDetails`);
  extend `nuxt-app/server/utils/cards.ts` with `StudyScope` (`{type:"all"}
  | {type:"artist";id:number} | {type:"anime";id:number}`) and
  `getNextDueCard(scope)` (reuses the existing private `cardQuery()`,
  filters `nextReviewAt <= now`, applies the scope's artist/anime filter
  when present, orders by `nextReviewAt` ascending, takes one); add
  `nuxt-app/server/api/study/next.get.ts` and
  `nuxt-app/server/api/study/review.post.ts`, the latter reusing
  `decks.ts`'s `getArtistLabel`/`getAnimeLabel` to 404 on a nonexistent
  deck id before querying for a due card. *Done when*, against a running
  dev server, using a **dedicated test card created for this
  verification** (never an existing real card - see Notes): create a card
  for song id `1` (Kessoku Band / Bocchi the Rock!); `curl
  'localhost:3000/api/study/next?type=artist&id=1'` returns that card;
  `curl -X POST -d '{"cardId":<id>,"result":"pass"}' -H
  'content-type: application/json' localhost:3000/api/study/review`
  returns `200` with `box: 2` and `nextReviewAt` ~1 day out; a second pass
  moves it to `box: 3`; `curl -X POST -d
  '{"cardId":<id>,"result":"fail"}' ...` resets it to `box: 1` and
  `nextReviewAt` at or before now; `curl
  'localhost:3000/api/study/next?type=artist&id=1'` immediately after
  that fail still returns the same card (proving the 0-day box-1 interval
  makes it due again right away); `curl -X POST -d
  '{"cardId":999999,"result":"pass"}' ...` returns `404`; `curl -X POST
  -d '{"cardId":<id>,"result":"maybe"}' ...` returns `400`; `curl
  'localhost:3000/api/study/next?type=artist&id=999999'` returns `404`
  (nonexistent artist); after deleting the test card, `curl
  'localhost:3000/api/study/next?type=artist&id=1'` returns `{"card":
  null}`; `curl 'localhost:3000/api/study/next?type=all'` returns `200`
  (asserting only that it succeeds, not which card - real due cards from
  your own use of the app will exist); build + `tsc --build` clean.

## Files / areas

- `nuxt-app/server/utils/study.ts` - new
- `nuxt-app/server/utils/cards.ts` - add `StudyScope`, `getNextDueCard`
- `nuxt-app/server/api/study/next.get.ts` - new
- `nuxt-app/server/api/study/review.post.ts` - new

## Data / contracts

No schema changes.

**Study scope shape** (extends feature 5's deck-identifier - load-bearing
for 6b, which will pass this straight through from `/decks`'s URL query or
a global "study all" entry point):

```ts
type StudyScope = { type: "all" } | { type: "artist"; id: number } | { type: "anime"; id: number };
```

**Leitner table** (load-bearing for 6b's expectations about session
length/pacing, and for anyone later tuning it):

| Box | Interval before next due |
|---|---|
| 1 | 0 days (immediately due again) |
| 2 | 1 day |
| 3 | 3 days |
| 4 | 7 days |
| 5 (max) | 14 days |

Pass: `box = min(box + 1, 5)`. Fail: `box = 1`. Either way,
`nextReviewAt = now + interval[newBox]`.

**API contract**

- `GET /api/study/next?type=all` -> `200 { card: CardWithDetails | null }`.
- `GET /api/study/next?type=artist&id=<n>` /
  `?type=anime&id=<n>` -> same shape, scoped; `404` if that artist/anime
  id doesn't exist at all (reusing feature 5's existence-check pattern);
  `card: null` (not 404) when the deck exists but nothing is due.
- `GET /api/study/next` with a missing/invalid `type`, or `artist`/`anime`
  without a numeric `id` -> `400`.
- `POST /api/study/review` body `{ cardId: number, result: "pass" | "fail"
  }` -> `200 { card: CardWithDetails }` (the updated card, reflecting the
  new `box`/`nextReviewAt`). `400` if `cardId` isn't a number or `result`
  isn't exactly `"pass"`/`"fail"`. `404` if `cardId` doesn't reference an
  existing card.

## Testing

Still no test runner configured. `computeNextBoxState` is the strongest
candidate for a unit test this project has had yet - pure function, fixed
table, real edge cases (box capped at 5 on repeated passes, reset to 1 on
fail, the box-1/0-day case that 6b's session loop depends on). If `/tests`
gets run before or during this feature, add a focused test for it then;
until it does, the curl sequence above exercises every branch (pass
mid-table, pass at cap behavior would need box 5 - not separately curled
below box 3 for brevity, but the formula is `min(box+1,5)` so this is
low-risk) against the real DB. `getNextDueCard` and `recordReview` are
integration-shaped (real DB reads/writes) and stay curl-verified rather
than unit-tested either way.

## Notes for the AI

- **Never run `POST /api/study/review` against a real card during
  verification.** Unlike feature 5 (read-only), this feature mutates
  `box`/`nextReviewAt` and writes `ReviewLog` rows - doing that against an
  existing card (there is at least one real one already in the dev DB,
  from the user's own testing after feature 4) would corrupt their actual
  progress. Create a dedicated test card, verify against it, then delete
  it, exactly like the done-when above does.
- Reuse `cards.ts`'s private `cardQuery()` for `getNextDueCard`, same
  pattern as feature 5's `listCardsByArtist`/`listCardsByAnime` - don't
  duplicate the join.
- Reuse `decks.ts`'s `getArtistLabel`/`getAnimeLabel` for the 404 check in
  `study/next.get.ts` rather than writing a new existence query - they
  already do exactly this lookup.
- `card.nextReviewAt` is a Drizzle `timestamp`-mode integer column
  (already established in `schema.ts`); compare against `new Date()`
  directly, no manual epoch math needed beyond what `computeNextBoxState`
  does to compute the new value.
- The box-1/0-day interval is a deliberate design choice, not an
  oversight: it's what lets a missed card resurface later in the same
  study session (6b) purely by calling `next` again, with no separate
  "session queue" state to build or maintain.
