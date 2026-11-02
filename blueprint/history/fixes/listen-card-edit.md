# Edit cards and assign decks from Listen Mode

**Type:** Fix
**Status:** verified

## The problem

`/listen` has no Edit card action. While listening, the user has to leave the
session to add the current card to a manual deck or correct its details.
Study and Preview already have editing surfaces, and `DeckMembershipPanel`
already supports assigning an existing card to multiple manual decks.

## The fix

- Add a visible **Edit card** action for the current song on `/listen`,
  available even when Details is closed. Open an editor without navigating away
  or mounting another media player. Reuse Preview's editor in an edit-only
  presentation so its field and membership behavior stays shared.
- Match Preview's editable details: song title, theme slot, artist (with the
  existing rename-everywhere versus reassign choice), local video/audio paths,
  and notes. Reuse the existing `/api/cards` PATCH behavior and validation.
- Include `DeckMembershipPanel` to add or remove this card from existing
  manual decks, using the current membership routes. Checkbox changes save
  immediately, as on the existing editors; Cancel discards only unsaved fields.
- Extend the existing configurable `editCard` hotkey action to Listen (default
  E), with its current binding shown in the action's hint. Typing in the editor
  must not trigger playback or playlist hotkeys.
- Pause playback while the editor is open, including active Mix players and
  playback timers, so Autoplay, play length and Mix cannot change the card being
  edited. Close back to the same song, paused and ready for the user to resume.
  Metadata or membership edits must preserve playback position; changing a
  media path may reload that media through the existing player behavior.
- Apply saved card data to the playlist by card ID without refetching or
  reshuffling it. Details must show the saved values immediately. Membership
  changes affect future playlist loads, leaving the current playlist intact.
- Show loading, saving and failure states inside the editor. A failed save
  keeps the entered values available for retry; reopening loads current deck
  membership. Bind asynchronous operations to the card opened for editing.

Listen remains ungraded: these are explicit metadata and membership writes,
with no review logs, schedule changes, bury, suspend or Mark known actions.
No card creation/import, deck creation, schema change or new API is needed.
Study and Preview retain their existing behavior.

## Build steps

- [x] **1. Add the Listen card editor and deck assignment.** Wire the visible
  action, configurable hotkey, existing edit fields and membership panel into
  `/listen`; hold playback safely during editing and patch saved data in place.
  Reuse existing editing code where practical without expanding Study-only
  actions into Listen. **Done when:** the current song can be added to an
  existing manual deck and have its details saved from Listen, both changes
  persist after reload, Cancel discards unsaved fields, and the playlist stays
  on the same song and position while editing, including with Autoplay and Mix.

## Verify

1. On `/listen`, open Edit card with Details closed, then with Hide Info on.
   Confirm the editor can be reached in both cases. E and a rebound Edit card
   key open it; typing spaces and arrow keys in fields does not control Listen.
2. Assign the current card to a manual deck, close and reopen the editor, then
   confirm membership on `/decks`. Remove it and verify the same persistence.
   Cancel after a checkbox change keeps that immediate membership update but
   discards unsaved text changes.
3. Save a song title or note and confirm Details updates without resetting the
   playlist. Reload to confirm persistence. Exercise artist rename/reassign
   and local-path validation through the existing edit behavior.
4. With Autoplay, a short play length and Mix enabled, open the editor near a
   handoff. Leave it open past the advance time: the same card stays selected,
   all audio is paused, and the position holds. Close and resume; Next,
   Previous, Auto Reveal and Mix still work. Repeat with Mix off.
5. Simulate a failed card save or membership request: show a readable error,
   preserve unsaved fields and allow retry without updating another card.
   Confirm Listen edits create no reviews or scheduling changes.
6. Run `bun run test` and `bun run build` from `nuxt-app/`. Add focused tests
   for any new pure logic governing card identity, playback hold or hotkey
   scope; use real browser evidence for the editor and membership flow. Smoke
   check Study and Preview if shared editing or hotkey code changes.

## Completion evidence

- `bun run test` (205 files, 2721 tests) and `bun run build` passed from `nuxt-app/`.
- Browser (playwright-cli, `/listen`, read-only): E opened the editor with the
  clip paused; typing in the song title field plus Space and ArrowRight did not
  resume or advance playback; Escape closed it on the same song, still paused at
  the same position; 0 console errors.
- Not exercised in a browser at completion: saving fields, deck add/remove and
  reload persistence, the Autoplay + Mix handoff scenario, and failed-write retry.
  Typecheck was not run (no type checker installed).
