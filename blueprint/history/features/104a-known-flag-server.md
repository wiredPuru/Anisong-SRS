# Feature: Known flag + server (104a)

**From build-plan:** feature 104a (parent: 104, Learning status)
**Status:** verified

## Goal

Add a stored per-card `known` flag and a derived learning status
(New / Learning / Known / Suspended), so a card the user already knows can be
taken out of the Leitner queue without touching its schedule. This is the
server half: the flag, the route that sets it, the exclusion wherever
`suspended` already excludes, and the stats count. The status chip and the
Mark known controls are 104b.

## In scope

- `Card.known` column (boolean, not null, default `false`), one Drizzle
  migration.
- A SQL `cardStatusExpr` and a `status` field on `CardWithDetails`:
  `suspended` wins, then `known`, then Learning if the card has any
  `ReviewLog` row on any grading track, else New.
- `known` and `suspended` are mutually exclusive, enforced server-side in both
  setters: marking known clears `suspended`; suspending clears `known`.
- `POST /api/cards/known` `{ ids (1-500), known }` -> `{ updated, notFound }`,
  same shape and limits as `POST /api/cards/suspend`.
- Known cards are excluded exactly where suspended ones are: `baseDueCondition`
  (next card, "N left", prefetch lookahead, Home and Decks due counts),
  `getPracticeCard` (infinite mode), and `/stats`' review forecast.
- `/stats` collection health returns `knownCards`; known cards leave the box
  distribution, mature %, and never-reviewed count, and show as one extra
  "Known" figure in the existing panel (the only UI in this sub-feature).
- Tests for every piece of new logic.

## Out of scope

- The status chip on `/cards`, the inspector and Study's info; Mark known /
  unknown controls; the Status filter; "Mark all N matching known" (all 104b).
- Any change to box, streak, due date, or `ReviewLog` when marking or
  unmarking. Unmarking resumes the schedule as it was.
- Per-grading-track Known: it is per card, like Suspend.
- Bury (feature 87) is unchanged and gets no status.
- Deck export/import (feature 9) and library recovery (feature 83) do not
  carry `known`; imported and recovered cards start not known.
- Listen mode and party mode: they do not read the flag (confirm in step 3
  that they ignore `suspended` today, and match that).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Column, status type, and derivation** - `card.known` in
  `server/db/schema.ts` beside `suspended` (comment: out of Study until
  unmarked, never set with `suspended`, feature 104), migration `0035` via
  `drizzle-kit generate`. A new `server/utils/cardStatus.ts` exporting
  `CardStatus = "new" | "learning" | "known" | "suspended"` and `cardStatusExpr`,
  one SQL `case` expression (not a JS function, since every card query shares
  `cardSelection`; the `exists` subquery on `review_log.cardId` covers any
  criterion). `CardWithDetails` and `cardSelection` gain `known` and `status`. Every
  hand-mirrored client copy of `CardWithDetails` that declares `suspended` gains
  the same two fields in the same order. *Done when:* the migration applies on
  boot against a copy of the live DB with every existing card `known = false`;
  `GET /api/cards` rows carry `known` and `status`; status tests (through `listCards`
  on an in-memory DB) cover the four outcomes and the precedence (suspended + known together still
  reads "suspended"; known beats a reviewed card); typecheck and build pass.
- [x] **Step 2 - Set known route with mutual exclusion** - new
  `server/utils/cardKnown.ts` (`parseKnownBody`, `setCardsKnown`, mirroring
  `cardSuspend.ts`) and `server/api/cards/known.post.ts`. `setCardsKnown(ids,
  true)` also sets `suspended = false` in the same UPDATE; `setCardsSuspended(ids,
  true)` also sets `known = false`. Unsuspending and unmarking touch only their
  own flag. *Done when:* tests prove: bad bodies are rejected (non-boolean
  `known`, empty ids, over 500, non-integers); unknown ids come back in
  `notFound`; marking a suspended card known leaves it known and not suspended;
  suspending a known card leaves it suspended and not known; marking unknown
  changes nothing else (box, streak, `nextReviewAt` and review rows identical
  before and after).
- [x] **Step 3 - Keep known cards out of Study** - `baseDueCondition`,
  `getPracticeCard`'s `playable` condition, and `getReviewForecast`'s
  `notSuspended` also require `known = false` (rename the forecast local to
  `inRotation`). Check by reading `partySources.ts`, the Listen queue code, and
  `getUpcomingDueCards` that none of them need a change. *Done when:* tests in
  the style of `cardSuspendDue.test.ts` and `practiceCard.test.ts` show a known
  card is absent from the due count, next card, and practice pool, on the title
  track and on a non-title track; a due card marked known and then unmarked is
  due again immediately with its old box.
- [x] **Step 4 - Known in collection health** - `getCollectionHealth` counts
  known cards in the track's population as `knownCards` and excludes them from
  `boxCounts`, `boxOneStreakCounts` and `neverReviewed`;
  `shapeCollectionHealth` and `CollectionHealth` (server and the hand-mirrored
  client copy) gain the field; the existing collection-health panel on `/stats`
  shows "N known" as a plain line under its figures. *Done when:* the
  `shapeCollectionHealth` test asserts `knownCards` passes through and that
  `totalCards` and mature % are computed without known cards; on `/stats`
  (browser evidence) marking a few cards known by calling the route changes the
  line and drops them from the box bars; with zero known the line is hidden.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `server/db/migrations/0035_*.sql` + meta
- `nuxt-app/server/utils/cardStatus.ts` (+ test), `cardKnown.ts` (+ test)
- `nuxt-app/server/utils/cardSuspend.ts` (clear `known` on suspend)
- `nuxt-app/server/utils/cards.ts` (selection, `baseDueCondition`,
  `getPracticeCard`)
- `nuxt-app/server/utils/stats.ts` (+ its test), `server/api/cards/known.post.ts`
- Client `CardWithDetails` mirrors (grep `suspended: boolean`) and `/stats`'
  collection-health panel

## Data / contracts

- Load-bearing for 104b: `CardWithDetails.known: boolean` and
  `CardWithDetails.status: CardStatus`, placed right after `suspended` in both
  the server declaration and each client mirror (F-09).
- `POST /api/cards/known` body `{ ids: number[], known: boolean }` (1-500
  unique positive integers) returns `{ updated: number, notFound: number[] }`.
- Invariant: no row has `known = 1` and `suspended = 1`. Both setters keep it;
  the migration needs no backfill since both default to false.
- `CollectionHealth.knownCards: number`.

## Testing

Vitest is configured, so the gate is on. In-scope logic needing tests:
`cardStatusExpr` (via `listCards`), `parseKnownBody`, `setCardsKnown` and the
`setCardsSuspended` exclusion, the three due/practice/forecast conditions, and
`shapeCollectionHealth`. Follow the in-memory DB pattern of `cardSuspend.test.ts`
and `cardSuspendDue.test.ts`. The `/stats` line rides on browser evidence (and
`bun run build`). Run `bun run test` and `bun run build` in `nuxt-app/`.

## Notes for the AI

- Mirror `cardSuspend.ts` closely; do not invent a new bulk-body shape.
- `box`, `streak` and `nextReviewAt` are never written by this feature.
- Comments explain why only; no em dashes; no inline styles; stats UI uses
  existing tokens.
- Migrations only through Drizzle (`drizzle-kit generate`), never hand `ALTER`.
- If step 3's read shows party or Listen DO exclude suspended cards, add known
  there too and say so in the diff summary.
