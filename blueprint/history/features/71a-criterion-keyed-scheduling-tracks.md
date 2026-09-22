# Feature: Criterion-keyed scheduling tracks

**From build-plan:** feature 71a (of 71 - Per-deck grading criteria)
**Status:** verified

## Goal

Make Leitner scheduling state keyed by `(card, criterion)` instead of by card
alone, so a card drilled for its song name in one deck and its anime title in
another advances on two independent schedules. This sub-feature builds only the
schema and the server plumbing: there is no way to set a deck's criterion yet,
every deck resolves to `title`, and the app must behave exactly as it does
today. 71b adds the control and the grading; 71c makes stats track-aware.

Built invisibly-first on purpose, the same way 49 and 64a were: the risky part
is the scheduling model, and it is cheaper to prove it inert than to debug it
behind new UI.

## In scope

- `Deck.gradingCriterion`, a `CardTrack` table, and `ReviewLog.criterion`.
- A `GradingCriterion` type plus a parser, shared by server routes.
- Resolving a criterion from the active `StudyScope` (a manual deck's setting;
  `title` for every other scope).
- Threading that criterion through the due query, due count, prefetch
  lookahead, withheld-new count, daily new-card counting, and `recordReview`.
- Filtering `/stats`, Home, and the deck pass-rate tiles to the title track so
  their numbers keep meaning exactly what they mean today.

## Out of scope

- **Any UI.** No control to set a criterion, no Study grading change, no info
  panel change. That is 71b, and until it lands a non-title criterion is only
  reachable by editing the database by hand.
- **Slicing stats by criterion** - 71c. Here non-title reviews are excluded
  from stats, not represented in them.
- **Artist and anime decks.** Derived groupings with no row to hold a setting;
  they stay `title` permanently.
- **Per-deck isolation** of the same criterion. Tracks key on
  `(card, criterion)`, never on deck. Decided and dropped; not a later item.
- **Deck export/import.** Export still covers artist and anime decks only
  (feature 9), which have no criterion, so no manifest change.
- Backfilling or migrating existing scheduling state. There is nothing to
  migrate: the `Card` row *is* the title track.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Criterion type + schema migration** - add
  `server/utils/gradingCriterion.ts` (the `GradingCriterion` type, the
  `GRADING_CRITERIA` list, and a `parseGradingCriterion` that returns the
  criterion or `null`), then `deck.gradingCriterion`, the `cardTrack` table,
  and `reviewLog.criterion` in `schema.ts`, and generate the Drizzle
  migration. Nothing reads the new columns yet.
  *Done when:* `bun run test` is green including new parser tests (each valid
  value, an unknown string, `""`, wrong case, a non-string); the dev server
  boots and applies the migration; `.schema card_track` shows the table with
  its `(card_id, criterion)` unique index; `select grading_criterion from deck`
  returns `title` for every existing deck and `select distinct criterion from
  review_log` returns only `title`; a study session passes and fails a card
  exactly as before.

- [x] **Step 2 - Track state accessors** - add `server/utils/cardTrack.ts`
  holding the one place that knows where a track lives: SQL expression builders
  (`trackNextReviewAtExpr`, `trackBoxExpr`, `trackStreakExpr`) that return the
  bare `card` column for `title` and a `coalesce`d correlated subquery over
  `card_track` otherwise, plus `readTrackState(cardId, criterion)` and
  `writeTrackState(cardId, criterion, state)` that branch the same way
  (`update card` for title, upsert `card_track` for the rest). Correlated
  subqueries rather than a join, following the precedent `scopeFilter` already
  set for `created` decks, so every existing query keeps its join list.
  Nothing calls these yet.
  *Done when:* `bun run test` is green including tests that build each
  expression and assert on `.toSQL().sql` - title yields `"card"."box"` and no
  `card_track` reference, `song` and `both` yield a `card_track` subquery
  filtered by their own criterion value, and the missing-row defaults are
  box 1 / streak 0 / epoch (always due); the app is unchanged.

- [x] **Step 3 - Due queries take a criterion** - thread an optional
  `criterion` parameter, defaulting to `"title"`, through `cardQuery`,
  `baseDueCondition`, `dueCardCondition`, `getNextDueCard`,
  `getUpcomingDueCards`, `getDueCardCount`, `getWithheldNewCount`, and
  `countCardsIntroducedToday`/`getNewCardsTodayInfo`, using Step 2's
  expressions. Pure plumbing: no caller passes anything but the default yet,
  and nothing resolves a criterion from a deck.
  *Done when:* `bun run test` is green including due-condition SQL-shape tests
  (title contains `"card"."next_review_at"` and no `card_track`; `song`
  contains a `card_track` subquery; the already-reviewed subquery backing the
  daily new-card cap filters on the active criterion); every page and every
  study scope is byte-for-byte unchanged, because every call site still passes
  the default.

