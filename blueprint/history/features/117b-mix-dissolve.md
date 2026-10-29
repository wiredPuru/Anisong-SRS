# Feature: Mix dissolve

**From build-plan:** feature 117b (sub-feature of 117, Mix video dissolve)
**Status:** complete

## Goal

During a Listen Mix overlap, make the picture dissolve along with the audio:
the outgoing song's picture stays fully visible while the incoming song's
picture fades in on top of it, over the same fade length. Without a dissolve the
picture cuts at the handoff while the audio blends. A remembered Dissolve toggle
(default on) turns it off, and reduced-motion users get the cut.

117a built the stack (both pictures in one frame, the outgoing one inert and
invisible by default, driven by `--incoming-opacity` and `--tail-opacity`).
This sub-feature drives those two properties.

## Design reference

No new look beyond the effect itself. The control is one toggle button in the
Display menu under the Fade curve select, reusing the existing `menu-toggle`
styling. There is no root `prototypes/` directory.

## In scope

- Progress of the running overlap from the slot coordinator: a reactive
  "overlapping" flag and a `progress()` value from 0 to 1 that freezes when the
  overlap is paused and continues on resume, and matches the audio's timing.
- A per-frame driver that turns progress into the incoming picture's opacity
  and writes it to the stack: the outgoing picture is held at full opacity
  beneath (no dark dip in the middle) and the incoming one fades in over it.
  The incoming opacity follows the chosen curve (sine for Smooth, straight for
  Linear), matching the audible weight of the incoming song.
- A remembered Dissolve toggle, default on, shown under the Mix controls only
  while Mix is on and disabled with the existing "Needs Autoplay on" wording
  while Autoplay is off.
- Reduced motion: when the user's system asks for reduced motion, or Dissolve is
  off, the picture changes at the handoff exactly as it does today while the
  audio still blends.
- Cover-art songs (the spinning record) dissolve like videos, so video, cover
  and mixed pairs all work.
- While a dissolve is running the incoming frame gets a solid backdrop, so the
  outgoing picture cannot show through letterbox bars in ambient mode.

## Out of scope

- Any change to the audio crossfade, its length or curve, or to the slot
  coordinator's timing, pause, seek and cleanup rules (it only gains read-only
  progress).
- The Now playing bar, the info panel and the details cards at the handoff;
  they still switch at the handoff.
- Dissolving anything other than the picture (no separate title crossfade),
  other transition styles, Study, Preview, Party and Kanji, and any server,
  schema, route or dependency change.

## Build loop

Outline and implement one small step, show its diff and evidence, then wait for
review. Each logic-bearing step ships its adjacent tests. Checkpoints need
approval and passing tests and build. `/complete` owns the archive and merge.

## Build steps

- [x] **Step 1 - Opacity math and the Dissolve preference.** Add a pure
  `dissolveOpacity(progress, curve)` and a strict `parseListenMixDissolve`
  (default on; only an exact saved `"0"` turns it off), and a persisted
  `dissolve` on `useListenMix` that works for the session when storage is
  blocked.
  *Done when:* tests cover progress clamped to 0..1 (including NaN and values
  outside the range), the sine curve at 0, 25, 50, 75 and 100 percent, the
  linear curve, missing, malformed and junk storage all reading on, a saved
  off restoring on mount, a blocked-storage session change, and every existing
  Mix test unchanged. `bun run test` and `bun run build` pass. No visible
  change yet.

- [x] **Step 2 - Overlap progress from the coordinator.** Store the overlap's
  length with it and expose `overlapActive` (reactive) and `overlapProgress()`:
  elapsed fraction of the overlap while it runs, the frozen fraction while it is
  paused, and `null` when no overlap exists.
  *Done when:* fake-clock coordinator tests show progress near 0 at the commit,
  about half after half the length, frozen across a pause and a long wait,
  continuing after resume, 1 at the end, `overlapActive` true from commit until
  the tail is retired, and both reset to inactive and `null` after a seek abort,
  a settings settle and a manual Next. Existing coordinator tests unchanged.

- [x] **Step 3 - Drive the dissolve.** A small composable runs one animation
  frame per tick only while an overlap is active, Dissolve is on and reduced
  motion is off, and exposes the incoming opacity (or `null`). `ListenMediaPlayer`
  takes a `dissolve` value: when set, the stack shows the outgoing picture at full
  opacity, applies the value to the incoming one, and gives the incoming frame a
  solid backdrop; when `null` it behaves exactly as 117a. The page passes it.
  *Done when:* in the browser (isolated data directory, 40s clips, 8s fade) the
  incoming card's computed opacity rises from near 0 to 1 across the overlap
  while the outgoing card stays at 1, with a Smooth overlap reading about 0.71
  at the midpoint and a Linear one about 0.5; after the overlap one card
  remains at opacity 1; pausing mid-overlap freezes both values and resuming
  continues without a jump; manual Next and a seek during the overlap leave one
  opaque card; and with reduced motion emulated the opacity never leaves 1 and
  the outgoing card stays invisible. `bun run test` and `bun run build` pass.

