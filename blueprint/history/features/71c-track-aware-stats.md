# Feature: Track-aware stats

**From build-plan:** feature 71c (of 71 - Per-deck grading criteria)
**Status:** verified

## Goal

Stop hiding song and anime+song drilling from the numbers. 71a filtered every
stats query to the anime-title track so that 71a and 71b could land without
changing what `/stats` meant; this sub-feature turns that fixed filter into a
choice. `/stats` gains a track selector (Anime title / Song name / Both) that
re-slices every section, including collection health and the forecast, by that
track, and a manual deck's pass-rate tile reports the track that deck actually
grades.

## In scope

- Every `review_log`-reading function in `server/utils/stats.ts` taking a
  `criterion` (default `title`), replacing 71a's hard-coded title filter.
- Collection health and the review forecast computed from a non-title track's
  own box/streak/due date, over that track's population of cards.
- `GET /api/stats` accepting an optional `track` query param on every `type`,
  plus a `type=tracks` answer saying which non-title tracks have anything to
  show.
- A track selector on `/stats`, shown only when a non-title track exists, kept
  in the URL as `?track=`.
- Manual deck tiles on `/decks` showing the pass rate of that deck's own
  criterion.

## Out of scope

- **Home** (`/`). Its streak, 30-day panel, heatmap, due hero and weakest decks
  stay title-only. Home is a glance at the default schedule; a selector there
  is a separate call if it is ever wanted.
- **Artist and anime deck tiles.** Derived decks always grade by title, so
  their tiles stay title-only.
- **An "All tracks" option.** Summing tracks would count one clip two or three
  times, and collection health has no single box per card across tracks. The
  selector shows one track at a time.
- **Clear history resetting `card_track`.** It deletes every `review_log` row
  (all tracks) and, as it already does for `card.box`, leaves scheduling state
  alone.
- Study, grading, or the deck criterion control - 71a/71b, unchanged.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Review-log stats take a criterion** - rename 71a's
  `titleReviews()` / `titleReviewsOfCard()` in `stats.ts` to
  `reviewsFor(criterion)` / `reviewsOfCardFor(criterion)`, both defaulting to
  `title`, and give every function that uses them an optional trailing
  `criterion` parameter: overall, streak, timeline, artist/anime breakdowns,
  weakest decks, retention, week-over-week, deck trends, heatmap, records,
  rhythm, trouble cards. Add `parseStatsTrack` in a new
  `server/utils/statsTrack.ts` (absent -> `title`, a valid criterion -> itself,
  anything else -> an error) and have `/api/stats` pass the parsed track to
  each of those types, `400` on a bad one. `decks.ts` and Home's callers keep
  the default. Collection health and the forecast are Step 2.
  *Done when:* `bun run test` is green, with `parseStatsTrack` tests (absent,
  each criterion, unknown, wrong case, `""`, an array) and a SQL-shape test
  that `reviewsFor("song")` filters on `'song'` while the default filters on
  `'title'`; with no `track` param, every `/api/stats` type returns
  byte-identical JSON to before the change (the same 18-response snapshot
  diff 71a used, on a database copy); `?type=overall&track=song` counts
  exactly the `song` rows in `review_log`; `?track=nope` returns `400`.

- [x] **Step 2 - Collection health and forecast per track** - add
  `trackPopulationCondition(criterion)` to `cardTrack.ts`: `undefined` (every
  card) for `title`; for `song`/`both`, cards that have a `card_track` row for
  it **or** belong to a manual deck whose `gradingCriterion` is it, so a deck
  switched to Song name counts its cards as never-reviewed before the first
  session. `getCollectionHealth(criterion)` and `getReviewForecast(criterion)`
  read box, streak and next-due through 71a's `trackBoxExpr` /
  `trackStreakExpr` / `trackNextReviewAtExpr` over that population, and
  `/api/stats` passes the track to both. For a non-title track the forecast's
  `dueNow` is its population's due count with no daily cap, because there is
  no "study all" session for that track for Study's own count to agree with.
  *Done when:* `bun run test` is green with SQL-shape tests for
  `trackPopulationCondition` (title adds nothing; `song` references both
  `card_track` and `deck.grading_criterion` with its own value); on a database
  copy with one deck set to `song` and a few song reviews,
  `?type=collection&track=song` totals that deck's card count, shows the
  reviewed cards in the boxes their `card_track` rows hold and the rest as
  never-reviewed box 1, and `?type=forecast&track=song` buckets by
  `card_track.next_review_at` (missing rows due today); the title responses
  are unchanged.

- [x] **Step 3 - Which tracks exist** - `/api/stats?type=tracks` returns
  `{ tracks: GradingCriterion[] }`: always `title`, then `song` and/or `both`
  when any `review_log` row, `card_track` row or manual deck uses them.
  *Done when:* on an untouched library copy it returns `["title"]`; after
  setting one deck to `both` it returns `["title","both"]` before any review
  is recorded; after setting that deck back to `title` with `both` reviews
  already logged, `both` is still listed.

