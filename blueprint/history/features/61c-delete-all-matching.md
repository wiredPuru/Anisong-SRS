# Feature: Delete-all-matching + deck-detail parity

**From build-plan:** feature 61c (parent: 61. Card deletion and bulk delete)
**Status:** verified

## Goal

Finish feature 61. On `/cards`, delete every card matching the active search
in one confirmed action, including cards infinite scroll has not loaded yet.
On `/decks` detail rows (artist, anime, and created decks), add a confirmed
per-row Delete so a card can be removed from the library without going back
to `/cards`.

## Design reference

No new mockup. Reuse 61b's selection bar and inline two-step confirm
(`cards/index.vue` `.selection-bar` / `confirm-btn`), and the `/decks` detail
row's existing button styling (`.remove-btn`). Tokens only from `main.css`.

## In scope

- `GET /api/cards/ids?q=` returning every card id matching
  `cardSearchCondition(q)`, newest first.
- A "Delete all N matching" action on `/cards`, offered **only while a search
  is active** and `totalCards > 0`, with an inline confirm naming the count and
  the search text. Confirm fetches the ids, then runs them through 61b's
  existing `deleteSelected(ids)` (chunked, sequential, partial-failure safe).
- A per-row Delete on `/decks` detail card rows for all three deck types, with
  a one-row inline confirm ("Delete card? Also removes its downloaded files."
  Confirm / Cancel). On a created deck it sits beside the existing Remove, and
  the confirm copy makes clear Delete removes the card everywhere, Remove only
  from this deck.
- After a deck-row delete: the row leaves `deckCards`, the deck detail's count
  drops, and the preview modal closes if it showed that card.

## Out of scope

- Delete-all with an empty search (i.e. "delete my whole library"). Too easy
  to hit by accident; the header select-all over loaded rows (61b) remains the
  path for large unfiltered deletes.
