# Feature: Mix stacked frames

**From build-plan:** feature 117a (sub-feature of 117, Mix video dissolve)
**Status:** complete

## Goal

Prepare Listen's picture for a dissolve. During a Mix overlap, the outgoing
song's picture stays visible in the same frame, under the incoming one, instead
of disappearing at the handoff. This sub-feature builds the stack and its
plumbing only; the incoming picture is still fully opaque, so nothing looks
different yet. 117b adds the fade, the toggle and reduced-motion handling.

It also fixes a bug found while specifying it: after a Mix handoff the stage's
measured frame width becomes `0px` (see below), which breaks the Now playing
bar's width and the details card's cover.

## Design reference

No new look. The stack must be invisible to the eye: same frame size, same
position, same corner radius and glow as today. Listen's existing layout in
`nuxt-app/app/pages/listen/index.vue` is the reference; there is no root
`prototypes/` directory.

## The bug (measured 2026-10-29, current `master`)

`usePlayerFrameBox` measures the first `.player-frame` in the pane. With Mix on,
the pane holds two player cards and the hidden one can come first in the DOM.
Sampled in the browser during a Mix run: before the first handoff `--frame-w`
is `899.5px`; after it the variable reads `0px` while the visible frame is
900px wide, and it stays wrong for later songs. The Now playing bar uses
`--frame-w` for its width and the details card covers the frame by those
numbers, so both are wrong after the first handoff.

## In scope

- Measuring the visible foreground frame, not merely the first one, and
  re-measuring when the foreground changes (handoff or role change).
- A `ghost` option on the shared player so the outgoing (tail) slot can stay
  visible but inert: no controls, no theme badge, no expand button, no clicks,
  no hotkeys, hidden from assistive tech, still playing its fading audio.
- A stack container in `ListenMediaPlayer` (managed mode only) that overlays
  the two player cards in one grid cell, outgoing beneath incoming, with a
  stable size.
- The outgoing slot keeps the Hide Video and Hide Cover state it had when it was
  last foreground, so a song that was revealed does not re-veil at the handoff.
- An `--incoming-opacity` custom property on the stack, default `1`, applied to
  the incoming card. Nothing sets it yet; 117b will.

## Out of scope

- Any fade, timing, toggle, or reduced-motion behavior (117b).
- Changes to the audio crossfade, the slot coordinator's timing, pause, seek or
  cleanup rules, or the details/info panels at the handoff.
- Plain (Mix off) playback, Study, Preview, Party and Kanji, and any server,
  schema, route or dependency change.

## Build loop

Outline and implement one small step, show its diff and evidence, then wait for
review. Each logic-bearing step ships its adjacent tests. Checkpoints need
approval and passing tests and build. `/complete` owns the archive and merge.

## Build steps

- [x] **Step 1 - Measure the visible frame.** Make `usePlayerFrameBox` measure
  and observe the foreground player's frame and re-measure when the visible
  frame changes. The coordinator exposes which slot is foreground (already in
  `slots`), and the page passes a trigger so the measurement refreshes at the
  handoff.
  *Done when:* in the browser against an isolated data directory, `--frame-w`
  and `--frame-h` equal the visible frame's real size before, during and after a
  Mix handoff, for several consecutive songs (the bug above no longer
  reproduces), and ordinary Mix-off listening measures as before. The
  selection rule is a small pure function with a Vitest case where possible.
  `bun run test` and `bun run build` pass.

- [x] **Step 2 - Ghost slot and frozen veils.** Add `ghost` to
  `StudyMediaPlayer` and the stack container with the incoming-opacity
  property to `ListenMediaPlayer`; the coordinator gains an `onHandoff` option
  called once at commit, before `advance`, and the page uses it to hand the
  outgoing slot its frozen Hide Video and Hide Cover values.
  *Done when:* coordinator tests show `onHandoff` firing exactly once per
  handoff and not for a cancelled attempt, and in the browser during an overlap
  both player cards are visible with identical boxes, the outgoing one has no
  controls and is not focusable or clickable, the incoming one is on top, and
  the outgoing picture keeps its revealed state with Hide Video on. Setting
  `--incoming-opacity` by hand in the browser console shows the outgoing
  picture beneath (proof the stack works). `bun run test` and `bun run build`
  pass.

