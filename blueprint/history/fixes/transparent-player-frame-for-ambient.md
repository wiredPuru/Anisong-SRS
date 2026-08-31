# Fix: Transparent player frame so ambient glow fills it too

**Type:** Fix
**Status:** verified

## The problem

`StudyMediaPlayer.vue`'s `.player-frame` (the 16:9 box holding the
video/audio/record content) always paints its own opaque gradient
background (`radial-gradient(...), radial-gradient(...), #120c19` - that
last layer is a solid, fully opaque color). The ambient glow canvas lives
behind the entire page (`Teleport to body`, `z-index: -1`) and already
shows through everywhere *outside* the frame - `.player-card` itself turns
translucent glass when ambient mode is on (feature 24) - but the frame's
own hardcoded background blocks the glow from ever showing up *inside* the
frame's own bounds: the space around the spinning record in audio mode
(feature 44), or letterbox bars around a non-16:9 video.

## The fix

Bind the same `ambient-glass` class already used elsewhere in this
component onto `.player-frame` itself (currently only `.player-card` gets
it), and add a `.player-frame.ambient-glass { background: transparent; }`
rule. Only active while ambient mode is on - non-ambient playback keeps
today's exact gradient, unchanged.

Must not break: the non-ambient default look (frame keeps its gradient
when `ambient` is false), and the record disk / veil / media elements
still render correctly on top of whatever is now showing through
(ambient glow, or nothing if ambient mode is somehow on with no glow
computed yet - falls back to the page's own background, which is
already the case everywhere else ambient's translucency applies).

## Build steps

- [x] **Step 1 - Make `.player-frame` transparent when ambient is on** -
  add `:class="{ 'ambient-glass': ambient }"` to the `.player-frame` div
  and the corresponding CSS rule. *Done when:* with Ambient mode on, the
  space around the record (or a video's letterbox bars) shows the ambient
  glow instead of the static pink/purple gradient; with Ambient mode off,
  the frame looks exactly as it always has.

## Verify

- `bun run build` passes.
- Manually: toggle Ambient mode on/off on `/study` while a card with cover
  art (or any card) is showing, and confirm the frame's background
  visually matches the ambient glow when on, and reverts to the plain
  gradient when off.