- Multi-select or bulk delete on `/decks` detail rows.
- Deleting a whole derived artist/anime deck's cards in one action.
- Pruning orphaned `Song`/`Artist`/`Anime` rows (kept by feature 61's decision).
- Undo or trash.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Matching-ids endpoint** - `listCardIds(query)` in
  `server/utils/cards.ts` (same joins and `cardSearchCondition` as
  `listCards`, ids only, `desc(createdAt)`, no paging), and
  `server/api/cards/ids.get.ts`, which returns `400` when `q` is missing or
  blank after trimming. *Done when:* `bun run test` passes with tests for
  `listCardIds` (matches by song, artist, and anime title; no match returns
  `[]`; blank query is rejected by the route's parser), and `curl
  'localhost:3000/api/cards/ids?q=<term>'` returns the same count as
  `/api/cards?q=<term>`'s `total`, while `?q=` returns `400`.
- [x] **Step 2 - Delete all matching on /cards** - a "Delete all N matching"
  button near the search results header, shown when `searchQuery` is
  non-empty and `totalCards > 0`, disabled while `bulkDeleting`. Inline
  confirm: `Delete all N cards matching "q"? This also removes their
  downloaded files.` Confirm fetches `/api/cards/ids`, then calls
  `deleteSelected(ids)`. If the ids fetch fails, show the error in the
  existing `bulkDeleteError` slot and delete nothing. Changing the search
  cancels a pending confirm. *Done when:* against a scratch data dir, a search
  matching more than one page (more than `PAGE_SIZE` cards) deletes every
  match, including unloaded ones, and the `sqlite3` card count drops by
  exactly the displayed N; Cancel deletes nothing; with an empty search the
  button is absent.
- [x] **Step 3 - Delete on /decks detail rows** - per-row Delete button with a
  `confirmingDeleteCardId` inline confirm (one row at a time), calling
  `DELETE /api/cards { id }`. On success drop the row from `deckCards`,
  decrement the detail count, clear `previewCard` if it matches, and on the
  Created tab keep the deck grid's card count in step. Errors show in the row
  area like `removeCardError`. *Done when:* on an artist, an anime, and a
  created deck (scratch data dir), Delete then Confirm removes the row and the
  DB count drops by 1; Cancel deletes nothing; the card no longer appears on
  `/cards`; a created deck still shows Remove and removing still keeps the
  card in the library.

## Files / areas

- `nuxt-app/server/utils/cards.ts` (+ `cards.test.ts`) - `listCardIds`
- `nuxt-app/server/api/cards/ids.get.ts` (new)
- `nuxt-app/app/pages/cards/index.vue` - delete-all-matching button + confirm
- `nuxt-app/app/pages/decks/index.vue` - row Delete + confirm

## Data / contracts

```ts
// GET /api/cards/ids?q=<non-empty>  -> { ids: number[] }   (400 when q is blank)
```

Consumes 61a's `DELETE /api/cards` (`{ id }` and `{ ids }` forms) unchanged,
and 61b's `deleteSelected(ids)` unchanged. No schema change.

## Testing

Vitest gate is on. Step 1 ships tests for `listCardIds` and the blank-query
check. Steps 2-3 are UI and ride on a scratch-DB row count, screenshots, and
`bun run build`.

Never delete real cards while verifying: copy the DB to the scratchpad, point
`GAQ_SRS_DATA_DIR` at it, and null every local path first (61a's procedure),
because deleting a card unlinks its real media file.

## Notes for the AI

- The displayed N comes from `totalCards`; the ids fetch happens at Confirm
  time, so if the library changed in between the delete follows the ids, and
  `deleteSelected` already reconciles the list from the server's response.
- `deleteSelected` drops only loaded rows from `cards`; after a
  delete-all-matching, the search has no matches left, so reload the list
  (or set `totalCards` from the result) rather than leaving a stale count.
- Keep the blank-query rejection server-side too, not just by hiding the
  button.
- Match existing confirm markup; no modal. No em dashes in copy or comments.

**Build notes:**

- Step 1: `listCardIds` runs a real SQLite query and the existing
  `cards.test.ts` stays pure (it has no DB fixture), so the blank-query check
  was pulled out as `parseMatchingQuery` in `cardDelete.ts` and unit tested
  there. `listCardIds` itself was checked against the running server instead:
  `?q=a` 203 ids vs `total` 203, `?q=lisa` 1 vs 1, and blank, whitespace-only,
  and missing `q` all return 400.
- Step 2: the match bar reuses `.selection-bar` and hides while any row is
  ticked, so the two bars never stack. Verified in headless Chrome against
  a built server on port 3100 with `GAQ_SRS_DATA_DIR` pointed at a scratch
  copy (local paths nulled): `?q=ra` showed "67 matching" with 25 rows loaded;
  Cancel left the DB at 204; Confirm took it to 137 (exactly 67, including the
  42 unloaded) and the list reloaded to "0 total"; `/cards` with no search
  shows no bar. The real `.data` DB stayed at 204.
- Step 3: the deck detail view shows no card count of its own, so the only
  count to keep in step is the grid tile's `cardCount`, decremented in place
  for the selected deck (other tabs refetch on switch). Verified the same way
  as Step 2: artist deck 13 Cancel kept 137, Confirm 137 -> 136; anime deck 23
  Confirm 135 -> 134; created deck 72 showed Remove beside Delete, Remove took
  its `deck_card` rows 2 -> 1 with the card count unchanged, then Delete with
  the "from your library, not just this deck" copy took cards 136 -> 135 and
  the deck to 0. `/api/cards/ids?q=a` reports 133 afterwards, so deleted cards
  are gone from `/cards`. The grid tile decrement was not observed in the
  browser. The real `.data` DB stayed at 204.
- Post-build fix (reported in review): selecting every loaded row with no
  search and deleting emptied the list, which hid the infinite-scroll
  sentinel and showed "No cards yet" while unloaded cards remained; deleted
  rows also shifted later pages' offsets. `deleteSelected` now reloads the
  first page whenever `totalCards` exceeds the loaded rows, replacing
  `deleteAllMatching`'s own reload. Verified on the scratch copy: header
  select-all on 25 of 134, Confirm -> DB 109, list refilled with 25 rows
  showing "109 total".