- [x] **Step 4 - Resolve the criterion from the study scope** - add
  `resolveScopeCriterion(scope)` to `decks.ts`: an early return of `"title"`
  for `all`, `artist`, and `anime`, and a single `deck.gradingCriterion`
  lookup for `{ type: "created" }`. Wire `/api/study/next` to resolve it once,
  pass it to Step 3's functions, and return it in the response.
  *Done when:* `bun run test` is green including `resolveScopeCriterion` tests
  for the three non-deck scopes (no database needed - they return before the
  lookup); `/api/study/next` for every scope returns `criterion: "title"` and
  an identical card, due count, withheld count and lookahead to before the
  change; after setting one manual deck's `grading_criterion` to `song` by
  hand, **reading** that deck (its `dueCount` equals its full card count, its
  cards come back at box 1) behaves as designed while every other scope is
  unchanged. Do not pass or fail a card during this check - review still
  writes the title track until Step 5, so grading here would corrupt real
  scheduling state. Reset the deck to `title` before moving on.

- [x] **Step 5 - Reviews write the criterion's track** - give `recordReview` a
  `criterion` argument: read the state through `readTrackState`, reuse the
  unchanged pure `computeNextBoxState`, write through `writeTrackState`, and
  stamp the `reviewLog` row with the criterion. Extract the request validation
  into `parseReviewBody` in `server/utils/studyReview.ts`, mirroring
  `parseDeleteBody`, so `/api/study/review` accepts an optional `criterion`
  and rejects an invalid one with `400`. `useStudySession` sends back the
  criterion `/api/study/next` returned, and the returned card's `box`/`streak`
  reflect the track just written.
  *Done when:* `bun run test` is green including `parseReviewBody` tests
  (missing `cardId`, non-numeric `cardId`, bad `result`, absent criterion
  defaulting to `title`, an unknown criterion rejected); passing a card in a
  normal deck still advances `card.box` and writes a `title` log row exactly as
  today; passing a card in the hand-set `song` deck inserts or updates its
  `card_track` row, leaves that card's `card.box`/`streak`/`next_review_at`
  untouched, and writes a `song` log row; failing it returns that track alone
  to box 1; resetting the deck to `title` restores its original schedule
  untouched, proving the title track was never written during the detour.

