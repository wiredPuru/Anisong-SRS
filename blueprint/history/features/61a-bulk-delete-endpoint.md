# Feature: Stream-cache cleanup + bulk delete endpoint

**From build-plan:** feature 61a (parent: 61. Card deletion and bulk delete)
**Status:** verified

## Goal

Make the server side of card deletion complete and batchable, so 61b's
multi-select UI and 61c's delete-all-matching have one correct path to call.
Deleting a card today removes its row, its `ReviewLog`/`DeckCard` rows
(cascade) and its unreferenced local files (feature 17), but leaves its
feature-41 stream-cache files on disk. This sub-feature closes that gap and
lets one request delete many cards.

## In scope

- Reproduce single delete against the running app first, to confirm the
  reported "can't delete" is discoverability (Delete lives only in the
  `/cards` inspector since 50c) and not a server or client failure. Repair it
  in this sub-feature if it is a real failure.
- Replace `deleteCard(id)` with `deleteCards(ids)`: all card rows removed in
  one transaction, then file cleanup run once against the post-delete state.
- Remove each deleted card's cached stream files (`animethemesVideoUrl`,
  `animethemesAudioUrl`) unless a remaining card still references that URL.
- `DELETE /api/cards` accepts `{ ids: number[] }` as well as today's
  `{ id: number }`.
- Unit tests for the pure decision logic.

## Out of scope

- Any UI change: checkboxes, select-all, confirm dialogs (61b).
- Delete-all-matching-a-search and a Delete action on `/decks` detail (61c).
- Pruning orphaned `Song`/`Artist`/`Anime` rows. **Decided 2026-09-13: they
  are kept** as a local metadata cache so re-adding an anime skips a fresh
  provider lookup. Do not add pruning.
- An undo / trash. Deletion stays permanent; 61b's confirm is the guard.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Reproduce single delete** - with `bun run dev` running,
  select a disposable card on `/cards`, press the inspector's Delete, and
  separately call `DELETE /api/cards` with `{ id }`. No code change unless it
  fails. *Done when:* evidence is recorded in Notes below: the card is gone
  from the list after reload, its `review_log` and `deck_card` rows are gone,
  and its local file (if any) is gone. If any of those fail, the root cause
  and a fix are added as a Step 1b before continuing.
- [x] **Step 2 - `deleteCards(ids)` with transactional row delete** - in
  `server/utils/cards.ts`, a pure helper `pathsToRemove(candidates,
  stillReferenced)` (dedupes, drops nulls, drops anything still referenced)
  plus `deleteCards(ids)` that dedupes ids, reads the existing rows, deletes
  them in one `db.transaction`, then removes local files whose paths no
  remaining card references. `deleteCard(id)` becomes a one-line wrapper so
  the existing route keeps working unchanged. *Done when:* `bun run test`
  passes with new `pathsToRemove` tests, and single delete still behaves as in
  Step 1.
- [x] **Step 3 - Stream-cache cleanup** - in `server/utils/streamCache.ts`,
  `removeCachedStream(url)` that unlinks the cached file for an allowed URL if
  present (best-effort, errors swallowed, same as local cleanup; never follows
  a non-allowlisted URL). `deleteCards` calls it for each deleted card's
  remote URL that no remaining card references, reusing `pathsToRemove`.
  *Done when:* a test covers `removeCachedStream` on a present file, a missing
  file, and a non-allowlisted URL (filesystem mocked with `vi.mock`), and in
  the running app a played-then-deleted card's `.data/stream-cache/` entry is
  gone while a second card sharing that URL keeps it.
- [x] **Step 4 - Bulk route** - `server/api/cards.delete.ts` accepts `{ ids }`
  (validated by a pure `parseDeleteBody` helper: non-empty array of positive
  integers, at most `BULK_DELETE_MAX` = 500, else 400) alongside `{ id }`.
  *Done when:* `parseDeleteBody` tests pass (valid id, valid ids, empty,
  non-integer, over cap, both keys missing), and a manual `DELETE /api/cards`
  with three ids, one of them nonexistent, returns `{ deleted: [a, b],
  notFound: [c] }` with 200. `bun run build` succeeds.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `deleteCards`, `pathsToRemove`,
  `deleteCard` wrapper
