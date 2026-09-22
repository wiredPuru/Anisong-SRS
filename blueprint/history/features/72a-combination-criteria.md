# Feature: Combination criteria in the data and server

**From build-plan:** feature 72a (parent: 72. Combined grading criteria)
**Status:** verified

## Goal

Let a grading criterion be any valid combination of four categories (`title`,
`song`, `slot`, `artist`) rather than one of three fixed values, and rename
the stored `both` to `title+song`. This is the groundwork for 72b (the deck
control and Study grading for OP/ED number and artist) and 72c (stats). The
app looks and behaves exactly as it does today once this lands.

## In scope

- A canonical criterion encoding in `server/utils/gradingCriterion.ts`:
  categories joined by `+` in the fixed order `title`, `song`, `slot`,
  `artist`. The 11 valid combinations become the `GRADING_CRITERIA` list, and
  `slot` is only valid with `title`.
- Pure helpers: `criterionCategories(criterion)` (split into its categories)
  and `buildCriterion(categories)` (canonical string, or `null` when empty or
  `slot` without `title`). 72b's `/decks` control builds criteria through the
  client copy of `buildCriterion`.
- Strict parsing: `parseGradingCriterion` accepts only canonical strings.
  `title+song` is accepted; `song+title`, `slot`, `slot+song` and `both`
  (once step 2 lands) are rejected.
- The three validation error messages (deck PATCH, review POST, stats
  `track`) stop listing the old three values.
- A Drizzle migration renaming stored `both` to `title+song` in
  `deck.grading_criterion`, `card_track.criterion` and `review_log.criterion`.
- The client's three-option lists and its `GradingCriterion` type follow the
  rename (`both` becomes `title+song`), keeping the same labels and copy, so
  an existing Both deck still reads "Both" on `/decks`, still prompts "Anime +
  song" on Study, and still appears as "Both" on `/stats` with its history.

## Out of scope

- Any UI for choosing `slot` or `artist`: that's 72b's `/decks` checkboxes.
- Study grading on OP/ED number or artist, and the artist answer box (72b).
- Stats labels for new combinations (72c).
- Accepting non-canonical orderings (`song+title`). The client always builds
  canonical strings, so the server stays strict.
- Adding artist to feature 66's bonus category menu (not planned).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Canonical combination criteria (server, additive)** - rewrite
  `server/utils/gradingCriterion.ts` around `GRADING_CATEGORIES`, the 11
  canonical `GRADING_CRITERIA`, `criterionCategories` and `buildCriterion`.
  Keep `both` accepted in this step only, so rows already stored as `both`
  keep working until step 2 migrates them. Update the error strings in
  `deckPatch.ts`, `studyReview.ts` and `statsTrack.ts`. Extend
  `gradingCriterion.test.ts` and the three validator tests, and add one
  combination (`title+slot+artist`) to the non-title parametrized cases in
  `cardTrack.test.ts` and `statsTrack.test.ts`. *Done when:* `bun run test`
  passes; with the dev server running, `PATCH /api/decks` on a manual deck
  with `gradingCriterion: "title+slot+artist"` returns 200 and `"slot"`,
  `"slot+song"` and `"song+title"` each return 400; `GET
  /api/study/next` scoped to that deck returns a card with `criterion:
  "title+slot+artist"`, and `POST /api/study/review` with that criterion
  writes a `card_track` row and a `review_log` row carrying it (set the deck
  back to `title` afterwards).
- [x] **Step 2 - Rename `both` to `title+song`** - generate a custom migration
  (`bun run db:generate --custom`, then fill it) with one `UPDATE ... SET
  ... = 'title+song' WHERE ... = 'both'` per table. Drop `both` from
  `GRADING_CRITERIA`. On the client, rename the `both` value and keys in
  `app/utils/criterionGrading.ts` (type and `requiredCategories` still work
  unchanged), `/decks`' `CRITERION_OPTIONS`, Study's `CRITERION_COPY`, and
  `/stats`' `TRACK_LABELS`/`TRACK_NOTES`. Update tests that use `both` as a
  criterion (not the unrelated Clip source `both`). *Done when:* `bun run
  test` and `bun run build` pass; after booting the dev server against a
  database with a Both deck (make one first if none exists), `select
  distinct` on the three columns shows no `both`; that deck shows "Both"
  selected on `/decks`, Study scoped to it shows the "Anime + song" prompt
  and reviews submit, `/stats` still offers the Both track with its earlier
  review counts, and `POST /api/study/review` with `criterion: "both"`
  returns 400.

