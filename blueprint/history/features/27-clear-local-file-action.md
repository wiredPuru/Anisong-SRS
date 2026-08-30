# Feature: Explicit "Clear local file" action on cards

**From build-plan:** feature 27
**Status:** verified

## Goal

Today, blanking a card's local video/audio path text field and clicking Save
updates the database to `null` but never removes the actual file from disk -
`updateCard()` (`server/utils/cards.ts`) has no file-cleanup step, unlike
`deleteCard()` (feature 17), which already does exactly this via
`deleteFileIfUnreferenced()`. This feature adds an explicit "Clear" button
next to each local path field (in both `/cards`' row edit and
`CardPreviewModal`'s edit mode) that blanks the field *and* deletes the file,
reusing that same cleanup helper - and closes the gap so blanking a path
through either surface behaves consistently and correctly from now on.

## In scope

- A "Clear" button next to the local video path field and next to the local
  audio path field, in both edit surfaces (`/cards`' row edit form,
  `CardPreviewModal`'s edit form). Four buttons total, but one shared pattern.
- Clicking "Clear" immediately calls `PATCH /api/cards` with just that one
  field set to `null` (the other field, and every other card property, is
  left untouched), then reflects the cleared state in the open edit form.
- Server-side: `updateCard()` gains the same file-cleanup behavior
  `deleteCard()` already has - when a local path is explicitly set to `null`
  and the card previously had a value there, delete that file from disk
  unless another remaining card still references the exact same path
  (reusing the existing, in-file `deleteFileIfUnreferenced()` helper
  unchanged). This applies to *any* caller that explicitly nulls a local
  path field through `PATCH /api/cards` - including the pre-existing "blank
  the text input, then Save" flow, not just the new buttons - since both
  are the same "I'm clearing this path" intent and should behave the same
  way, closing the gap consistently rather than leaving one path fixed and
  the other still leaking files.
- The existing "must have at least one source" validation
  (`hasAnySource(...)`) still applies unchanged - clearing a card's only
  remaining source is rejected with the same error message as today, before
  anything is written or deleted.
- Each "Clear" button is disabled when that field is already empty on the
  saved card, or while a save/clear is already in flight.

## Out of scope

- Cleaning up a file when a local path is *replaced* with a different
  non-null path (not cleared) - only the explicit-clear-to-`null` case is
  covered, matching the build-plan line's literal scope. Path replacement
  leaving an orphaned file is a separate, pre-existing gap, not introduced
  or fixed here.
- A confirmation dialog before clearing - feature 17's full card delete
  already removes local files with no added confirmation step; this stays
  consistent with that precedent rather than introducing a new pattern for
  just this one action.
- `/cards/new` - it has no local-path edit surface today (per feature 11's
  original deferral), so there's nothing to add a Clear button to there.

## Build steps

- [x] **Step 1 - Server: `updateCard()` cleans up cleared local files** - In
  `server/utils/cards.ts`'s `updateCard()`: when `input.localVideoPath ===
  null` (or `localAudioPath`) and the existing row had a non-null value
  there, collect that old path. After the `hasAnySource` validation passes
  and the DB update commits, call the existing `deleteFileIfUnreferenced()`
  for each collected path (same helper `deleteCard()` already uses - no
  change to that helper itself).
  *Done when:* `PATCH /api/cards` with `{ id, localVideoPath: null }` on a
  card whose local video file exists only on that card removes the file
  from disk and sets the DB field to `null`; if another card's
  `localVideoPath` or `localAudioPath` still points at that same path, the
  file is left in place (matching `deleteCard()`'s existing dedup
  behavior); clearing a card's only remaining source still returns the
  existing "needs at least one source" error and leaves the file and DB
  untouched.

- [x] **Step 2 - `/cards`' row edit gets Clear buttons** - In
  `app/pages/cards/index.vue`: add a "Clear" button next to `editVideoPath`
  and one next to `editAudioPath` inside the row's edit form. Each calls a
  new `clearLocalPath(card, kind)` that PATCHes just that one field to
  `null`, updates the local edit buffer to `""` on success, and refetches
  the list. Disabled when the card's saved value for that field is already
  empty, or while any save/clear for that row is in flight. Errors surface
  through the existing `editError` display.
  *Done when:* opening a card's edit form and clicking "Clear" next to a
  populated local video/audio path immediately removes the file (per Step
  1), blanks that field in the form, and leaves the other field and the
  rest of the edit form untouched; the button is disabled when that field
  is already empty.

- [x] **Step 3 - `CardPreviewModal`'s edit mode gets Clear buttons** -
  Mirror Step 2 inside `CardPreviewModal.vue`'s edit form: a `clearLocalPath(kind)`
  function scoped to `props.card`, PATCHing one field to `null`, updating
  the local edit ref, and emitting `updated` with the fresh card (the same
  event `saveEdit()` already emits) so the parent page's card list/state
  refreshes without closing the edit form.
  *Done when:* same as Step 2, but from the Preview modal's edit form,
  including when opened from `/cards`, a deck detail page (feature 22), or
  anywhere else `CardPreviewModal` is used - no separate change needed
  there since they all share this one component.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `updateCard()`.
- `nuxt-app/app/pages/cards/index.vue` - row edit form.
- `nuxt-app/app/components/card/CardPreviewModal.vue` - edit form (also
  covers every page that renders this component, e.g. deck detail's Preview
  button from feature 22, with no separate work needed there).
- No new server routes - both UI surfaces reuse the existing `PATCH
  /api/cards` endpoint and `updateCard()`.

## Data / contracts

- No schema or type changes. Reuses `updateCard()`'s existing
  `localVideoPath?: string | null` / `localAudioPath?: string | null` input
  shape and the existing `deleteFileIfUnreferenced(path: string): void`
  helper, unchanged.

## Testing

No test runner is configured in `AGENTS.md`, so this rides on manual/curl
verification and build evidence, same as feature 17 and recent fixes in this
area:

- `curl -X PATCH /api/cards -d '{"id": <id>, "localVideoPath": null}'` on a
  card with a real local video file - confirm the file is gone from disk and
  the response shows `localVideoPath: null`.
- Same card setup, but with a second card sharing that exact local path -
  confirm the file survives the clear (dedup check).
- A card with only one source - attempt to clear it - confirm the existing
  400 error, and confirm the file is untouched.
- In the browser: `/cards` row edit and `CardPreviewModal`'s edit form
  (opened from `/cards` and from a deck detail page) - Clear button per
  field, disabled-when-empty, error display on failure.

## Notes for the AI

- `deleteFileIfUnreferenced()` is already file-scoped to `server/utils/cards.ts`
  and not exported - keep it that way, just add a second call site to it
  from within the same file.
- Follow the established `$fetch` (mutation) pattern already used by
  `saveEdit()`/`removeCard()` in both files - the new `clearLocalPath()`
  functions are one more mutation alongside those, not a new pattern.
- Match each file's existing error-handling convention
  (`extractErrorMessage`) exactly - both files already define their own
  copy of that helper (a known, already-ledgered duplication - F-04 in
  `blueprint/context/findings.md` - not this feature's job to fix).

## Verification evidence

- `bun run build` - clean after every step and at the final safety pass.
- Server logic (Step 1) verified end-to-end against isolated throwaway test
  data in a scratchpad media-library folder, never touching the real
  `/Users/lu/Downloads/Test` library: confirmed the "only source" guard
  blocks a clear and leaves the file untouched; confirmed clearing a path
  with another source present deletes the file; confirmed a file still
  shared by another card survives a clear (dedup check). All test
  cards/files cleaned up afterward.
- Route checks (`/cards`, `/decks` -> `200`) after each UI step.
- Gap: Playwright is not installed in this project, so the Clear buttons
  themselves were not clicked in a live browser - verified via the
  underlying API calls (identical to what the buttons call) plus
  build/route evidence.

## Findings

None raised against this feature.
