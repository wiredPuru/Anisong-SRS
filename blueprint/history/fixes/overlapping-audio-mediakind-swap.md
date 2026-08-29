# Fix: Overlapping audio on /study after a mid-playback video/audio swap

**Type:** Fix
**Status:** verified

## The problem

On `/study`, feature 18's `forcedMode` prop lets `StudyMediaPlayer`'s
`mediaKind` (which element/source mounts, `"video"` or `"audio"`) change
*after* the component has already mounted and playback has started - not
just at the start, like every other case that affects `mediaKind`.

The reason: `forcedMode` comes from `/study/index.vue`'s `scopeMode` ref,
which starts at `"auto"` and is filled in asynchronously by a `$fetch` to
`/api/study/scope-setting` (triggered by a `watch(scopeResult,
fetchScopeMode, { immediate: true })`). If a user hits play before that
fetch resolves, and the resolved mode differs from `"auto"` in a way that
changes which source type the card should use, `mediaKind` flips mid-play.

Vue's template (`v-if="mediaKind === 'video' && src"` /
`v-else-if="src"`) then swaps the mounted element - but nothing ever calls
`.pause()` on the outgoing `<video>`/`<audio>` element first. The old
element can keep playing in the background (browsers don't reliably stop
a media element's audio just because it left the DOM, especially mid
remote-stream playback) while the new element sits there, paused, showing
a stale `isPlaying: true` UI state. Clicking play again (a natural reaction
to what looks like nothing happening) then starts the *new* element too -
two audio streams at once.

Every other case that affects `mediaKind` (a different card, `hideVideo`)
either doesn't change it at all (`hideVideo` is deliberately independent of
`mediaKind`, only affects the visual veil) or happens via a full component
remount (`/study` keys `<StudyMediaPlayer>` by `presentationKey`, so a new
card is a fresh mount, not a live prop change). `forcedMode` is the only
path that can change `mediaKind` on an already-mounted, already-playing
component - so this bug is new, not something the original two-source
logic had to handle before feature 18.

## The fix

In `app/components/study/StudyMediaPlayer.vue`, add a `watch(mediaKind,
...)` that runs before the template re-renders (default `pre` flush,
which fires before the DOM patch that would unmount the outgoing
element): pause both `videoRef.value` and `audioRef.value` (whichever is
currently mounted - the other ref is already `null`), and reset
`isPlaying.value`, `currentTime.value`, and `duration.value` to their
initial state. This makes a `mediaKind` swap always start the new element
from a clean, paused state - matching what a user would expect after
switching source type - instead of leaving stale playback state or a
lingering audio source behind.

This must not touch `hideVideo`'s existing independence from `mediaKind`
(still governs only the visual veil, per the existing comment in the
file), and must not interfere with the existing `watch(ambientActive,
...)` - that watcher already reacts correctly to `mediaKind` changing
(since `ambientActive` is itself derived from `quizType`/`mediaKind`), so
no changes needed there.

## Build steps

- [x] **Step 1 - Pause and reset on a `mediaKind` swap** - add the
  `watch(mediaKind, ...)` described above to
  `app/components/study/StudyMediaPlayer.vue`. *Done when:* with a
  scope's mode PATCHed to a value that would flip `mediaKind` for a
  playing card (reproducing the race by pausing/resuming the dev server
  timing, or by directly testing that the watcher fires and pauses/resets
  correctly), no more than one media element is ever actually playing at
  once; a normal single-card session (`forcedMode` never changes after
  mount) is visually and behaviorally unchanged; `hideVideo` toggling
  still doesn't touch the mounted element. `bun run build` stays clean.

## Verify

In the browser: PATCH a deck's scope mode via `curl` right as you load
`/study` for that scope (to land inside the race window), hit play
immediately, and confirm you only ever hear one stream, with the veil/play
button state matching what's actually playing after any swap. A normal
session (mode set well before loading `/study`, no mid-play swap) should
look and sound exactly as it did before this fix.