- [x] **Step 3 - Prove it end to end.** Run the verification matrix.
  *Done when:* in the browser, video-to-video, video-to-cover and
  cover-to-cover handoffs each show the stack for the overlap and then only the
  incoming card, with the stage measurements correct throughout; pausing
  mid-overlap leaves the stack in place and resuming finishes it; manual Next
  during an overlap leaves one card; Mix off renders exactly as before (one
  card, no stack wrapper); the narrow layout has no overflow. Screenshot
  captured, and review state unchanged in the isolated database.

Verified 2026-10-29: `bun run test` passes 2,666 tests and `bun run build`
passes. In headless Chromium against an isolated offline data directory with
generated 40s clips (8s fade, 20s play length):
- Stage measurements: `--frame-w`/`--frame-h` stayed 899.5/506 (equal to the
  visible frame) across three consecutive handoffs; before the fix the width
  read 0px after the first one.
- During an overlap both player cards are visible with identical boxes, the
  outgoing one carries `ghost`, `inert`, no controls, and is invisible by
  default (`--tail-opacity: 0`); setting `--tail-opacity: 1` and
  `--incoming-opacity: 0.4` by hand showed the outgoing video beneath the
  incoming cover-art card (screenshot `stack.png` in the session scratchpad).
- Frozen veil: with Hide Video on and the outgoing video song revealed, the
  outgoing card kept `veil=false` while the incoming card was veiled.
- Pausing mid-overlap left both cards in place with both clips paused, and
  resuming finished the overlap; manual Next during an overlap left one card
  and advanced to the next song; the stack disappeared (one card) after each
  overlap.
- Mix off: one card, no stack wrapper, a 900x506 frame as before; narrow layout
  (390px, Mix off) had no overflow.
Not covered: a narrow-layout run with Mix on, an ambient-glass run, an explicit
Study page check of the shared frame measurement (its selector matches the
plain card the same way), other browsers, and a human listening or visual check.
A layout regression found along the way (a grid wrapper made the frame fill the
stage width) was fixed by giving the stack definite rows and columns.

## Files / areas

All paths are relative to `nuxt-app/`.

| Area | Purpose |
| --- | --- |
| `app/composables/usePlayerFrameBox.ts` (and a small pure helper plus test) | Measure the visible foreground frame |
| `app/components/study/StudyMediaPlayer.vue` | `ghost` option: visible, inert, no chrome |
| `app/components/listen/ListenMediaPlayer.vue` | Stack container, per-slot ghost and frozen veil props |
| `app/composables/useListenPlayback.ts` and test | `onHandoff` option |
| `app/pages/listen/index.vue` | Capture frozen veils at handoff, pass the measurement trigger |

## Data / contracts

- `ListenMediaPlayer` gains `tailHideVideo` and `tailHideCover` (booleans, the
  veil state frozen at the handoff) beside its existing attrs; the tail slot
  uses them in place of the page's live values.
- `useListenPlayback` options gain `onHandoff?: () => void`, called once per
  committed handoff, immediately before `advance` (load-bearing: 117b may read
  the same moment to start the picture fade).
- The stack container is rendered only when Mix is managing the presentation;
  Mix off keeps today's markup exactly.
- `--incoming-opacity` defaults to `1` on the stack and is the only thing
  117b needs to drive; ghost cards never listen for pointer or keyboard input.
- Ambient mode makes `.player-frame` transparent, so a stacked outgoing picture
  can show through the incoming frame's letterbox. This is invisible while the
  incoming card is opaque (this sub-feature) and is 117b's problem to solve.

## Testing

The selection rule and `onHandoff` are logic and get Vitest cases next to the
source, with the existing fake-clock coordinator tests extended. The stack,
ghost chrome and measurements ride on browser evidence (screenshots, DOM boxes
and the hand-set opacity) and the build, per the testing gate in
`coding-standards.md`.

## Notes for the AI

- Keep Mix-off markup and behavior byte-for-byte unchanged; verify with a
  Mix-off run.
- Do not add any visible effect in this sub-feature.
- Reuse existing tokens; no inline styles for colours, and no hard-coded
  colours.
- A ghost card must never register hotkeys, tint the page, update Last played,
  or paint the ambient glow; those are already foreground-only, keep it that
  way.
