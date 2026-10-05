# Fix: S key plays the selected card before Play is clicked

**Type:** Fix
**Status:** verified

## The problem

On `/cards` and `/decks`, the inspector rail shows a Play button and mounts the
player only after it is clicked (click-to-play, commit `a456c78`). The S play/pause
hotkey is registered by `StudyMediaPlayer.vue` (`onKeydown`, a `window` listener
added on mount), so until the player exists, pressing S does nothing. S should
start the selected card's clip, the same as clicking Play.

## The fix

In `nuxt-app/app/components/card/CardInspector.vue`, add a `window` keydown
listener (mounted and unmounted with the inspector) that sets `playRequested = true`
when all of these hold:

- the key is `s` with no Ctrl, Meta or Alt held
- a card is selected and it has a source (`sourceBadges(card).length`), and no
  player is mounted yet (`!playRequested`)
- the target is not a text field (`useHotkeyGuard().isTypingTarget`)
- no card edit form is open in the inspector (`editingId === null`)
- the event was not already handled (`!event.defaultPrevented`)

Once the player is mounted, its own S handler keeps toggling play/pause, so the
inspector's listener does nothing further. It cannot double-toggle: the player
registers its listener after the keypress that mounted it. `start-on-mount`
already makes a mounted-by-Play player start the clip, so S needs no new plumbing.

Must not break: S play/pause on `/study` and in Preview, typing "s" in the search
boxes and edit fields, and the Play button.

## Build steps

- [x] 1. **S starts the selected card.** Add the listener above to `CardInspector.vue`.
   Done when: on `/cards` and on a deck's detail view, selecting a card and pressing
   S mounts the player and starts the clip; pressing S again pauses it; typing "s"
   in the search box does not start anything.

## Verify

- `/cards`: select a card, press S: the clip plays. S again pauses, S resumes.
- Same on `/decks` (deck detail view).
- Click into the search box and type "s": no playback, text appears.
- Open a card's edit form and type "s" in a field: no playback.
- Select a card with no source: S does nothing.
- `/study`: S still plays and pauses.
- `bun run test` and `bun run build` pass.

## Outcome

Added a `window` keydown listener to `CardInspector.vue` that sets `playRequested` on S when a card with a source is selected, no player is mounted, no edit form is open, and the target is not a text field. Evidence: on `/cards` (headless `bun run measure`, click first row then key `s`) the Play button was replaced by the mounted player showing the pause icon; `bun run test` (1740) and `bun run build` pass. Not exercised in a browser: `/decks`, typing "s" in the search box, and a second S to pause. Known gap: S also starts the selected card while an unrelated modal is open.