- [x] **Step 6 - Stats, Home, and deck tiles read the title track only** - add
  the `criterion = 'title'` filter to every `review_log`-reading query in
  `server/utils/stats.ts` and `server/utils/decks.ts`, so non-title reviews are
  invisible to analytics until 71c. `Card`-state-derived figures (68a's box
  distribution and due forecast) are already title-only and need no change, and
  the artist/anime deck `dueCount` queries read `baseDueCondition()` at its
  default, so they stay title-only for free.
  *Done when:* the song-track reviews recorded in Step 5 are invisible to
  `/stats` totals, pass rate, the reviews chart, retention by box, records and
  leeches, to Home's 30-day panel and activity heatmap, and to `/decks`'
  pass-rate tiles - each reads exactly what it read before those reviews
  existed; every `review_log` query site in both files either carries the
  filter or is demonstrably not result-bearing; `bun run build` passes.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/gradingCriterion.ts` | New. The type, the value list, and the parser. |
| `nuxt-app/server/utils/gradingCriterion.test.ts` | New. Parser tests. |
| `nuxt-app/server/utils/cardTrack.ts` | New. The only module that knows where a track's state lives. |
| `nuxt-app/server/utils/cardTrack.test.ts` | New. SQL-shape tests for the expression builders. |
| `nuxt-app/server/utils/studyReview.ts` + `.test.ts` | New. `parseReviewBody`, mirroring `cardDelete.ts`. |
| `nuxt-app/server/db/schema.ts` | `deck.gradingCriterion`, `cardTrack`, `reviewLog.criterion`. |
| `nuxt-app/server/db/migrations/0018_*.sql` | Generated by Drizzle, never hand-written. |
| `nuxt-app/server/utils/cards.ts` | Criterion threaded through the due queries and new-card counting. |
| `nuxt-app/server/utils/study.ts` | `recordReview` reads and writes a track. |
| `nuxt-app/server/utils/decks.ts` | `resolveScopeCriterion`; title filter on the pass-rate queries. `ManualDeck` has no `dueCount` field, so manual deck tiles need no criterion-aware count. |
| `nuxt-app/server/utils/stats.ts` | Title filter on every `review_log` query. |
| `nuxt-app/server/api/study/next.get.ts` | Resolves and returns the criterion. |
| `nuxt-app/server/api/study/review.post.ts` | Accepts and validates the criterion. |
| `nuxt-app/app/composables/useStudySession.ts` | Carries the criterion from next to review. |

## Data / contracts

**Load-bearing, 71b and 71c both build on these.**

```ts
// server/utils/gradingCriterion.ts
export type GradingCriterion = "title" | "song" | "both";
```

`Deck` gains:

- `gradingCriterion` (text, not null, default `"title"`) - manual decks only.

New `CardTrack` table, **non-title criteria only**:

- `id` (integer, PK)
- `cardId` (FK -> Card, cascades on delete)
- `criterion` (text, `"song" | "both"`)
- `box` (integer, default `1`)
- `streak` (integer, default `0`)
- `nextReviewAt` (datetime, default now)
- Unique on `(cardId, criterion)`

`ReviewLog` gains:

- `criterion` (text, not null, default `"title"`) - which track the review
  advanced. Every pre-71 row is `title`, which is what they all were.

`GET /api/study/next` gains `criterion: GradingCriterion` in its response.
`POST /api/study/review` gains an optional `criterion` in its body, defaulting
to `"title"`.

**The `Card` row is the title track.** `card.box`/`streak`/`nextReviewAt` keep
their exact current meaning and are never duplicated into `CardTrack`. This is
what makes the migration a pure addition with no backfill, and what keeps every
query written before feature 71 correct without being touched.

**`CardWithDetails` shape is unchanged, but its meaning is now contextual:**
`box`, `streak`, and `nextReviewAt` describe the track that was queried. From
`/api/cards`, `/api/decks/cards` and `/api/cards/download` that is still always
the title track. From `/api/study/next` and `/api/study/review` it is the
active scope's track. Do not add a field for this - the criterion travels
alongside in the response, and the hand-maintained client copy of the type
(F-09) must not drift.

A card with no `CardTrack` row for the criterion being studied is **new and
immediately due**: box 1, streak 0, epoch `nextReviewAt`. Knowing a title says
nothing about knowing the song, so a track starts fresh rather than inheriting.
Changing a deck's criterion later leaves existing rows in place; nothing prunes
a track whose deck no longer uses it.

## Testing

Vitest is configured (`bun run test` from `nuxt-app/`), so the logic-test gate
is on. In-scope logic that must ship a test with its step:

| Step | Test |
|---|---|
| 1 | `parseGradingCriterion` - each valid value, unknown string, empty string, wrong case, non-string input. |
| 2 | `trackBoxExpr`/`trackStreakExpr`/`trackNextReviewAtExpr` via `.toSQL().sql`, per criterion, plus the missing-row defaults. |
| 3 | `dueCardCondition` / `baseDueCondition` SQL shape per criterion, and that the daily-cap "already reviewed" subquery filters on the active criterion. |
| 4 | `resolveScopeCriterion` returning `"title"` for `all`, `artist` and `anime` without reaching the database. |
| 5 | `parseReviewBody` - the same rejection and defaulting cases `parseDeleteBody`'s tests cover. |

Follow `cards.test.ts`'s existing pattern: build the query and assert on
`.toSQL().sql` rather than executing it, and `vi.mock` `mediaLibrary.ts` for
`getDailyNewCardLimit`/`getThemesOnly` where the condition depends on them.

Step 6 adds no pure logic and rides on observed evidence plus `bun run build`.

Manual verification runs against a hand-edited database, since there is no UI
to set a criterion yet:

```sql
update deck set grading_criterion = 'song' where id = <a test deck>;
```

Then study that deck and confirm every card comes back due at box 1. **Only
from Step 5 onward** should a card actually be passed or failed during this
check: until review writes the resolved track, grading a song-criterion deck
would advance the title track and corrupt real scheduling state. From Step 5,
pass one and check that `card_track` gained a row while that card's `card` row
and every stats figure are untouched. Reset with `update deck set
grading_criterion = 'title'` and confirm the deck returns to its original
schedule - proof the title track was never written during the detour.

## Notes for the AI

- **Inert is the acceptance bar.** Every step except the hand-edited database
  check must leave observable behaviour identical. If a step changes what the
  app does, something is wrong.
- Every new parameter defaults to `"title"`. Do not make callers pass a
  criterion they do not care about.
- Schema changes go through a generated Drizzle migration, never a hand-written
  `ALTER TABLE` (see `coding-standards.md`).
- Use correlated subqueries, not joins, for track state - `scopeFilter` in
  `cards.ts` already set that precedent and explains why in a comment worth
  reading first.
- `computeNextBoxState` is already pure and already tested. Reuse it unchanged;
  this feature changes where its inputs come from and where its outputs go, not
  the algorithm, and the Leitner table in `project-overview.md` is untouched.
- `card_track.criterion` is never `"title"`. Consider whether that is worth a
  DB-level check constraint or is better left to `writeTrackState` being the
  only writer; say which you chose and why in the step's summary.
- Server-only throughout, apart from `useStudySession` passing a value through.
  No component touches the DB (`coding-standards.md`).
- No em dashes in code comments, commit messages, or this spec's updates.