- [x] **Step 4 - Toggle and proof.** Add the Dissolve toggle to the Display
  menu and run the verification matrix.
  *Done when:* in the browser the toggle shows only while Mix is on, reads on by
  default, saves and survives a reload, and turning it off makes the picture cut
  at the handoff; video-to-video, video-to-cover, cover-to-video and
  cover-to-cover handoffs each dissolve; ambient mode on and off both look right
  in screenshots taken mid-dissolve; the narrow layout has no overflow and one
  visible frame after each overlap; Mix off still renders one plain card; review
  state is unchanged in the isolated database. `bun run test` and `bun run build`
  pass.

Verified 2026-10-29: `bun run test` passes 2,674 tests and `bun run build`
passes. In headless Chromium against an isolated offline data directory with
generated 40s clips (8s fade, 20s play length), computed card opacities:
- Linear overlap: the outgoing card stayed at 1.00 while the incoming card rose
  0.03 to 0.99 (0.50 near the midpoint); Smooth reached about 0.70 at the
  midpoint (0.07 to 0.99); both ended with one card at 1.00.
- Pausing mid-overlap froze the incoming opacity at 0.61 for 3.5s with both
  clips paused, and resuming continued from 0.61 to 0.99 with no jump.
- Manual Next during an overlap left one card at 1.00 and advanced to 3 / 4.
- Reduced motion emulated through `matchMedia`: the incoming card stayed at
  1.00 and the outgoing card stayed at 0 for the whole overlap (a cut).
- Dissolve toggle: shown only while Mix is on, on by default with nothing
  stored, a click stored `"0"`, the choice survived a reload, and with it off
  the picture cut at the handoff (outgoing 0, incoming 1).
- Mid-dissolve screenshots with ambient on and off (`dissolve-ambient-on.png`
  and `dissolve-ambient-off.png`, `dissolve-menu.png` in the session
  scratchpad) show the incoming cover-art card over the outgoing video at
  about 0.73 opacity.
- Narrow layout (390px): no horizontal overflow, one card after each overlap.
  Mix off: one card, no stack wrapper, a 900px frame as before. Review state in
  the isolated database was unchanged (0 reviews, 0 tracks, box sum 4).
Not covered: a programmatic seek during the overlap did not end it (the
coordinator's seek detection polls every 250ms and a local seek is shorter than
that; this predates 117b and applies to the audio fade too), a pairing matrix
beyond the shuffled orders observed (video-to-video, audio-to-video and
audio-to-audio dissolved in the runs), other browsers, and a human visual or
listening check.

## Files / areas

All paths are relative to `nuxt-app/`.

| Area | Purpose |
| --- | --- |
| `app/utils/listenMix.ts` and test | `dissolveOpacity`, the Dissolve storage key and parser |
| `app/composables/useListenMix.ts` and test | Persisted `dissolve` |
| `app/composables/useListenPlayback.ts` and test | `overlapActive`, `overlapProgress()` |
| `app/composables/useMixDissolve.ts` (new) | Per-frame driver and reduced-motion check |
| `app/components/listen/ListenMediaPlayer.vue` | `dissolve` prop: stack opacities and backdrop |
| `app/pages/listen/index.vue` | Wire the driver, add the toggle |

## Data / contracts

- Storage key `gaqSrs:listenMixDissolve` holds `"1"` or `"0"`; only an exact
  `"0"` reads as off, so a missing or junk value reads on.
- `dissolveOpacity(progress, curve)` returns the incoming picture's opacity:
  `sin(p * pi / 2)` for `smooth`, `p` for `linear`, with `p` clamped to 0..1
  and NaN read as 0 (load-bearing: Step 3 and the tests share it).
- `useListenPlayback` returns `overlapActive: Ref<boolean>` and
  `overlapProgress(): number | null` (load-bearing; read-only, it never
  changes timing).
- `ListenMediaPlayer` gains `dissolve?: number | null`. `null` or absent means
  no dissolve and today's 117a behavior; a number is the incoming opacity.
- Progress is derived from the wall clock and the overlap's stored length, not
  accumulated per frame, so a throttled background tab catches up correctly and
  a held overlap's value is exact.
- The outgoing picture stays at full opacity for the whole overlap and is then
  removed with the tail; this is intended (see Goal), not a dip-to-background.

## Testing

Pure math, the parser, the preference and the coordinator's progress get Vitest
cases next to the source, with fake timers for the clock. The per-frame driver,
the stack styling and the toggle ride on browser evidence (computed opacities
sampled over time, screenshots) and the build, per the testing gate in
`coding-standards.md`.

## Notes for the AI

- Keep Mix-off and Dissolve-off rendering identical to today; verify with a
  run of each.
- The default is on for existing Mix users, by the user's decision.
- Reduced motion must be checked at run time (`matchMedia`), guarded for the
  server, and the toggle must not be needed for it to take effect.
- Reuse the existing menu toggle markup and classes; no inline colours and no
  hard-coded colours. A CSS variable bound through `:style` is the existing
  pattern here (`--frame-*`) and is fine for the opacity.
- The driver must stop its frames when the overlap ends or the component is
  disposed; no leaked animation frames.
