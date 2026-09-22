# Feature: Stats for combined tracks

**From build-plan:** feature 72c (parent: 72. Combined grading criteria)
**Status:** verified

## Goal

Let `/stats` and the `/decks` tiles show and name any grading combination, not
just 71's three. The server already slices every stats query by any of the 11
criteria (71c + 72a) and already lists every track that has data; what is
missing is the client: `/stats` still names tracks from a fixed three-entry map
(with 72b's `describeCriterion` fallback) in a segmented control that cannot fit
many long names, and a created deck's tile shows a pass rate without saying
which track it measures.

## In scope

- `/stats`: every track label and the track note come from `describeCriterion`,
  replacing `TRACK_LABELS` / `TRACK_NOTES`. `title+song` is labelled "Anime +
  song" (the name Study and `/decks` already use since 72b) rather than "Both".
- `/stats`: the Track control becomes a labelled native `<select>`, shown only
  when more than one track exists, so any number of combinations fits the
  header.
- `/decks`: a created deck's tile names its criterion when it is not `title`
  ("Graded on Anime + OP/ED"), so its pass rate is readable.
- A pure, tested `listAvailableTracks(used)` extracted from
  `getAvailableTracks`, fixing the order and the always-present `title`.

## Out of scope

- **Server stats queries.** 71c made every query criterion-aware and 72a
  widened validation; nothing there changes.
- **An "All tracks" view** (71c decision: one clip would count several times).
- **Home**, artist and anime tiles: title-only, as 71c left them.
- **Hiding tracks with no reviews.** 71c lists a track once any deck, review or
  schedule row uses it, so a deck just switched to a combination shows it with
  empty states; that stays.
- **Pruning stale tracks** after a deck's criterion changes (71a decision).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Track list logic (server, pure)** - extract
  `listAvailableTracks(used: Iterable<string>): GradingCriterion[]` from
  `getAvailableTracks` in `server/utils/stats.ts`: `title` always first, then
  every used value that is a valid criterion, in `GRADING_CRITERIA` order,
  de-duplicated, ignoring anything invalid. `getAvailableTracks` keeps its
  three distinct-value queries and passes their union in.
  *Done when:* `bun run test` is green with `listAvailableTracks` tests
  (empty input -> `["title"]`; `title` present or not -> listed once, first;
  combinations out of order -> `GRADING_CRITERIA` order; duplicates; an
  unknown string and the retired `both` ignored); `GET
  /api/stats?type=tracks` on a database copy returns byte-identical JSON
  before and after.

- [x] **Step 2 - /stats names any track** - delete `TRACK_LABELS` /
  `TRACK_NOTES`; the label is `describeCriterion(track).chip` and the note,
  for a non-title track, is `Showing the schedule graded on
  ${describeCriterion(track).spoken}.` Replace the Track `tab-seg` with a
  `<label>`ed native `<select>` ("Track") listing the available tracks in
  their server order, bound to the same `activeTrack` / `setTrack`, styled
  from existing tokens to sit with the header's other controls.
  *Done when:* on a database copy with created decks set to `title+slot`,
  `title+song+slot+artist` and `artist` (plus the existing song/`title+song`
  history), the select lists Anime title, Song name, Artist, Anime + song,
  Anime + OP/ED, Anime + song + OP/ED + artist in that order; choosing a
  combination re-slices the page to match `?type=overall&track=<it>` and
  shows its note; the choice survives By Artist / By Title, the range
  buttons and a reload (the URL carries the encoded `+`); a library with only
  `title` shows no control and looks unchanged (screenshot); nothing in the
  header overflows at 1400px and at the 820px breakpoint (`bun run
  measure`); `bun run build` passes.

- [x] **Step 3 - Created deck tiles name their criterion** - the client
  `DeckItem` gains `criterion: GradingCriterion | null` (set only for created
  decks); a created tile whose criterion is not `title` shows a one-line
  "Graded on <chip>" under the count line, ellipsized with the full text in a
  `title` attribute. Title-graded, artist and anime tiles are unchanged.
  *Done when:* on the `/decks` Created tab, each non-title deck's tile names
  its criterion and its pass rate matches `review_log` for its cards and that
  criterion; a 4-category label does not widen or overflow a tile at 1400px
  and 820px; title-graded created tiles and the By title / By artist tabs
  look exactly as before (screenshot); switching a deck's criterion on its
  detail view and going back shows the new label; `bun run build` passes.
  As built, `setDeckCriterion` also patches the already-loaded grid entry
  with the PATCH response's criterion and pass rate, since going back to the
  grid does not refetch it; before this the tile's pass rate (71c) went stale
  the same way after a switch.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/stats.ts` (+ new or existing test) | `listAvailableTracks`. |
| `nuxt-app/app/pages/stats/index.vue` | Labels, note, Track select. |
| `nuxt-app/app/pages/decks/index.vue` | Criterion line on created tiles. |

## Data / contracts

No schema, route, or API shape change.

- `GET /api/stats?type=tracks` still returns `{ tracks: GradingCriterion[] }`,
  `title` first then `GRADING_CRITERIA` order. `listAvailableTracks` makes
  that order a tested contract.
- `/decks`' created list already returns `gradingCriterion` per deck (71b);
  the tile only reads it.
- `describeCriterion(c).chip` is the one display name for a criterion across
  Study, `/decks` and `/stats`.

## Testing

Vitest is configured (`bun run test`), so the logic gate is on.

| Step | Test |
|---|---|
| 1 | `listAvailableTracks` cases listed in the step. |
| 2, 3 | UI: browser screenshots via `playwright-cli`, `bun run measure` for overflow, `bun run build`. |

Run browser checks against a database copy (`sqlite3 .data/gaq-srs.db
".backup <scratch>/gaq-srs.db"`, then `GAQ_SRS_DATA_DIR=<scratch> bun run dev
--port <n>`), since setting deck criteria and recording reviews writes real
rows.

## Notes for the AI

- The label change from "Both" to "Anime + song" is deliberate: with 11
  possible tracks "Both" no longer says which two, and 72b already dropped the
  word from `/decks`.
- A `+` typed by hand into the address bar (`?track=title+song`) is read as a
  space by the router's query parser and falls back to the title view; links
  the page writes itself encode it as `%2B`. Accepted, not worked around.
- A native `<select>` needs no new component; keep it accessible with a real
  `<label>`, and match the header's existing control height and tokens.
- Keep the title-only case pixel-identical: no control, no note, no tile line.
- No em dashes in code comments, commit messages, or spec updates.
