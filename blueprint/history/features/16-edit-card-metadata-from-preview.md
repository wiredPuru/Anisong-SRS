# Feature: Edit card metadata from Preview

**From build-plan:** feature 16
**Status:** verified

## Goal

Let a card's song title, theme slot, artist, and local file paths be corrected
directly from the Preview modal (`CardPreviewModal`), instead of only being
fixable by re-running the lookup flow or (for local paths only) the separate
inline edit row on `/cards`.

## In scope

- `CardPreviewModal` gains an edit mode: song title, theme slot, artist, and
  local video/audio paths become editable.
- Theme slot edits are validated against the existing
  `(animeId, themeSlot)` uniqueness - you can't rename a theme slot to one
  another song on the same anime already uses.
- Artist edits offer two modes, chosen per edit:
  - **Rename globally** - edits the `Artist` row's name in place. Since
    `Song.artistId` is shared, every card built from any song by that artist
    updates too. Rejected with a clear error if the new name already belongs
    to a *different* artist (name is unique) - use reassign instead for that
    case.
  - **Reassign to a different artist** - get-or-create by name (reusing
    `getOrCreateArtist`, the same helper the lookup flow already uses) and
    repoint just this song's `artistId`. Only cards using this exact song are
    affected.
- Local video/audio path edits reuse the existing `updateCard`
  validation (must be an absolute path inside a configured media library
  folder, or blank to clear) - the same rules the `/cards` row edit already
  enforces.
- Saving refreshes the card shown in Preview and tells `/cards` to refresh
  its list, so the row behind the modal reflects the change without a full
  page reload.

## Out of scope

- The existing `/cards` row inline edit (local paths only) stays exactly as
  it is - this feature adds a second entry point for the same underlying
  capability, not a replacement. Deduplicating the two is a separate future
  call.
- **Orphaned `Artist` rows.** Reassigning a song away from an artist can
  leave that artist with zero songs. Nothing deletes or flags that row - it
  stays in the table unused. Artist rows are cheap and deleting one
  automatically risks surprising data loss if reassignment was a mistake;
  revisit only if orphaned artists become an actual problem.
- Editing anime metadata (titles, cover image) - not touched by this
  feature at all.
- Editing the remote reference URLs (`animethemesVideoUrl`/
  `animethemesAudioUrl`) - only local paths are editable, matching what's
  editable elsewhere today.
- Adding Preview (or this edit capability) to `/cards/new` - same deferral
  feature 11 already made for the Preview button itself.
- A dedicated artist-management page (list/merge/delete artists) - this is a
  per-card fix, not artist administration.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server: extend card update to cover song/artist fields** -
  in `server/utils/cards.ts`, extend `UpdateCardInput`/`updateCard` to
  accept optional `songTitle`, `themeSlot`, `artistMode`
  (`"rename" | "reassign"`), and `artistName`. When `songTitle`/`themeSlot`
  are present, trim and require non-empty, and for `themeSlot` reject a
  value that collides with another song's `(animeId, themeSlot)` (excluding
  the song being edited). When `artistMode`/`artistName` are present, trim
  and require non-empty; `"rename"` updates the `Artist` row's name in
  place (reject with a 400 if the name already belongs to a different
  artist); `"reassign"` calls `getOrCreateArtist(name)` and repoints the
  song's `artistId`. Wire the new fields through `server/api/cards.patch.ts`
  (`readBody` -> `updateCard`). *Done when:* a PATCH to `/api/cards` with
  each new field updates the right row and the response's `CardWithDetails`
  reflects it; a duplicate theme slot or a colliding artist rename returns a
  400 with a clear `statusMessage`; a PATCH carrying only
  `localVideoPath`/`localAudioPath` (today's existing behavior) is
  unaffected. Verify with `curl`/a scratch fetch against the dev server -
  no UI yet.

- [x] **Step 2 - Client: edit mode in `CardPreviewModal`** - add an
  Edit/Cancel toggle to the modal. In edit mode, show: song title and theme
  slot text inputs; an artist section with a mode choice ("Rename this
  artist everywhere" / "Use a different artist") and one name input whose
  label follows the selected mode; local video/audio path inputs matching
  `/cards`' existing pattern (blank clears the path). Save calls the
  extended `PATCH /api/cards`; on success, emit an `updated` event carrying
  the fresh card so `app/pages/cards/index.vue` can `refresh()` its list and
  swap in the updated card for the open Preview; on failure, show the
  server's error inline (reusing the `.edit-error` styling already used on
  `/cards`) without closing the modal. Cancel discards edits and returns to
  the read-only view. *Done when:* in the browser, opening Preview, editing
  each field (including both artist modes) and saving updates what Preview
  shows immediately and what `/cards`' row shows after the modal closes; a
  duplicate theme slot or colliding artist rename shows the error inline and
  keeps the modal open with the attempted edits intact; Cancel discards
  changes with no request sent. `bun run build` stays clean and the browser
  console shows no errors.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `UpdateCardInput`/`updateCard`.
- `nuxt-app/server/api/cards.patch.ts` - pass the new body fields through.
- `nuxt-app/app/components/card/CardPreviewModal.vue` - edit mode UI.
- `nuxt-app/app/pages/cards/index.vue` - handle the `updated` event, refresh
  the list, keep the open Preview card in sync.

## Data / contracts

No schema change. Extends the existing `updateCard` input shape:

```ts
// server/utils/cards.ts
export interface UpdateCardInput {
  id: number;
  localVideoPath?: string | null;
  localAudioPath?: string | null;
  songTitle?: string;
  themeSlot?: string;
  artistMode?: "rename" | "reassign";
  artistName?: string;
}
```

`CardWithDetails` (already load-bearing across `/api/cards`,
`/api/decks/cards`, `/api/study/next`, `/api/study/review`,
`/api/cards/download`) is unchanged in shape - this feature only changes
which rows feed it.

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test`
entry), so this rides on the done-when evidence above: `curl`/fetch checks
for Step 1, browser verification for Step 2. The theme-slot-collision and
artist-rename-collision validation in Step 1 is pure logic with clear
right/wrong answers - a good candidate to backfill a unit test for once
`/tests` sets up a runner, but not a gate today.

## Notes for the AI

- Reuse `getOrCreateArtist` from `server/utils/lookup.ts` for the reassign
  path rather than writing a second get-or-create.
- The theme-slot uniqueness check must exclude the song's own current row,
  or every no-op save (theme slot unchanged) would falsely collide with
  itself.
- Artist rename must exclude the artist's own current row from the
  collision check for the same reason (renaming "Foo" to "Foo" must not
  error).
- `CardWithDetails` is reconstructed via `getCardWithDetails(id)` after any
  update - don't hand-build the response shape separately in the edit path.
- Follow the existing local-path convention: blank input clears the field
  (`null`), matching `saveEdit` in `app/pages/cards/index.vue`.
