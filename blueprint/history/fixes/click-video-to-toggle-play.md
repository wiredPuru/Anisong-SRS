# Fix: Clicking the video/veil toggles play, not just the dedicated button

**Type:** Fix
**Status:** verified

## The problem

`StudyMediaPlayer.vue`'s `<video>` element (and the veil that covers it
whenever paused or audio-only) has no click handler at all - only the
dedicated `.play-btn` toggles playback. Standard video player UX (YouTube,
Vimeo, native browser controls) lets you click anywhere on the player
area to toggle play/pause, not just a small dedicated button.

## The fix

Wire `togglePlay` (already used by `.play-btn`) onto the two areas a user
would naturally click:

- The `<video>` element itself - reachable by click only while it's
  actually visible, i.e. while playing (the veil covers it otherwise), so
  in practice this covers "click the playing video to pause it."
- The non-error veil (`v-else-if="showVeil"`, covering paused and
  audio-only states) - covers "click the paused/audio veil to resume,"
  the natural other half of a full toggle. The **error veil**
  (`v-if="errorMessage"`) is deliberately excluded - there's nothing to
  toggle when a clip failed to load.

Add `cursor: pointer` to `.media-el` and to the two non-error veil
variants (`.paused-veil`, `.audio-veil`) so both areas visibly read as
clickable, matching the existing convention on `.play-btn`/`.scrub`. Not
added to the base `.veil` or `.error-veil` classes.

**Must not break:** `<audio>` stays untouched - it's `display: none`
(`.hidden-audio`) and can never receive a click itself; audio-only cards
are already covered through the audio-veil click handler instead. The
`.theme-badge` and `.expand-btn` sit as separate sibling elements inside
`.player-frame`, not ancestors of the video/veil, so this change can't
accidentally make clicking them also toggle playback.

## Build steps

- [x] **Step 1 - Add click-to-toggle on the video and veil**
  - `nuxt-app/app/components/study/StudyMediaPlayer.vue`:
    - Add `@click="togglePlay"` to the `<video>` element.
    - Add `@click="togglePlay"` to the `v-else-if="showVeil"` div (not
      the `v-if="errorMessage"` error veil).
    - CSS: add `cursor: pointer;` to `.media-el`, and to
      `.paused-veil`/`.audio-veil` (not the base `.veil` or
      `.error-veil`).

  *Done when:* clicking the video while it's playing pauses it; clicking
  the veil while paused (or on an audio-only card) resumes playback;
  clicking the error veil does nothing (no toggle, no console error); the
  cursor shows a pointer over the video/paused-or-audio-veil but not over
  the error veil; existing controls (`.play-btn`, `.scrub`, hotkeys)
  keep working unchanged.

## Verify

- No test runner configured; two click bindings + cursor styling - rides
  on browser evidence.
- Manual check: open `/study`, play a video card, click directly on the
  video image and confirm it pauses; click the resulting paused veil and
  confirm it resumes; repeat with Hide Video or an audio-only card
  (clicking the audio veil toggles play/pause); force an error state (or
  reason about the code path) and confirm the error veil doesn't respond
  to clicks.
- `bun run build` clean.

Verified via Playwright: started playback via the dedicated button,
clicked the video and confirmed it paused, confirmed the paused veil
appeared, clicked it and confirmed playback resumed, confirmed
`.media-el`'s cursor is `pointer`, and re-confirmed the dedicated play
button still works afterward (no regression). No console errors. Not
separately tested: an audio-only card's veil (same code path, different
CSS class, so expected to behave identically) and a live error state
(confirmed instead by code review that the error veil has no click
binding).
