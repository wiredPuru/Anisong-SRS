# Fix: Scrub bar has no drag tracking

**Type:** Fix
**Status:** verified

## The problem

Confirmed via `/debug`: `StudyMediaPlayer.vue`'s `.scrub` element only has
`@click="onSeek"` - no `mousedown`/`mousemove`/`mouseup` tracking at all.
A plain click (press and release without moving) seeks correctly, but
the natural "click and drag back and forth" gesture users actually use on
a scrub bar produces **zero feedback while dragging** and only seeks once,
to wherever the mouse happens to be at release.

Reproduced with a simulated drag (mousedown at 20% → drag to 50% → drag
to 80% → mouseup), reading `video.currentTime` at each stage:

| Stage | `currentTime` |
|---|---|
| mousedown @ 20% | `0` |
| dragged to 50% (still held) | `0` |
| dragged to 80% (still held) | `0` |
| mouseup | `52.82` (= 80% of duration) |

This also explains the "doesn't show the time duration accurately" half
of the report: the progress-bar fill and the displayed time are both
driven by `currentTime.value`, which only updates via the video's own
`timeupdate` event - so neither moves at all while dragging; the bar
looks frozen until release, then jumps.

(Separately checked the existing `Infinity`/`NaN`-duration webm
workaround in `onLoadedMetadata` against four different clips - two
local, one remote, one clip both ways. None triggered that code path, so
it's untested by this fix, not cleared as unrelated. This fix addresses
the confirmed drag-tracking gap only.)

## The fix

Replace the click-only handler with real mouse-drag tracking:

- `mousedown` on `.scrub`: capture the bar's bounding rect once, seek
  immediately to that position (matching today's single-click behavior),
  and attach `window`-level `mousemove`/`mouseup` listeners (window-level
  so the drag keeps tracking even if the cursor moves outside the bar's
  bounds, and releasing anywhere ends it - the standard scrub-bar
  pattern).
- `mousemove` while dragging: reuse the same seek calculation against the
  captured rect, updating both the real `el.currentTime` (so playback
  position and the browser's own `timeupdate`/`seeked` events track live)
  and `currentTime.value` directly (so the progress-bar fill and
  displayed time update immediately, without waiting on a `timeupdate`
  round-trip).
- `mouseup`: end the drag, remove both window listeners.
- `onUnmounted`: also remove any still-attached drag listeners, in case
  the component unmounts mid-drag (e.g. the card changes via
  `presentationKey` while the mouse is still held) - otherwise stale
  listeners referencing a torn-down instance would linger until an
  eventual mouseup.

Continuous real seeking during the drag (not just a visual preview
committed on release) matches how native `<input type="range">`-based
video scrubbers already behave, and keeps the fix small - no throttling
or a separate "preview vs. commit" state needed for a first pass.

**Must not break:** the existing guard against seeking with no resolved
duration (`!Number.isFinite(duration.value) || !duration.value`) - the
new drag handler reuses this exact check, so scrubbing still safely
no-ops (rather than seeking to `NaN`) if duration hasn't resolved yet.
`onSeek` is fully superseded and removed - not left as dead code
alongside the new handler.

## Build steps

- [x] **Step 1 - Add drag tracking to the scrub bar**
  - `nuxt-app/app/components/study/StudyMediaPlayer.vue`:
    - Remove `onSeek` and its `@click="onSeek"` binding.
    - Add `function seekToClientX(clientX: number, rect: DOMRect)`:
      the same ratio/clamp math `onSeek` already had, but sets both
      `el.currentTime` and `currentTime.value`.
    - Add `onScrubMouseDown(event: MouseEvent)`: captures
      `event.currentTarget`'s bounding rect, calls `seekToClientX`
      immediately, then registers `window` `mousemove`/`mouseup`
      listeners (mousemove re-calls `seekToClientX` with the captured
      rect; mouseup removes both listeners and clears the tracked
      cleanup reference).
    - Track the active cleanup function in a module-scope-free local
      variable (e.g. `let stopDrag: (() => void) | null = null`) and
      call it from a new `onUnmounted` (or the existing one, if adding a
      second is awkward) so a mid-drag unmount doesn't leak listeners.
    - Bind `@mousedown="onScrubMouseDown"` on `.scrub` in place of the
      old `@click`.

  *Done when:* a simulated drag (mousedown → move through several
  intermediate positions while held → mouseup) shows `currentTime`
  tracking each intermediate position, not just jumping once on release;
  a plain click-without-moving still seeks correctly (unchanged
  behavior); dragging with no resolved duration yet safely does nothing
  (no `NaN` assignment); no console errors.

## Verify

- No test runner configured; UI drag-interaction fix - rides on browser
  evidence.
- Repeat the exact `/debug` reproduction (simulated drag with
  intermediate position checks) and confirm `currentTime` now updates at
  each intermediate step, not just on release.
- Manual check: open `/study`, click-and-drag the scrub bar back and
  forth a few times before releasing, confirm the progress fill and time
  readout track the cursor live, and the video ends up at the actual
  release position.
- `bun run build` clean.

Verified via Playwright: repeated the exact `/debug` reproduction and
confirmed `currentTime` now tracks every intermediate drag position
(previously `0` until release); confirmed a plain click still works
unchanged; confirmed the progress-bar fill and displayed time both
update live during a drag; confirmed a mid-drag unmount (navigating away
while still holding the mouse down) produces no errors.
