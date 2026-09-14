# Feature: Multi-select + bulk delete UI on /cards

**From build-plan:** feature 61b (parent: 61. Card deletion and bulk delete)
**Status:** verified

## Goal

Let the user select many cards in `/cards`' table and delete them in one
action, behind a confirm. Today Delete exists only at the bottom of the
inspector rail, one card at a time, with no confirm (61a's Step 1 evidence).
This sub-feature is the visible half of the user's report; 61a already made
`DELETE /api/cards` accept `{ ids }` and clean up files and cached streams.

## Design reference

No new mockup. Reuse the existing `/cards` table (feature 50c) and the inline
two-step confirm already shipped on `/stats` (feature 29,
`stats/index.vue` `confirmingClear` / `.clear-confirm-*`). Tokens only from
`main.css`; no new colors.

## In scope

- A checkbox cell at the start of every table row, plus a header checkbox
  that selects or clears every **loaded** row (tri-state: indeterminate when
  some are selected).
- Shift-click on a row checkbox selects the range from the last clicked row.
- A selection action bar, shown while at least one card is selected:
  "N selected", Clear selection, Delete.
- Delete asks inline ("Delete N cards? This also removes their downloaded
  files." Confirm / Cancel) before calling the API.
- The inspector's existing single Delete gets the same two-step confirm.
- After a delete: rows leave the loaded list, the total count drops, the
  inspector closes if its card was deleted, deck memberships refresh.
- Selection resets when the search query changes.

## Out of scope

- Selecting cards that are not loaded yet, i.e. "delete all N matching this
  search" (61c).
- Delete on `/decks` detail rows (61c).
- Bulk actions other than delete (bulk deck assignment, bulk download).
- Undo or trash. The confirm is the guard.
- Keyboard shortcuts for selection.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Selection helpers** - `app/utils/cardSelection.ts`, pure:
  `selectionState(selected, loadedIds)` -> `"none" | "some" | "all"`;
  `rangeIds(orderedIds, anchorId, targetId)` (inclusive, either direction,
  falls back to `[targetId]` when the anchor is no longer loaded);
  `chunkIds(ids, size)`. *Done when:* `bun run test` passes with tests for
  each, including empty lists, a reversed range, a missing anchor, and a
  chunk size that divides evenly and one that does not.
- [x] **Step 2 - Row checkbox cell** - restructure each table row so the
  checkbox is a sibling of the existing row `<button>`, not nested in it (an
  `<input>` inside a `<button>` is invalid HTML and would also trigger the
  row's inspector click). Add the leading grid column to `.table-head` and
  `.card-row` at both the full and the 820px breakpoint. A `selectedIds`
  `Set` in the page; ticking a box selects without opening the inspector,
  clicking the rest of the row still opens it. *Done when:* `bun run measure
  /cards --size 1400x900` and `--size 800x900` show the checkbox column
  aligned with the header and no row overflowing the list pane, and a
  screenshot shows a ticked row without the inspector opening.
- [x] **Step 3 - Select all + shift range + reset** - header checkbox bound
  to `selectionState` (sets `indeterminate` for `"some"`), toggling every
  loaded row; shift-click uses `rangeIds` from the last clicked id; changing
  `searchQuery` clears the selection. Rows loaded later by infinite scroll
  arrive unselected, which moves the header back to indeterminate. *Done
  when:* in the browser, ticking one row then shift-ticking a row five below
  selects six, the header shows indeterminate, header-click selects all
  loaded, and typing a search clears it.
- [x] **Step 4 - Action bar + confirmed bulk delete** - bar above the table
  while `selectedIds.size > 0`; Delete opens the inline confirm; Confirm
  sends `DELETE /api/cards { ids }` in `chunkIds(..., BULK_DELETE_MAX)`
  batches, sequentially. Each batch's `deleted` and `notFound` ids both leave
  the list and the selection (a not-found card is already gone). If a batch
  fails, stop, keep the remaining ids selected, and show the error in the
  bar. Then update `totalCards`, clear `selectedId` if it was deleted, and
  `refreshMemberships()`. The Confirm button disables while running.
  *Done when:* against a scratch data dir, selecting 3 cards and confirming
  removes exactly those rows, the header count drops by 3, and
  `sqlite3 ... "select count(*) from card"` drops by 3; Cancel deletes
  nothing; a forced failure (server stopped mid-confirm) leaves the rows and
  shows an error.
- [x] **Step 5 - Confirm on the inspector's single Delete** - same inline
  two-step pattern, one card. *Done when:* clicking Delete in the inspector
  shows the confirm and deletes nothing until Confirm; Confirm removes the
  card as before.

## Files / areas

- `nuxt-app/app/utils/cardSelection.ts` + `cardSelection.test.ts` (new)
- `nuxt-app/app/pages/cards/index.vue` - row markup, selection state, action
  bar, inspector confirm, scoped styles

Client-only. No server change: 61a's route is the only endpoint used.

## Data / contracts

Consumes 61a's load-bearing contract unchanged:

```ts
// DELETE /api/cards  { ids: number[] }  (1..500) -> { deleted: number[]; notFound: number[] }
```

The client copy of `BULK_DELETE_MAX` (500) is duplicated by hand, per the
coding-standards Types rule; keep it next to `chunkIds`' caller with a note
pointing at `server/utils/cardDelete.ts`.

**Load-bearing for 61c:** `selectedIds` is a `Set<number>` of card ids on the
page, and the bulk delete runs through one page function
(`deleteSelected(ids)`), so 61c's delete-all-matching can reuse the same
chunked call and list update instead of a second copy.

## Testing

Vitest gate is on. Step 1 ships the logic tests (`selectionState`,
`rangeIds`, `chunkIds`). Steps 2-5 are UI and ride on `bun run measure`
geometry, screenshots, a DB row count against a scratch data dir, and
`bun run build`.

Never delete real cards while verifying: copy the DB to the scratchpad, point
`GAQ_SRS_DATA_DIR` at it, and null every local path first (61a's Step 1
procedure), because deleting a card unlinks its real media file.

## Notes for the AI

- **Build after the other session's `/cards` fix merges.** A concurrent fix
  ("Resizable inspector rail on /cards") was mid-build in `cards/index.vue`
  when this spec was written. Branch 61b from `master` only after it lands,
  and re-read the table markup and grid columns then; they may have moved.
- Match the `/stats` confirm's markup and class naming rather than inventing
  a modal.
- Checkbox hit area must not swallow the row click: stop propagation only on
  the checkbox cell, not the row.
- Use a new `Set` on every mutation (`selectedIds.value = new Set(...)`) so
  Vue reactivity sees the change.
- The 820px breakpoint currently drops Anime and Sources columns
  (`46px 1fr 92px`); the checkbox column must survive that breakpoint.
- No em dashes in comments or copy.

**Build notes:**

- 2026-09-13: the other session's `fix/resizable-cards-inspector` was
  committed but not merged when 61b resumed, so this branch was reset onto it
  and `master` (61a) merged in (`9723e05`). After that fix squash-merges,
  it merged as `6248d96` with a tree identical to this branch's base, so the
  branch was reset onto `master` with the uncommitted work kept.
- Step 2: the checkbox lives in a `.row-line` wrapper (`22px minmax(0,1fr)`)
  beside the unchanged `.card-row` button, so the table's own column string is
  untouched at both breakpoints. Measured at 1400x900 and 800x900: header and
  rows both 837px / 663px wide, inside the list pane. Clicking a checkbox gave
  `.card-row.checked` with the inspector still on its empty prompt.
- Pre-existing, not caused by 61b: between the 820px breakpoint and roughly
  1100px the Song column measures 0px wide, because the fixed columns
  (46+200+140+92px plus gaps) exceed the list pane beside a 400px inspector.
  Reproduced with the checkbox column hidden via `--css`. Out of scope here.
- Step 4: forced failure was simulated by replacing `window.fetch` for DELETE
  with a 500 response in the page, not by stopping the server; it exercises the
  same catch path. Confirm, Cancel and failure all verified against the
  scratch DB (196 -> 193 on confirm, unchanged on cancel and failure).
- Step 5: the inspector's single delete now goes through `dropDeletedCards`,
  so a card that was both ticked and open is also unticked. Verified 193 ->
  192 with the inspector returning to its empty prompt.
