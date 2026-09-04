# Safari: horizontal overflow on Study persists regardless of display mode

## Type

Fix

## Status

verified

## The problem

The previous fix (removing `.ambient-glow`'s redundant `width: 100vw; height:
100vh`) did not resolve it: the user confirms horizontal overflow on
`/study` in Safari still happens regardless of which display mode (Video /
Cover / Ambient / Audio-only) is active, and an arrow key press
(ArrowLeft/ArrowRight, hijacked for Fail/Pass) still scrolls the page
sideways and pushes the left rail off-screen.

Since it reproduces in every mode, the cause isn't mode-specific content -
it's something present on every `/study` render. No other `100vw`/`100vh`
usage remains in `app/` (the ambient-glow one was the last), and measuring
the page in headless Chrome at several sizes shows no element wider than the
viewport, so this is very likely a genuine Safari-only rendering
discrepancy (sub-pixel rounding, `vw`-vs-scrollbar handling, or native
form-control sizing differ between WebKit and Blink) rather than one
specific missized element reachable from this environment (no Safari
automation is available here - only headless Chrome, per
`coding-standards.md`'s Browser Verification section).

Regardless of the exact sub-pixel source, the page (`.app-shell` / `body`)
was never designed to scroll horizontally at all - the rail + content shell
is meant to exactly fill the viewport width. There is currently no guard
against the document itself becoming horizontally scrollable, so any
stray sub-pixel overflow (Safari-specific or not) is free to turn into a
visible, keyboard-triggerable scroll.

## The fix

Added `overflow-x: hidden` to `body` in `app/assets/css/main.css`. This is a
defensive, architectural fix rather than chasing the exact overflowing
pixel: since no page in this app is meant to scroll horizontally, the
document should never be able to, no matter which sub-pixel/browser quirk
produces a stray bit of width. Kept two earlier changes made in the same
investigation (real, correct fixes, just not sufficient alone):

- `.ambient-glow` without the redundant `width: 100vw; height: 100vh`
  (`StudyMediaPlayer.vue`) - `inset: 0` on the `position: fixed` box already
  fills the viewport, without `100vw`'s scrollbar-width discrepancy.
- `event.preventDefault()` on the ArrowLeft/ArrowRight/Enter hotkeys in
  `StudyAnswerControls.vue`, since those keys are already fully hijacked as
  app hotkeys (Fail/Pass/Continue) and should never fall through to a
  native scroll/activate behavior in any browser.

## Build steps

- [x] Add `overflow-x: hidden` to the `body` rule in
  `app/assets/css/main.css`. Done when: `bun run measure /study` (and a
  couple of other pages) still show no layout regressions, and - since
  Safari itself can't be automated here - the user confirms in real Safari
  that pressing the arrow keys on `/study` no longer shifts the page or
  exposes the rail, in every display mode. Confirmed fixed in real Safari
  by the user.

## Verify

- User: open `/study` in Safari in each display mode (Video, Cover,
  Ambient on/off, Audio-only) and press the left/right arrow keys
  repeatedly in each. The page must never shift horizontally and the rail
  must stay fully visible. Confirmed.
- Agent: `bun run test` and `bun run build` stay green; `bun run measure`
  across `/`, `/study`, `/cards`, `/decks`, `/stats`, `/settings` shows no
  new horizontal overflow and no visual regression in the ambient glow's
  full-bleed coverage.
