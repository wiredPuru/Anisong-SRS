# Fix: Keyboard-first typed-answer playback

**Type:** Fix

**Status:** verified

## The problem

Typed Answers is meant to support a mouse-free Study loop, but its anime-title
input is only focused during a narrow mount/reset path. Focus can be missed when
Typed Answers becomes usable after loading or after a temporary Study panel
closes. Playback also remains paused when the user begins answering, so they
must move to the player or use a separate hotkey before typing.

## The fix

Keep the anime-title input focused whenever the current typed-answer control
becomes enabled and available. On the first non-empty user edit for each card,
emit a playback-start request synchronously so the media player can use that
keyboard gesture to call `play()`. Expose a play-only player method that does
nothing when media is already playing; typing must never toggle or pause media.

Reset the one-shot typing trigger when the presented card or Study scope
changes. Preserve IME composition, autocomplete navigation, answer submission,
the result/Continue phase, manual `S` play/pause, and existing playback error
handling.

## Build steps

- [x] **Step 1 - Focus the answer and start playback from typing.** Make
  `StudyTypedAnswer` refocus when it transitions into an enabled/available state
  and emit one `typing-started` event on the first non-empty edit for each card.
  Add a play-if-paused method to `StudyMediaPlayer` and wire the Study page to
  call it synchronously from that event. **Done when:** enabling Typed Answers or
  advancing to a new card places the caret in the anime-title box, and typing the
  first character starts paused video or audio without moving focus or requiring
  a mouse; already-playing media stays playing.

## Verify

- Run `bun run test` and `bun run build` from `nuxt-app/`.
- In `/study`, enable Typed Answers and confirm the anime-title input receives
  focus without a click.
- With a paused video card, type one character and confirm playback starts while
  the caret remains in the input and suggestions continue to work.
- Repeat with an audio card, then advance to another card and confirm the input
  is focused and the first typed character starts that card once.
- Confirm typing while media is already playing does not pause or restart it,
  IME composition still searches normally, and `S` still toggles playback.
