# Feature: Mix fade curve

**From build-plan:** feature 116b (sub-feature of 116, Mix fade length and curve)
**Status:** complete

## Goal

Let the user choose the shape of Listen's Mix crossfade: Smooth (equal power,
the default) or Linear (feature 115's shape). With a linear fade each song is
at half volume at the midpoint, so two unrelated songs sound quieter in the
middle; an equal-power fade keeps the combined loudness steady.

## Design reference

Extend the Display menu in `nuxt-app/app/pages/listen/index.vue`, directly under
the Fade length select from 116a, reusing the same `menu-select` styling. No
new visual target; there is no root `prototypes/` directory.

## In scope

- A Fade curve select with Smooth and Linear, default Smooth, saved in
  `localStorage` and read only on the client.
- A curve shape in the fade gain helper (`mediaGain.ts`), used by both slots of
  a Mix handoff: the incoming song follows `sin(p * pi / 2)` and the outgoing
  song `cos(p * pi / 2)` for progress `p`. Linear stays exactly as it is.
- Holding and resuming a curved fade (pause mid-overlap) with no jump in volume.
- The control is shown only while Mix is on and is disabled with the existing
  "Needs Autoplay on" wording while Autoplay is off.

## Out of scope

- More curves, a custom shape, or per-song curves.
- Any change to the overlap length, timing, handoff, pause, seek or cleanup
  rules from 115 and 116a.
- The saved volume preference, the audio graph, or the visualizer.
- Other pages (Study, Preview, Party, Kanji) and any server, schema, route or
  dependency change.

## Build loop

Outline and implement one small step, show its diff and evidence, then wait for
review. Each logic-bearing step ships its adjacent tests. Checkpoints need
approval and passing tests and build. `/complete` owns the archive and merge.

## Build steps

- [x] **Step 1 - Curve math in the gain helper.** Add a `GainCurve` type
  (`"linear" | "smooth"`) and an optional curve argument to
  `createMediaGain().ramp`. A smooth ramp schedules 32 evenly spaced linear
  segments along the curve; its snapshot follows the same curve. Default stays
  linear, so no existing caller changes.
  *Done when:* tests cover a smooth rising ramp reading `sin` values at 0, 25,
  50, 75 and 100 percent, a smooth falling ramp reading `cos` values, the
  scheduled segment points matching the snapshot, a held smooth ramp resuming
  from its held value with only the remaining time (no jump), a replacement
  ramp starting from the interpolated value, and every existing linear test
  unchanged. `bun run test` and `bun run build` pass. No visible change yet.

- [x] **Step 2 - Preference and playback plumbing.** Add the strict curve
  parser and key, a persisted `curve` on `useListenMix`, a `curve` argument on
  the player's exposed `rampGain` and the coordinator's port type, and
  `mixCurve` in the coordinator settings used by the handoff's two ramps. The
  page passes the saved choice.
  *Done when:* tests cover missing, malformed and out-of-list storage (all give
  Smooth), a saved Linear restoring on mount, a blocked-storage session change,
  and fake-clock coordinator tests showing the handoff ramping both slots with
  the chosen curve and a curve change mid-song re-staging the standby like the
  length does. Existing Mix tests still pass.

- [x] **Step 3 - Menu control and proof.** Add the select under Fade length with
  an accessible label, shown while Mix is on and disabled while Autoplay is off.
  *Done when:* in the browser against an isolated data directory, a Smooth
  overlap has both gains near 0.71 at its midpoint and a Linear overlap has
  both near 0.5 (gains read from the real audio nodes, ending at 0 and 1),
  pausing mid-overlap and resuming continues without a jump, reload restores
  the choice, Mix off hides the select, and the narrow layout has no overflow.
  Screenshot captured. `bun run test` and `bun run build` pass.

Verified 2026-10-29: `bun run test` passes 2,664 tests and `bun run build`
passes. In headless Chromium against an isolated offline data directory with
generated 40s clips (8s fade, 20s play length), gains read from the real audio
nodes: Smooth reached 0.71/0.70 at the midpoint (0.98/0.19 to 0.19/0.98 over
the fade) and Linear reached 0.48/0.52, both ending at 0 and 1. Pausing a
Smooth overlap froze the gains at 0.66/0.75 for 3s and resuming continued from
those values with no jump. A saved Linear restored after reload, Mix off hid
the select but kept the saved value, and the narrow layout had no overflow
and one visible frame. Screenshot: `curve-menu.png` in the session
scratchpad. Not covered: the Autoplay-off disabled state, other browsers, a
human listening check, and the console-error count across older sessions'
logs (the latest session's log had none).

## Files / areas

All paths are relative to `nuxt-app/`.

| Area | Purpose |
| --- | --- |
| `app/utils/mediaGain.ts` and test | `GainCurve`, curved ramp scheduling and snapshot |
| `app/utils/listenMix.ts` and test | Curve storage key and strict parser |
| `app/composables/useListenMix.ts` and test | Persisted curve |
| `app/components/study/StudyMediaPlayer.vue` | Pass the curve through the exposed `rampGain` |
| `app/composables/useListenPlayback.ts` and test | `mixCurve` setting, curve on the handoff ramps |
| `app/pages/listen/index.vue` | Select under Fade length, passing the curve |

## Data / contracts

- Storage key `gaqSrs:listenMixCurve` holds `"smooth"` or `"linear"`; anything
  else, including a missing key, reads as `"smooth"`.
- `GainCurve = "linear" | "smooth"` is exported from `mediaGain.ts`
  (load-bearing: the player, the port type and the coordinator all use it).
- `ListenPlaybackSettings` gains `mixCurve: GainCurve` beside `mixSeconds`. A
  change settles any running overlap and re-stages the standby, the same as a
  length change.
- A curve applies to a whole `ramp`. A resumed fade re-applies the curve over
  the remaining time starting from the held value: continuous in volume, with
  the rate of change restarting its shape. Linear fades are unaffected.
- Segments: 32 per ramp regardless of length. The error against the true curve
  is under 0.2 percent of full volume at 32 segments, inaudible for a fade.
- `setValueCurveAtTime` is deliberately not used: cancelling or holding a
  scheduled curve mid-flight is unreliable across browsers, while linear
  segments cancel cleanly with the existing `cancelScheduledValues` path.

## Testing

Pure gain math and the parser get Vitest cases next to the source. Coordinator
behaviour gets fake-clock tests in `useListenPlayback.test.ts`. The menu
control rides on browser evidence and the build, per the testing gate in
`coding-standards.md`.

## Notes for the AI

- Keep it small: one shape function and an optional argument, not a new
  envelope system. Linear behaviour must stay byte-for-byte what it is now.
- Existing users who have Mix on will hear Smooth after this ships, since it
  is the default; that is the approved decision, so do not default to Linear.
- Reuse the Fade length select's markup and classes; no inline styles and no
  hard-coded colours.
- Do not change the ramp timing, the handoff or the pause rules.
