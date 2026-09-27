# Party display full screen

**Type:** Fix
**Status:** verified

## The problem

The party display (`/party/display`, feature 86) runs inside a normal browser
window. The tab strip, address bar, and window frame stay visible around the
game, so on a projector or a Discord screen share it looks like a web page
rather than its own player. Nothing on the page can take it full screen.

## The fix

Use the browser Fullscreen API on the display page
(`app/pages/party/display.vue`) so the whole game (player, count pill, timer,
scoreboard, banners, reveal, lightning hints) fills the screen with no
browser UI.

- **On start:** the existing "Click to start" click also requests full screen
  on `document.documentElement`. Browsers only allow full screen from a user
  click, and this is the click the page already needs to unlock audio. If
  the request fails (OBS browser source, an iframe, a browser that refuses),
  the game starts as it does today, with no error shown.
- **Toggle back in:** the browser's own Escape leaves full screen. After
  that, press `F` or double-click anywhere on the display to toggle it again.
  Only after start, and ignored while typing in a field (the display has none
  today; this just keeps it safe).
- **Corner button:** a small full-screen button in the bottom-right corner
  (free space: the reveal is bottom-center and the count and scoreboard are
  top-right). It appears on mouse movement and fades after about 2 seconds
  idle, so the display itself stays empty. The icon switches between enter
  and exit, following the `fullscreenchange` event.
- **Idle cursor:** the mouse cursor hides along with the button, so a
  pointer never sits over the video.
- Motion (the fade) respects `prefers-reduced-motion`, as the rest of the
  display does.

Must not break: the click-to-start audio unlock, playback, effects,
lightning, lobby music, or the host panel (untouched). No server, launcher,
or state changes. Tokens only for colors, per `coding-standards.md`.

Out of scope: launching the browser in kiosk or `--app` mode from
`gaq-party`. That would hide the browser UI without a click, but it depends
on which browser is installed; revisit if the Fullscreen API is not enough.

## Build steps

- [x] **1. Full screen on the display page.** Add a small
  `usePartyFullscreen` composable (isFullscreen ref, `enter`/`toggle` that
  catch rejection, `fullscreenchange` listener cleaned up on unmount), call
  `enter()` from `start()`, and add the `F` hotkey, double-click toggle,
  auto-hiding corner button, and idle cursor hide to `display.vue`.
  **Done when:** after `bun run build && bun run party`, clicking Click to
  start at `http://127.0.0.1:4000/party/display` fills the screen with no
  browser UI; Escape exits; `F`, a double-click, and the corner button each
  re-enter; the button and cursor show on mouse movement and hide after about
  2s idle; playback and audio behave as before; `bun run build` passes.

## Verify

1. `bun run build`, then `bun run party`, log into the host panel and load a
   queue.
2. Open the display URL, click **Click to start**: the display goes full
   screen and the song plays with sound.
3. Press Escape: back to a normal window. Press `F`: full screen again.
   Escape, then double-click: full screen again.
4. Move the mouse: the corner button and cursor appear; leave it still: both
   disappear. Click the button to exit and enter.
5. Run host actions (reveal, effects, timer, scoreboard) and confirm they
   all draw full screen.
