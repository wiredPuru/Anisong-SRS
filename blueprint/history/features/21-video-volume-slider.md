# Feature: Video volume slider

**From build-plan:** feature 21
**Status:** verified

## Goal

Add a volume control to `StudyMediaPlayer` so the user can adjust playback
level instead of being stuck at whatever the browser/OS default is. Since
`/study` and `CardPreviewModal` both render the same `StudyMediaPlayer`
component, building it there covers both surfaces automatically. Unlike
Study's other session-only display toggles, the chosen level should feel
"sticky" across app restarts (localStorage), matching the precedent feature
20 set for the ambient toggle.

## In scope

- A volume slider inside `StudyMediaPlayer`'s existing control row (next to
  the play button and scrub bar).
- The slider controls whichever media element is actually mounted (`<video>`
  or `<audio>` - the two are mutually exclusive per `mediaKind`), so it works
  identically for a video quiz card and an audio-only one.
- The chosen level persists in `localStorage` and is restored on the next
  page load / component mount, on both `/study` and inside
  `CardPreviewModal`.
- Applies automatically on every mount, including when `mediaKind` changes
  (video <-> audio) and swaps the underlying DOM element.

## Out of scope

- A separate mute button/icon - a slider dragged to 0 already mutes; no
  need for a second control that does the same thing.
- Per-scope or per-card volume memory (e.g. one video always louder than
  another) - this is one global, app-wide level.
- Any change to `/study`'s or `CardPreviewModal`'s own toggle bars - the
  slider lives entirely inside `StudyMediaPlayer`, no new props needed from
  either parent.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add a persisted volume slider to `StudyMediaPlayer`** - a
  `volume` ref (0-1, default `1`) loaded from `localStorage` key
  `gaqSrs:playerVolume` on mount (same try/catch-and-fall-back-silently
  pattern `CardPreviewModal` already uses for `gaqSrs:previewAmbient`,
  clamped to `[0, 1]` and falling back to `1` on a missing/invalid stored
  value); a `<input type="range" min="0" max="1" step="0.01">` in the
  `player-controls` row; bind it to both the `<video>` and `<audio>`
  elements via `:volume="volume"` (a DOM property, so it reapplies whenever
  Vue mounts a fresh element on a `mediaKind` swap); persist to
  `localStorage` on every change. *Done when:* the slider renders on
  `/study` and inside a card's Preview modal, dragging it audibly changes
  the volume of whichever element is playing (video or audio-only card),
  and reloading the page (or reopening Preview) restores the last-set
  level.

## Files / areas

- `nuxt-app/app/components/study/StudyMediaPlayer.vue` (only file touched -
  `/study` and `CardPreviewModal` both pick up the change for free since
  they already render this component).

## Data / contracts

- None. Client-side only, persisted to `localStorage`, no schema or API
  change.

## Testing

- No test runner is configured in `AGENTS.md` (Commands section has no
  `test` entry), so this rides on browser/screenshot evidence rather than a
  unit test - consistent with how feature 20's ambient toggle (the same
  read/write-localStorage shape) was verified.
- Manual check: open `/study` with a video-quiz card due, drag the slider,
  confirm audible volume change and that the play/scrub controls are
  unaffected; repeat with an audio-only card; reload the page and confirm
  the slider (and actual playback volume) comes back at the same level;
  open a card's Preview modal from `/cards` and confirm the same slider and
  persisted level appear there too.

## Notes for the AI

- Bind `volume` as a DOM property (`:volume="volume"`), not an HTML
  attribute - `HTMLMediaElement.volume` has no attribute reflection, so a
  plain string attribute binding would silently do nothing.
- Reuse the existing `localStorage` try/catch pattern from
  `CardPreviewModal.vue` (`AMBIENT_STORAGE_KEY` / `ambientMode`) rather than
  inventing a new persistence helper - keep it inline in
  `StudyMediaPlayer.vue`, no new composable needed for one ref.
- Leave the `mediaKind` watcher (lines ~46-59, the one that pauses/resets
  on a video<->audio swap) untouched - volume is orthogonal to it and
  doesn't need to hook in there; a property binding on the newly-mounted
  element already reapplies the current volume without any extra JS.
- Follow the plain-CSS-var styling convention already used for
  `.scrub`/`.play-btn` in this file's `<style scoped>` block - no inline
  styles, no new design tokens needed.
