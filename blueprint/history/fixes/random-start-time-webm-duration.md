# Fix: Random Start Time silently forced to 0:00 on webm streams

**Type:** Fix
**Status:** verified

## The problem

`StudyMediaPlayer.vue`'s `onLoadedMetadata` (lines 215-243) has two paths for
learning a clip's duration:

- **Fast path** (lines 219-225): if `el.duration` is already finite and `> 0`,
  use it directly and, when `randomStart` is on, seed `currentTime` with
  `randomStartTime(el.duration)`.
- **Fallback path** (lines 227-242): for the known browser quirk where a
  streamed `.webm` clip (animethemes.moe's native format for both video and
  audio) reports `duration` as `Infinity`, `NaN`, or transiently `0` until the
  browser scans to the end of the stream. This path forces that scan
  (`el.currentTime = 1e101`) and waits for a one-shot `durationchange` event to
  read the real value.

The fallback's `durationchange` handler (line 236) computes:

```ts
const resolved = Number.isFinite(el.duration) ? el.duration : 0;
```

with no `> 0` guard - unlike the fast path's entry check just above it, which
was specifically hardened (`Number.isFinite(el.duration) && el.duration > 0`)
in a prior fix because `Number.isFinite(0)` is `true` and a bare `0` used to
slip through and freeze the scrub bar's total at "0:00".

If the *first* `durationchange` this listener sees also fires while duration
is still transiently `0` (the exact same quirk the fast path's guard exists
to catch), `resolved` locks in at `0`. Because the listener is registered
`{ once: true }`, it never gets a second chance to catch the real duration
once the browser resolves it. Two visible symptoms follow for that
presentation:

1. `duration.value` freezes at `0:00` (the scrub-bar bug this fallback was
   built to prevent, resurfacing through its own edge case).
2. `el.currentTime = props.randomStart && resolved > 0 ? randomStartTime(resolved) : 0`
   evaluates the `resolved > 0` guard as false, so it silently forces
   `currentTime` to `0` instead of a random point - "Start at random times"
   appears broken, with no error and no visual indication anything went
   wrong.

This is a general client-side logic bug, not something the build changes -
`/api/media/stream` (feature 41) behaves identically in dev and packaged
builds. It shows up far more in packaged/standalone builds because a fresh
install has no pre-populated local media library yet and leans on remote
`.webm` streaming for most cards, which is exactly the path that hits this
quirk; a dev workflow with locally downloaded (often non-webm) files mostly
takes the unaffected fast path.

## The fix

Made the fallback's `durationchange` handling as defensive as the fast
path's entry guard, and stopped it from permanently locking in a bad reading:

```ts
const MAX_DURATION_ATTEMPTS = 5;
let durationAttempts = 0;
const onDurationChange = () => {
  durationAttempts += 1;
  const resolved = el.duration;
  const isResolved = Number.isFinite(resolved) && resolved > 0;
  if (!isResolved && durationAttempts < MAX_DURATION_ATTEMPTS) return;
  el.removeEventListener("durationchange", onDurationChange);
  duration.value = isResolved ? resolved : 0;
  el.currentTime = props.randomStart && isResolved ? randomStartTime(resolved) : 0;
};
el.addEventListener("durationchange", onDurationChange);
el.currentTime = 1e101;
```

Replaces the one-shot `{ once: true }` listener with one that keeps listening
until it sees a genuinely resolved (`> 0`) duration, capped at 5 attempts so a
clip that truly never resolves still settles into a safe state (`currentTime`
`0`) instead of listening forever.

Unaffected: the fast path, the existing scrub-bar `0:00`-freeze guard it
carries, and both `<video>` and `<audio>` call sites (both call the same
`onLoadedMetadata`).

## Build steps

- [x] **Step 1 - Fix the fallback's `durationchange` handling** - Reworked
  `onLoadedMetadata`'s fallback branch in `StudyMediaPlayer.vue` as above.
  *Done when:* loading a remote `.webm` clip with "Start at random times" on
  consistently starts partway into the clip (not `0:00`) across repeated
  loads, and the scrub bar's total duration is never stuck at `0:00` for a
  clip that does resolve a real duration. Local (non-webm) files are
  unaffected (fast path unchanged).

## Verify

- `bun run test` - 45/45 passing, no regressions.
- `bun run build` - clean, no type errors.
- Manual/browser: on `/study`, toggle "Start at random times," then step
  through several cards backed by real animethemes.moe `.webm` streams via
  the actual Reveal-then-Pass flow and confirm each starts at a random point.

## Verification evidence

- **Mocked reproduction**: a throwaway script replaying the exact bug
  scenario (a `durationchange` firing with a transient `0`, then the real
  value) against the old vs. new logic - old locks at
  `duration=0.00 currentTime=0.00`; new recovers to
  `duration=137.40 currentTime=33.73`.
- **Real browser, real remote streams**: drove `/study` in headless Chrome
  against the dev server and live animethemes.moe `.webm` clips (card 227
  `SenranKaguraOVA-ED1.webm` and others reached via the due-card queue),
  toggled "Start at random times" post-hydration, then advanced through 5
  fresh presentations via the real Reveal (Enter) -> Pass (ArrowRight) flow:
  start points landed at 22.1%, 36.4%, 33.9%, 74.6%, and 26.6% into their
  respective clips - genuinely random each time, never `0:00`. (The very
  first card checked, still showing from before the toggle was flipped,
  correctly stayed at `0:00` - toggling mid-presentation isn't retroactive,
  matching feature 10's existing "reset every session" behavior.)
- `bun run test` and `bun run build` both clean.
- Not extracted as a Vitest unit test: the fix lives entirely in
  `HTMLMediaElement` event-handler sequencing (DOM/browser-quirk behavior),
  not isolable pure logic per the testing gate in `coding-standards.md` -
  it rides on the browser evidence above instead.

## Findings

None raised against this fix.
