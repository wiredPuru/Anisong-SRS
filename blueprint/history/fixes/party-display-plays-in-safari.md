# Current Feature

## Party display plays in Safari

**Type:** Fix
**Status:** verified

### The problem

On Safari, the party display (`/party/display`) freezes on a song's first frame
when the host presses Play. The host panel still says it is playing. Reproduced
by the user on Safari. A fresh Chromium tab plays the same game correctly, and
the clip route serves every clip fine (`206`, `video/webm`).

Cause: Safari only lets a media element play with sound once that element has
been started inside a user gesture. Chrome instead unlocks the whole page after
one click.

- `PartyDisplayPlayer.vue` renders one `<video>` per token (`v-for` keyed by
  token), so every song gets a new element. That element is created after
  "Click to start", Safari refuses its `play()`, and the frame stays frozen.
- `followPlaying()` calls `element.play().catch(() => {})`, so the refusal is
  silent: nothing on the display or the host panel says playback failed.
- `PartyLobbyMusic.vue` has the same silent `play().catch(() => {})` on its
  `<audio>`. Its element persists, but it is never started inside the start
  click either.

This also covers any browser that blocks playback for another reason, such as
Low Power Mode.

### The fix

1. **Reuse a fixed pool of video elements.** The display keeps three `<video>`
   elements (the current song plus the two preloads it already buffers) that
   live for the whole session. Each element is assigned a token instead of
   being created per token. The start click (`start()` in
   `pages/party/display.vue`) calls `play()` on every pooled element and
   pauses it right away, plus the lobby music `<audio>`. Safari then counts
   them as user-started, so every later song can play.
   - Moving to the next song switches the "current" slot to the element that
     already holds that token, so preloading still works.
   - A new upcoming token is loaded into whichever pooled element has dropped
     out of the window.
   - Existing behaviour must not change: the outgoing song pauses and mutes
     before the swap, preloads stay muted and hidden, and random start, seek,
     effects, pixelate, peek, and lightning timing work as before.
2. **Show a refused `play()`.**
   - **Display:** when `play()` rejects with `NotAllowedError` for the current
     song, show a "Tap to resume" prompt (Kai, `paused` mood) over the player.
     A click or tap on it calls `play()` again inside that gesture and clears
     the prompt once playback starts. The lobby music does the same.
   - **Host:** `PartyPosition` and the display's position report gain
     `blocked: boolean`, validated in `position.post.ts`. It is passed through
     unchanged to the host view. `PartyNowPlaying` shows a notice like "The
     display can't start playback. Tap or click the display screen."
   - A `blocked` report reads as not playing, so lightning timing does not
     advance while blocked.

Not in scope: mpv or any native player (see the conversation: the display
stays a browser page so OBS/Discord can capture it), and anything Safari does
to a covered or minimised window.

### Build steps

- [x] **Step 1 - Pooled, unlocked video elements.** `PartyDisplayPlayer.vue`
  renders three persistent `<video>` slots and assigns tokens to them. It
  exposes an `unlock()` method that `display.vue`'s `start()` calls inside the
  click, together with `PartyLobbyMusic`'s element. If the slot-assignment
  logic is non-trivial, extract it to a pure helper in `app/utils/` with a
  Vitest test (keeping slots for tokens that are still in the window, reusing
  freed slots, and handling a jump to a song that was not preloaded).
  **Done when:** in Safari, after Click to start, pressing Play on the host
  plays song 1 with sound, and Next / Previous / a queue jump each play
  without another click.
- [x] **Step 2 - Visible refusal plus host flag.** Add the "Tap to resume"
  prompt on the display and lobby music, and add `blocked` to the position
  report, `PartyPosition`, the host view, and a `PartyNowPlaying` notice.
  Extend `partyGame.test.ts` and the position route's validation for the new
  field. **Done when:** forcing a refusal (by skipping `unlock()` locally, or
  with Safari's Auto-Play set to "Never Auto-Play") shows the prompt on the
  display and the notice on the host. One tap on the display then resumes
  playback and clears both.

### Verify

- `bun run test` and `bun run build` pass.
- After a build, run `bun run party` and open the display in Safari, click Click
  to start, load a queue on the host, and press Play:
  - The song plays with sound.
  - Next, Previous, and a queue-list jump play without a click.
  - Lobby music plays between songs when it is enabled.
- Blur, pixelate, peek, cover mode, and a lightning round still behave as before
  in Safari and Chrome.
- With the unlock skipped: the display shows "Tap to resume", the host shows
  its notice, and one tap resumes playback.
- Chrome and an OBS browser source behave as before.
