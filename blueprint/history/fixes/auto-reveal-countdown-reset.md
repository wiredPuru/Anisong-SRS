# Fix: Auto Reveal countdown resets when toggling immersive mode

**Type:** Fix
**Status:** verified

## The problem

On `/study`, with Auto Reveal on and a countdown actively ticking, pressing
`E` to switch between normal and immersive mode (or back) restarts the
countdown at the full configured duration instead of continuing from
whatever time was left.

Root cause: `StudyAutoRevealCountdown.vue` owns its own display state
(`remaining = ref(props.seconds)`) and resets it unconditionally in
`onMounted`. `study/index.vue` renders two separate instances of this
component - one inside the immersive `#video-overlay` slot, one in the
non-immersive `.side` panel - each gated by `v-if="immersive"` /
`v-if="!immersive"`. Toggling `immersive` unmounts one instance and mounts
the other fresh, and the new instance always initializes from the static
`autoRevealSeconds` setting, not from how much time had actually elapsed.

This is a display-only bug: the *actual* reveal trigger lives in
`study/index.vue`'s own `autoRevealTimeout`/`autoRevealArmedAt`/
`autoRevealArmedDurationMs`/`autoRevealRemainingMs` state (a real `setTimeout`
unaffected by immersive toggling - already correctly pause/resume-aware for
play/pause, per feature 46). Only the countdown *pill's displayed number*
resets; the card doesn't actually get more time before revealing.

(A second reported symptom - the ambient glow showing through during the
countdown - is confirmed expected behavior per feature 14/24, not a bug. Not
addressed here.)

## The fix

Give `study/index.vue` a small helper that computes the current remaining
whole seconds from its existing timer state (mirroring the same three cases
`onPlaybackPaused`/`maybeStartOrResumeAutoReveal` already handle: actively
counting down, paused mid-countdown, or not yet started), and pass that
computed value as both `<StudyAutoRevealCountdown>` instances' `:seconds`
prop instead of the static `autoRevealSeconds`. Since the child only reads
its `seconds` prop once on mount, this only matters at the exact moment a
fresh instance mounts (i.e. right when immersive toggles) - which is exactly
when it's wrong today.

Must not change: the actual reveal-timing logic (`autoRevealTimeout` et al.)
- this only fixes what the pill *displays* on a fresh mount, not when the
card actually reveals. Must not affect the countdown's normal per-card
behavior (new card still starts the full configured duration, per the
existing `presentationKey`-keyed reset).

## Build steps

- [x] **Step 1 - Pass live remaining time into the countdown display** - added
  a `currentAutoRevealRemainingSeconds()` helper in `study/index.vue`
  (elapsed-from-`autoRevealArmedAt` when a timeout is running, else
  `autoRevealRemainingMs` when paused mid-countdown, else the full
  `autoRevealSeconds`), and used it for both `<StudyAutoRevealCountdown>`
  instances' `:seconds` binding.

## Verify

- Live browser verification (headless Chrome over CDP, this project's own
  pattern, no Playwright): set a 10s countdown, started playback, let ~3s
  elapse (displayed "8"), toggled immersive - the new instance mounted
  showing "8", not reset to "10" - then continued ticking down normally
  ("8" -> "6" over the next 2s). Repeated toggling the other direction
  (immersive -> normal) with the same result. Confirmed a *new* card (via
  Fail/ArrowLeft) still starts its countdown at the full configured duration
  ("10") in either mode - the fix only affects continuation, not the
  per-card reset.
- `bun run build` passed clean, both during implementation and again as
  this skill's own final safety pass.
- Dev server log checked for new console/errors: none.
- No test runner configured (`AGENTS.md` has no `test` command) - this is
  UI/timing behavior, verified manually and by build, per the Testing gate
  in `coding-standards.md`.