- [x] **Step 4 - The selector on /stats** - a "Track" `tab-seg` in the stats
  header, rendered only when `tracks` has more than `title`, listing Anime
  title / Song name / Both for whichever exist. The choice lives in
  `?track=` (read on mount and on same-route navigation, like `?type=`); every
  `useFetch` on the page includes it in its `query`, so switching re-fetches
  every section. `setType` keeps the other params instead of replacing the
  query. An unknown or unavailable `?track=` falls back to title. A short line
  under the header names the track whenever it is not title ("Showing the
  song-name schedule"). Refresh keeps working; Clear history's confirm copy
  says it clears every track, and the button is disabled only when the title
  track is the only one and it has no reviews (it used to key off the visible
  total, which on an empty track would have hidden history on the others).
  *Done when:* on an untouched library copy the page shows no selector and
  looks unchanged (before/after screenshots); with a song deck and song
  reviews, the selector appears and Song name re-slices overall, the
  timeline, breakdowns, collection health, forecast, retention, trends,
  heatmap, records, rhythm and trouble cards to match the `?track=song` API
  responses; a track with a configured deck but no reviews shows each
  section's existing empty state, not an error; a trouble card still opens
  Preview; switching By Artist / By Title or the 30d/90d/All range keeps
  `?track=song`, and so does a reload; `?track=nope` shows the title view;
  `bun run build` passes.

- [x] **Step 5 - Manual deck tiles grade their own track** -
  `passRatesByManualDeck` joins reviews on the deck's own
  `gradingCriterion` instead of title, so each created deck's tile reports the
  track it grades. Artist and anime tiles are unchanged.
  *Done when:* on a database copy, a created deck set to `song` with song
  reviews shows the song pass rate on `/decks` (matching `review_log` for its
  cards and criterion), a title-graded created deck and every artist/anime
  tile show exactly what they showed before, and `PATCH /api/decks` returns
  the new criterion's pass rate after a switch; `bun run build` passes.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/stats.ts` | `reviewsFor`/`reviewsOfCardFor`; a `criterion` on every stats function; track-aware collection health and forecast. |
| `nuxt-app/server/utils/statsTrack.ts` + `.test.ts` | New. `parseStatsTrack`. |
| `nuxt-app/server/utils/cardTrack.ts` + `.test.ts` | `trackPopulationCondition`. |
| `nuxt-app/server/api/stats.get.ts` | `track` param on every type; `type=tracks`. |
| `nuxt-app/server/utils/decks.ts` | Manual deck pass rates by the deck's own criterion; import rename. |
| `nuxt-app/app/pages/stats/index.vue` | The selector, `?track=`, query-preserving navigation. |

## Data / contracts

No schema change.

**Load-bearing:**

- `GET /api/stats` accepts `track` (`"title" | "song" | "both"`, default
  `"title"`) on every `type`. Response shapes are unchanged; only which reviews
  and which track state feed them.
- `GET /api/stats?type=tracks` -> `{ tracks: GradingCriterion[] }`, `title`
  always first.
- `/stats?track=<criterion>` is the page's second query param alongside
  `type`; navigation on the page preserves it.
- A track's **population** (Step 2) is defined once, in `cardTrack.ts`, and is
  what collection health and the forecast count. `title` is every card.
- A manual deck's `passRate` means "pass rate of this deck's grading
  criterion". Artist/anime `passRate` means title.

## Testing

Vitest is configured (`bun run test`), so the logic-test gate is on.

| Step | Test |
|---|---|
| 1 | `parseStatsTrack` cases; `reviewsFor` SQL shape per criterion. |
| 2 | `trackPopulationCondition` SQL shape per criterion. |

Steps 3-5 ride on API output and browser evidence (the `playwright-cli`
skill) plus `bun run build`. The existing pure `shape*` stats tests must stay
green untouched, since this feature changes their inputs, not their logic.

Every check that records reviews runs against a database copy
(`sqlite3 .data/gaq-srs.db ".backup <scratch>/gaq-srs.db"` then
`GAQ_SRS_DATA_DIR=<scratch> bun run dev --port <n>`).

## Notes for the AI

- **No `track` means today's numbers.** Every default is `title`, and Step 1's
  snapshot diff is the proof.
- Reuse 71a's `trackBoxExpr` / `trackStreakExpr` / `trackNextReviewAtExpr`
  and `trackDueCondition`; do not write a second way to read track state.
- `parseStatsTrack` wraps `parseGradingCriterion`; do not duplicate the value
  list.
- Keep `/stats`'s `useFetch` pattern (explicit loading/error per section);
  make `track` part of each `query` computed rather than refetching by hand.
- Home and artist/anime decks must not change. If a helper they call gains a
  parameter, they keep the default.
- No em dashes in code comments, commit messages, or spec updates.