- `nuxt-app/server/utils/streamCache.ts` - `removeCachedStream`
- `nuxt-app/server/api/cards.delete.ts` - `{ ids }` support
- `nuxt-app/server/utils/cardDelete.ts` + `.test.ts` - `parseDeleteBody` and
  `BULK_DELETE_MAX`, in their own file because a Nitro route file can't be
  imported by Vitest (it relies on auto-imported `defineEventHandler`)
- `nuxt-app/server/utils/cards.test.ts`, `streamCache.test.ts` - new tests

## Data / contracts

No schema change.

**Load-bearing (61b and 61c call this):**

```ts
// DELETE /api/cards
type DeleteCardsBody = { id: number } | { ids: number[] }; // ids: 1..500
// { id } keeps today's response: { success: true }, or 404 if not found
// { ids } response, always 200 when the body is valid:
interface DeleteCardsResult {
  deleted: number[];  // ids actually removed
  notFound: number[]; // ids that did not exist (already deleted is not an error)
}
```

The 500 cap is per request. 61c's delete-all-matching must chunk, or add its
own query-scoped route; it must not raise the cap.

## Testing

Vitest gate is on. In-scope logic, each shipping with its step:

- `pathsToRemove` - duplicates collapse, nulls dropped, a path referenced by a
  remaining card is kept, empty input returns empty.
- `removeCachedStream` - present, missing, non-allowlisted URL.
- `parseDeleteBody` - the six cases in Step 4.

Integration (DB transaction, real file unlink, route) rides on the running-app
evidence in Steps 1, 3, and 4, plus `bun run build`.

## Notes for the AI

- File cleanup must run **after** the transaction commits and query
  references against the post-delete state. Two cards being bulk-deleted
  together that share one local file must remove it; a per-card loop checking
  references before the sibling is gone would wrongly keep it.
- Cleanup stays best-effort, exactly like `deleteFileIfUnreferenced`: a
  missing file, a permission error, or Windows `EBUSY` on a clip mid-stream
  never fails the delete. The rows are already gone.
- A stream-cache fetch in flight for a deleted URL may still land after
  cleanup. Acceptable: the cache is quota-bounded and evicts it eventually.
  Don't add cancellation.
- `ReviewLog` and `DeckCard` already cascade (`PRAGMA foreign_keys = ON` in
  `server/db/client.ts`). Don't hand-delete them.
- Existing tests in `cards.test.ts` are pure with no DB; keep new tests the
  same shape rather than introducing a DB fixture.
- No em dashes in code comments or docs.

**Step 1 evidence (2026-09-13):** single delete is not broken. Run against a
backup copy of the real DB (`GAQ_SRS_DATA_DIR` in the scratchpad, every real
local path nulled first so no real media could be unlinked), dev server on
port 3061 from the `feature/61a-bulk-delete-endpoint` worktree:

- Card 142, seeded with 1 `review_log` row, 1 `deck_card` row, and a dummy
  local audio file. `DELETE /api/cards {"id":142}` returned `{success:true}`;
  a repeat returned 404 "Card not found".
- Afterwards: `card` 0, `review_log` 0, `deck_card` 0 rows for 142, and the
  dummy file was removed from disk.
- `bun run measure /cards --click .card-row --select .remove-btn` at
  1400x900: the Delete button renders (68x33, in viewport) only after a row is
  selected, at the very bottom of the inspector rail, below sources, downloads
  and the deck panel, beside "Edit card".

Conclusion: the report is discoverability plus the absence of bulk delete,
which 61b and 61c address. No Step 1b needed.

**Deviations from the spec, recorded at build time:**

- Step 2 has no `db.transaction`: the row delete is one `DELETE ... WHERE id
  IN (...)` statement, already atomic in SQLite.
- Step 3's tests use a real temp directory via `GAQ_SRS_DATA_DIR` rather than
  `vi.mock` of `node:fs`, so the actual unlink is exercised.
