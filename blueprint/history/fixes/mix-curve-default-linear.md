# Fix: Mix fade curve defaults to Linear

**Type:** Fix
**Status:** complete

## The problem

Feature 116b made Smooth (equal power) the default Mix fade curve, so anyone
already using Mix heard a different fade after the update. The user wants
Linear, feature 115's original fade, to stay the default; Smooth should be an
opt-in.

The default lives in four places in `nuxt-app/app/`:

- `utils/listenMix.ts`: `parseListenMixCurve` returns Smooth for a missing or
  unrecognised stored value.
- `composables/useListenMix.ts`: the `curve` ref starts as `"smooth"`.
- `composables/useListenPlayback.ts`: the coordinator's initial `mixCurve` is
  `"smooth"`.
- Tests that assert Smooth as the default (`utils/listenMix.test.ts`,
  `composables/useListenMix.test.ts`).

## The fix

Invert the default, nothing else:

- `parseListenMixCurve` returns `"smooth"` only for an exact stored `"smooth"`;
  anything else, including a missing key, is `"linear"`.
- The `curve` ref and the coordinator's initial `mixCurve` start as `"linear"`.
- The select order stays Smooth then Linear (no layout change); its value now
  reads Linear on first use.
- Update the tests to assert Linear as the default and Smooth as the exact
  opt-in value.

Must not break:

- A user who explicitly picked Smooth or Linear keeps that choice. The setting
  is only written when the select changes, so a stored `"smooth"` is always a
  deliberate choice and stays Smooth; a stored `"linear"` stays Linear.
- The curve math in `mediaGain.ts` and the handoff, pause and cleanup rules are
  untouched.

Docs: `blueprint/build-plan.md` (feature 116's line) and the 116 entries in
`blueprint/context/project-overview.md` say Smooth is the default. Those plans
are user-owned, so this fix does not edit `build-plan.md`; the overview's 116
wording is updated to match once the user corrects the plan line (or approves
the one-word edit), and `/overview` is rerun to refresh its source hash.

## Build steps

- [x] **Step 1 - Invert the default.** Change the parser, the composable's
  initial value and the coordinator's initial setting, and update the affected
  tests.
  *Done when:* tests show a missing, empty, junk or `"Smooth"`-cased stored
  value reads Linear and exactly `"smooth"` reads Smooth; the composable starts
  Linear before mount, restores a saved Smooth on mount, and still falls back
  to Linear when storage throws; coordinator tests using the default still
  pass. `bun run test` and `bun run build` pass.

## Verify

- `bun run test` and `bun run build` pass.
- In the browser with a clean profile (no `gaqSrs:listenMixCurve` key), turn on
  Mix, open the Display menu, and the curve select reads "Curve: Linear". A
  Mix handoff's gains are about 0.5/0.5 at the midpoint. Picking Smooth saves
  it, reload keeps Smooth, and the midpoint reads about 0.71/0.71.

Verified 2026-10-29: `bun run test` passes 2,664 tests and `bun run build`
passes. In headless Chromium against the isolated data directory with no saved
curve, the select read Linear and nothing was written to storage; picking
Smooth saved `"smooth"` and a reload kept Smooth. The 0.5 and 0.71 midpoints
were measured under feature 116b and the curve math is unchanged. Not covered:
the Autoplay-off disabled state and other browsers. `build-plan.md` (feature
116) and the 116 entries in `project-overview.md` still say Smooth is the
default; the plan is user-owned and was left alone.
