# Feature: Delete card cleans up orphaned files

**From build-plan:** feature 17
**Status:** verified

## Goal

Deleting a card should not leave its local media files behind on disk with
nothing in the app pointing at them. `DELETE /api/cards` should remove the
card's local video/audio files too, unless another card still needs them.

## In scope

- `deleteCard` (`server/utils/cards.ts`) deletes the card row, then for each
  of that card's `localVideoPath`/`localAudioPath` (when set), deletes the
  file from disk **unless another remaining card's `localVideoPath` or
  `localAudioPath` is the exact same path**.
- File deletion is best-effort: a missing file (`existsSync` false) or a
  filesystem error (e.g. permission denied) is caught and ignored - it
  degrades to "the file stays behind," the same as today's behavior, rather
  than failing the card deletion. The card row is already gone by that
  point regardless.
- No change to the request/response shape of `DELETE /api/cards` or the
  existing `/cards` Delete button - this is purely a server-side behavior
  change.

## Out of scope

- Remote sources (`animethemesVideoUrl`/`animethemesAudioUrl`) - never
  touched, they aren't files on local disk.
- A confirmation dialog before delete ("this will also remove N files").
  This was weighed and deliberately rejected during scoping in favor of
  automatic cleanup with the shared-file safety check - the existing Delete
  button already has no confirmation today, and this feature doesn't add
  one.
- Deck export/import - unaffected; export copies files, it doesn't touch
  the originals, and import doesn't delete anything.
- `DeckCard`/`ReviewLog` cleanup on card delete - already handled by the
  schema's `onDelete: cascade`, nothing to change here.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server: delete orphaned local files on card delete** - in
  `server/utils/cards.ts`, change `deleteCard(id)` to: look up the card
  first to capture its `localVideoPath`/`localAudioPath`; delete the row;
  then for each non-null path captured, query whether any remaining card
  still has that exact path in either local-path column (`or(eq(...),
  eq(...))` against the `card` table) - if not, and the file exists
  (`existsSync`), `unlinkSync` it inside a `try`/`catch` that silently
  ignores failures. Return `true`/`false` exactly as today (card not found
  -> `false`). *Done when:* deleting a card whose local file(s) are not
  referenced elsewhere removes those files from disk; deleting a card whose
  local file is still referenced by another existing card leaves that file
  in place; deleting a card that only has remote sources (no local paths)
  behaves exactly as before. Verify against the dev server with real
  fixture files created inside a configured library folder (not the user's
  real media) - create two temp cards, one sharing a local path with
  another, delete through the two cases via `curl -X DELETE
  /api/cards`, confirm file presence/absence, then remove any leftover
  fixture files/cards. `bun run build` stays clean.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `deleteCard`.

## Data / contracts

No schema or API shape change. `deleteCard(id: number): boolean` keeps its
existing signature.

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test`
entry), so this rides on the done-when evidence above via `curl` against
the dev server with throwaway fixture files. The "skip if still
referenced" branch is pure logic with a clear right/wrong answer - a good
candidate to backfill a unit test once `/tests` sets up a runner.

## Notes for the AI

- Capture the paths **before** deleting the row - `deleteCard` has no other
  way to know what the card referenced once it's gone.
- Query for "still referenced" against the `card` table only after the
  row is deleted, so a plain existence check is correct without needing to
  exclude the deleted card's own id.
- Never touch `animethemesVideoUrl`/`animethemesAudioUrl` - only the two
  local-path columns.
- Use `unlinkSync` from `node:fs`, matching the existing pattern in
  `server/utils/mediaDownload.ts`.
- When writing fixture files for verification, put them inside a folder
  already configured in `MediaLibrarySettings.libraryPaths` (check
  `GET /api/media-library` first) so `createCard`'s path validation
  accepts them, and delete the fixture files/cards afterward - never
  create or delete anything inside the user's real media folders.
