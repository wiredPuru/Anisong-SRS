# Feature: Leeches and trouble cards

**From build-plan:** feature 68d
**Status:** verified

## Goal

Answer the one question the rest of `/stats` cannot: **which specific cards are
costing me the most?** Every other panel is an aggregate (per box, per deck,
per hour). This adds a "Trouble cards" panel listing the individual cards that
keep failing, and lets you open any of them in the existing `CardPreviewModal`
(play it, read its info, edit its notes) without leaving `/stats`.

Every number comes from rows already written: `ReviewLog.result` and its
order. No schema change, no new logging, nothing about what Study records
changes.

## Design reference

None to capture. The panel reuses the existing `.chart-panel`, `.tab-seg`
toggle, `.state`, and row styling already on `/stats` (the breakdown rows from
50e/68b), in the shipped cute/moe tokens. `CardPreviewModal` is reused as-is,
wired the same way `/decks` wires it.

## In scope

- A **Trouble cards** panel on `/stats`, below "When you study" and above
  "Breakdown", with a three-way `tab-seg` toggle over three lists of up to 10
  cards each:
  - **Most failed** - cards ranked by total fail count.
  - **On a fail streak** - cards whose most recent reviews are consecutive
    fails, ranked by streak length.
  - **Never passed** - cards reviewed at least twice with zero passes.
- Each row: cover thumbnail, song title, artist, anime, theme slot, and the
  list's own figure (fail count, current fail streak, or review count) plus
  "N reviews" context. Clicking a row opens that card in `CardPreviewModal`.
- One new read-only `/api/stats` type, `trouble`, returning all three lists
  with each card embedded as a `CardWithDetails`, so opening Preview needs no
  second fetch.
- The modal's `updated` event patches the card in every list in place (notes,
  local paths), matching how `/decks` handles it.
- The fetch joins `refreshStats()`'s `Promise.all`, so Refresh and Clear
  history update the panel.

## Out of scope

- Any schema change, migration, or new logging.
- A "suspend", "reset box", or "delete" action on a trouble card. The panel
  surfaces and opens cards; acting beyond what Preview already offers is a
  later feature.
- Pagination, search, or a "show more" past 10 per list.
- Configurable thresholds in the UI. They are constants in `stats.ts`.
- Deck-scoped versions.
- Any change to `CardPreviewModal` itself.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - trouble query + pure shaping** - add `getTroubleCards()` to
  `server/utils/stats.ts`, delegating to the pure `shapeTroubleCards()`, plus a
  pure `failStreakFromResults()`. One query reads every review row
  (`cardId`, `result`, `reviewedAt`, `id`) ordered newest first; the shaper
  folds it per card into `totalReviews`, `failCount`, `passCount`,
  `currentFailStreak` (consecutive fails from the newest review, stopping at
  the first pass) and `lastReviewedAt`, then builds the three lists. A second
  query loads the `CardWithDetails` for just the ids that made a list, via a
  new `getCardsByIds(ids)` in `server/utils/cards.ts` (same `cardQuery()` +
  `inArray`, like `getCardsBySongIds`). Wire `type=trouble` into
  `server/api/stats.get.ts` and extend its 400 message. Constants:
  `TROUBLE_LIMIT = 10`, `TROUBLE_MIN_FAILS = 2` (Most failed and On a fail
  streak), `TROUBLE_MIN_REVIEWS = 2` (Never passed). Ordering: Most failed by
  `failCount` desc; On a fail streak by streak desc; Never passed by
  `totalReviews` desc; every tie broken by most recent review, then card id,
  so output is deterministic. Tests (Vitest, pure helpers only): empty log
  gives three empty lists; `failStreakFromResults` over `[]`, all fails,
  fail-fail-pass, pass-fail (streak 0), a single fail; a card under each
  threshold excluded and exactly at it included; Never passed excludes a card
  with one pass and one with a single review; a card can appear in more than
  one list; limit of 10 enforced; ties resolved by recency then id; a review
  row whose card no longer exists is dropped rather than crashing.
  *Done when:* `bun run test` passes, and `curl 'localhost:3000/api/stats?type=trouble'`
  returns three lists whose fail counts and streaks match the `sqlite3` checks
  under Testing.