## Files / areas

- `nuxt-app/server/utils/gradingCriterion.ts` (+ test)
- `nuxt-app/server/utils/deckPatch.ts`, `studyReview.ts`, `statsTrack.ts`
  (+ tests)
- `nuxt-app/server/utils/cardTrack.test.ts`, `cards.test.ts` (criterion
  parametrizations)
- `nuxt-app/server/db/migrations/0019_*.sql` + `meta/` (generated)
- `nuxt-app/app/utils/criterionGrading.ts` (+ test)
- `nuxt-app/app/pages/decks/index.vue`, `app/pages/study/index.vue`,
  `app/pages/stats/index.vue` (rename only)

## Data / contracts

**Load-bearing for 72b and 72c:**

```ts
// server/utils/gradingCriterion.ts
export const GRADING_CATEGORIES = ["title", "song", "slot", "artist"] as const;
export type GradingCategory = (typeof GRADING_CATEGORIES)[number];

export const GRADING_CRITERIA = [
  "title", "song", "artist",
  "title+song", "title+slot", "title+artist", "song+artist",
  "title+song+slot", "title+song+artist", "title+slot+artist",
  "title+song+slot+artist",
] as const;
export type GradingCriterion = (typeof GRADING_CRITERIA)[number];

export function criterionCategories(criterion: GradingCriterion): GradingCategory[];
export function buildCriterion(categories: Iterable<GradingCategory>): GradingCriterion | null;
```

- The list is spelled out rather than generated so the type is an exact
  union, and its order is the order `/stats` offers tracks in
  (`getAvailableTracks` filters it).
- `isTitleCriterion` is unchanged: `title` alone is the `Card` row's track;
  every other value, `title+song` included, lives in `card_track`.
- No schema shape changes. The three columns stay `text`; only the values
  change. `card_track.criterion` is still typed `Exclude<GradingCriterion,
  "title">`.
- API shapes are unchanged apart from the accepted values of
  `gradingCriterion` (PATCH `/api/decks`), `criterion` (POST
  `/api/study/review`, and the `/api/study/next` response) and `track` (GET
  `/api/stats`).

## Testing

Vitest is configured, so the logic gate is on.

- `gradingCriterion.test.ts`: every canonical value parses; non-canonical
  order, unknown category, empty string, `slot` without `title`, and
  (after step 2) `both` are rejected; `buildCriterion` round-trips with
  `criterionCategories` for all 11 values, orders any input canonically,
  de-duplicates, and returns `null` for empty or slot-without-title input.
- Validator tests (`deckPatch`, `studyReview`, `statsTrack`): accept a
  multi-category criterion, reject an invalid one.
- `cardTrack` / `statsTrack` track tests: a multi-category criterion behaves
  like `song` did (reads from `card_track`, filters the log).
- The migration itself is checked by the step 2 done-when against the real
  dev database, not a unit test.

## Notes for the AI

- **Back up the dev database before step 2's first boot:** copy
  `nuxt-app/.data/gaq-srs.db` to the scratchpad. Migrations run
  automatically on server boot and this one rewrites existing rows.
- A `card_track` rename can't hit the `(card_id, criterion)` unique index in
  practice: nothing could write `title+song` before step 1, and step 1 is
  only exercised with `title+slot+artist`. Don't write `title+song` rows by
  hand between the two steps.
- Between this sub-feature and 72b, a deck set by direct API call to a new
  combination (`title+artist`, say) has no Study copy or `/stats` label on
  the client. That's reachable only through the API, and 72b and 72c close
  it. Don't add fallback UI here.
- Server and client each keep a hand-written copy of the criterion type
  (accepted duplication, F-09). In this sub-feature the client copy only
  swaps `both` for `title+song`; 72b widens it to the full list.
- `both` also appears as a Clip source value (`clipSource`, feature 64).
  Leave those untouched.
- No em dashes in code comments or docs.
