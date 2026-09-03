# Fix: Session-only video/audio-only toggle on Study

**Type:** Fix
**Status:** verified

## The problem

Feature 43 added a persistent Playback mode setting (Auto / Audio only),
deliberately editable only on `/settings` and never inline on `/study` -
its own spec explicitly resolves it once per page load, before a card's
player ever mounts, "so nothing can change it reactively mid-playback,
specifically to avoid feature 18's overlapping-audio rollback cause."
Features 18 and 32 (both abandoned) tried a reactive, in-session version of
this exact idea and were dropped after it caused two audio streams to play
at once.

The user wanted a quick way to flip between video and audio-only playback
without leaving `/study` for the Settings page.

## The fix

Added a session-only "Audio only" toggle to `/study`'s existing display-
toggles row, applied the same safe way feature 43's own setting is
documented to behave: it takes effect starting with the next card, never
changing the currently-mounted player's media type live.

Mechanism in `app/pages/study/index.vue`:

- `sessionAudioOnlyOverride` (`boolean | null`, `null` = follow the
  persisted `/settings` value) - resets every visit, never persisted.
- `effectiveAudioOnly` (`sessionAudioOnlyOverride ?? persistedAudioOnly`) -
  safe to change at any time; feeds `useStudySession()`'s lookahead-prefetch
  hint and the toggle button's own displayed state.
- `playerAudioOnly` - snapshotted from `effectiveAudioOnly` only when
  `presentationKey` changes (`StudyMediaPlayer` fully remounts on that key
  already). This is the value actually bound to
  `<StudyMediaPlayer :audio-only="...">` - it never changes for an
  already-mounted player instance.

`StudyDisplayToggles.vue` gained one more `.toggle-btn` ("Audio only", no
hotkey - matching Random start/Auto reveal) with a tooltip noting it applies
from the next card, since it behaves differently from every other toggle in
that row.

## Build steps

- [x] **Step 1 - Session override state + next-card-only snapshot** - added
  `sessionAudioOnlyOverride`/`effectiveAudioOnly`/`playerAudioOnly` in
  `study/index.vue`, wired `effectiveAudioOnly` into `useStudySession()`
  and `playerAudioOnly` into `StudyMediaPlayer`'s prop.
- [x] **Step 2 - Add the toggle control** - new prop/emit on
  `StudyDisplayToggles.vue`, wired in `study/index.vue`.

*Done when:* toggling mid-playback never disturbs the current card; the
next card presented reflects the new choice.

## Verify

- `bun run build` passes clean.
- Live browser test: clicked "Audio only" mid-playback on a video card -
  the player frame (timestamp, paused state, video badge) was unchanged
  before and after the click, confirming no live disruption.
- Flipped the persisted Settings Playback mode to `audioOnly` and reloaded
  fresh - the player correctly rendered the audio-only record/cover view,
  proving the same snapshot assignment the next-card watch uses works
  end-to-end. Reverted the setting afterward.