- [x] **Step 2 - Trouble cards panel (list only)** - a `.chart-panel` titled
  "Trouble cards" with the `tab-seg` toggle and one row list, using client
  copies of the types (same field order). Pieces: `useFetch` with
  `pending`/`error` states scoped to this panel, `refresh()` in
  `refreshStats()`, an empty state per list ("No cards failing repeatedly
  yet." style copy that says why, never a blank panel), and singular/plural
  correctness ("1 fail" not "1 fails"). Rows are `<button>`s (keyboard
  reachable) but do nothing yet. Collapse to a single column under the
  existing 820px `@media`.
  *Done when:* the panel shows the same cards and figures as step 1's curl in
  all three tabs, an errored fetch shows a message in that panel only, a fresh
  library shows the empty state with no `NaN` or blank rows, Refresh updates
  it, and it is legible at under 820px.

- [x] **Step 3 - open a trouble card in Preview** - mount one
  `<CardPreviewModal>` on `/stats`, fed by a `previewCard` ref, with a
  `useFetch("/api/media-library")` supplying `has-default-download-folder`,
  `audio-only`, `auto-download` and `clip-source` exactly as `/decks` derives
  them. Row click sets `previewCard`; `@close` clears it; `@updated` replaces
  the card in every list in place and updates `previewCard`.
  *Done when:* clicking a row opens Preview for that card with playback and
  info, closing returns to `/stats` with the scroll position and tab
  unchanged, editing notes in Preview shows the saved value on reopening
  without a refetch, and the media-library fetch failing does not break the
  panel (Preview just falls back to the modal's defaults).

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/stats.ts` | trouble query, pure shaper, `failStreakFromResults`, constants |
| `nuxt-app/server/utils/stats.test.ts` | tests for the new pure helpers |
| `nuxt-app/server/utils/cards.ts` | new `getCardsByIds(ids)` |
| `nuxt-app/server/api/stats.get.ts` | `type=trouble` branch and updated 400 message |
| `nuxt-app/app/pages/stats/index.vue` | panel, type copies, media-library fetch, modal, refresh wiring, styles |

Not touched: the schema, `CardPreviewModal.vue`, Home, Study.

## Data / contracts

Declared server-side in `server/utils/stats.ts`, copied by hand into
`app/pages/stats/index.vue` in the same field order (F-09).
`CardWithDetails` is already declared on both sides.

```ts
export const TROUBLE_LIMIT = 10;
export const TROUBLE_MIN_FAILS = 2;    // Most failed, On a fail streak
export const TROUBLE_MIN_REVIEWS = 2;  // Never passed

interface TroubleCardEntry {
  card: CardWithDetails;
  totalReviews: number;
  failCount: number;
  currentFailStreak: number;   // consecutive fails from the newest review; 0 if the newest was a pass
  lastReviewedAt: string;      // ISO timestamp (Date server-side, string on the wire)
}

interface TroubleCards {
  mostFailed: TroubleCardEntry[];
  onFailStreak: TroubleCardEntry[];
  neverPassed: TroubleCardEntry[];
}
```

Load-bearing: none for later features. Note `Card.streak` is the box-1
pass-streak counter and is unrelated to `currentFailStreak`; the latter is
derived from `ReviewLog` and never stored.

## Testing

`bun run test` (Vitest) is configured, so the logic gate is on.

- **Step 1 is logic-bearing and ships tests** for the pure helpers only,
  following 68a-68c: the DB-touching function stays thin, the shaping it
  delegates to is pure and covered. Edge cases are listed in the step.
- **Steps 2 and 3 are UI** and ride on browser evidence (`playwright-cli` or
  `bun run measure --shot`) plus a clean `bun run build`: the panel populated,
  empty and erroring, in all three tabs, at about 1440px and under 820px, and
  the Preview open/close/edit path.
- **Cross-check against SQL**, not against the code under test (read-only, on
  the real database):

  ```sql
  -- fail counts (Most failed)
  select card_id, count(*) reviews, sum(result='fail') fails from review_log
    group by card_id having fails >= 2 order by fails desc limit 10;
  -- never passed
  select card_id, count(*) reviews from review_log
    group by card_id having sum(result='pass') = 0 and reviews >= 2 order by reviews desc limit 10;
  -- current fail streak for one card (newest first; count leading fails)
  select result from review_log where card_id = :id order by reviewed_at desc, id desc;
  ```
- **Empty-state evidence must not use "Clear history" on the real database.**
  Start a second dev server with `GAQ_SRS_DATA_DIR` pointing at a scratch
  directory, on another port. Error-state evidence: abort the `type=trouble`
  request in the browser.
- Manual path: `/stats` on the real library; switch the three tabs, open a
  row, play it, edit its notes, close, and confirm the row still matches.

## Notes for the AI

- All queries are **server-side**; the page calls `/api/stats` and never
  touches Drizzle. No new route file: extend the `?type=` switch.
- Sort newest-first by `reviewedAt` **then `id`**: several reviews can share
  the same second, and `id` is the true order. The fail streak depends on it.
- Never average or re-derive rates; this panel shows counts only.
- Embed the card in each entry so the page never needs a second request to
  open Preview. Cards deleted since (cascade removes their `ReviewLog` rows,
  but be defensive) are dropped, not rendered blank.
- Follow `/decks`' exact wiring of `CardPreviewModal` (props from
  `/api/media-library`, `onPreviewCardUpdated` patching in place). Do not
  modify the modal.
- Rows are real `<button>`s; the existing `.row-clickable` convention applies
  only where a row's sole control is one button, which is the case here.
- Reuse `.chart-panel`, `.tab-seg`, `.state`, and the breakdown row styling.
  Every colour and radius is a `var(--token)`; no literals, no static inline
  styles. Cover thumbnails use `--radius-xs` and are absent, not broken, when
  an anime has no cover (feature 12's convention).
- A brand-new library (no reviews) is a real first-run state: no `NaN`, no
  empty panel body without an explanation.
- No em dashes in code comments or copy, per `coding-standards.md`. Comment
  only the non-obvious: the `id` tie-break, and why the fail streak is not
  `Card.streak`.
