# Fix: player controls fade away until you hover the video

**Type:** Fix
**Status:** verified
**Fixes:** none (not from a findings-ledger entry)

## The problem

`StudyMediaPlayer.vue` draws its controls as a floating outlined pill across the
bottom of the video (`.player-controls`: play button, the full scrub bar, the
time readout, the speaker icon and the volume slider). It is always on screen,
so it sits on top of the picture the whole time a clip plays. The host wants it
quiet: gone while watching, back when the pointer is over the video, with just a
slim bar showing how far through the clip it is.

The component is shared, so the same pill shows on Study, Listen, the card
Preview modal and the `/cards` and `/decks` inspector player.

## The fix

All in `nuxt-app/app/components/study/StudyMediaPlayer.vue`.

**Resting state (playing, pointer elsewhere):**
- The pill is invisible (fades out, takes no clicks).
- A thin progress line runs along the bottom edge of the video frame: a muted
  track with a fill for how much of the clip has played, so the time left reads
  at a glance. About 3px high, no text, no buttons, no volume.

**Revealed state:** the full pill fades back in (about 150ms) and the thin line
fades out, whenever any of these is true:
- the pointer is over the video frame (`.player-frame:hover`, which includes the
  pill itself);
- keyboard focus is inside the controls (`:focus-within`), so tabbing to Play,
  the scrub bar or Volume shows them;
- the clip is **paused**, so the Play button is never hidden when it is the one
  thing you need (chosen default, flagged for review);
- the scrub bar or volume slider is being dragged, so letting the pointer slip
  off the frame mid-drag does not make the control vanish under it.

**Touch screens:** with no hover to reveal it, `@media (hover: none)` keeps the
pill visible as it is today and hides the thin line.

**Details**
- A `controls-rest` class on `.player-frame`, set while the clip is playing and
  nothing is being dragged, drives the resting look; the thin line is one new
  `<div class="mini-progress">` using the existing `progressPercent`.
- Expanded mode (`.player-card.expanded`) behaves the same, with the line's
  height scaling like the other expanded sizes.
- The volume slider drag is detected with `:has(.volume-slider:active)` so no
  new script state is needed for it; the scrub drag already has `isDragging`.
- Under `prefers-reduced-motion` the fade is instant.
- The existing hotkeys, the "Hotkey: S" tooltip on Play, the expand button and
  the theme badge are untouched.

**Must not break**
- Playback, seeking by clicking or dragging the scrub bar, volume persistence,
  and the ambient glass look of the pill when it is shown.
- Listen, Preview and the inspector keep working: they get the same hover
  behaviour (intended, so the player is consistent everywhere).

## Build steps

- [x] **1. Hover-revealed controls with a thin progress line.** Add the
  `mini-progress` element and the `controls-rest` class, and the CSS for the
  resting, revealed, touch and reduced-motion states in `StudyMediaPlayer.vue`.
  *Done when:* while a clip plays with the pointer away, only a thin progress
  line shows along the bottom of the video and it advances; moving the pointer
  onto the video fades the full controls in (play, scrub, time, volume) and the
  line out; pausing keeps the controls visible; dragging the scrub bar or the
  volume slider off the frame keeps them visible until release; on a touch
  device (`hover: none`) the pill stays as before; `bun run test` and
  `bun run build` pass.

## Verify

- Run the app against a **copy** of the database (`GAQ_SRS_DATA_DIR` pointing at
  a backup, dev server on a spare port) and open `/study`; do not touch the real
  library's schedule.
- With a clip playing and the mouse off the video: screenshot shows only the
  thin line. Hover the video: full controls. Pause: controls stay.
- Drag the scrub bar and move the pointer out of the frame before releasing:
  controls stay until release.
- Emulate `hover: none` and reduced motion and confirm the pill stays visible
  (touch) and the fade is instant.
- Check `/listen` and a Preview from `/cards` quickly for the same behaviour.
