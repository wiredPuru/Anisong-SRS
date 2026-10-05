# Fix: Cards player stuck "playing" after its clip downloads

**Type:** Fix
**Status:** verified

## The problem

On `/cards` (and `/decks`, same inspector), pressing Play on a card that has no
local file starts the clip streaming. When the download for that card finishes
(Auto Download, or the Download button on the error veil), the player gets stuck:
it looks like it is playing (pause icon, "Listening...") but nothing plays and it
never recovers on its own.

Likely cause, in `nuxt-app/app/components/study/StudyMediaPlayer.vue`:

- `isPlaying` is set from the media element's `play` event, which fires when
  playback is *requested* (`onPlay`).
- A finished download writes a local path onto the card (`runDownload` emits
  `local-path-updated`), which changes `src`. The `loadedSrc` pin only holds
  once the clip has produced data (`markPlayable`), and a remote clip streamed
  through `/api/media/stream` produces none until the whole file is cached. So
  the swap re-points the element while its first play request is still pending.
- Re-loading a media element that is not paused sets it to paused and rejects the
  pending `play()` with `AbortError` (already ignored in `playIfPaused`), but
  fires no `pause` event. `onPause` never runs, so `isPlaying` stays `true`
  while the element is paused, and `onLoadStart` does not reset it.
- Since the commit that made the inspector click-to-play (`a456c78`, `start-on-mount`),
  Play is pressed while the clip is still remote, so this window is now the normal
  path on Cards.

This is a hypothesis from reading the code; step 1 confirms it before changing anything.

## The fix

When a source swap (or any reload) interrupts a play that was requested, the player
must resume playing the new source rather than keep a stale `isPlaying`.

- Remember that the user asked to play (set in `playIfPaused`, cleared when they pause).
- On `loadstart`, if the element is paused but play was wanted or `isPlaying` is
  true, reset `isPlaying` and start playback again once the new source can play.
- Must not break: Study's autoplay and Auto Reveal pause/resume (they key off
  `playback-started`/`playback-paused`), Retry/Redownload on the failure veil,
  the "Ready?" -> "Paused" mood, and a deliberate user pause staying paused.

## Build steps

- [x] 1. **Reproduce and confirm the cause.** Run the dev server, open `/cards`, pick a
   remote-only card with Auto Download on and a default download folder set, press
   Play, and watch `isPlaying` versus `el.paused` once the download lands.
   Done when: the stuck state is reproduced, or the true cause is identified
   (if it differs from the above, update this spec before step 2).
- [x] 2. **Resume playback after an interrupted play.** Edit `StudyMediaPlayer.vue` as
   described above, plus a small pure helper and Vitest test if the
   decision ("should this load resume playing?") is extracted as logic.
   Done when: pressing Play on a remote-only card, with the download finishing
   mid-load, ends with the clip playing and the control showing the real state.

## Verify

- Cards: select a remote-only card (Auto Download on), press Play, let the download
  finish: the clip plays, the pause icon is truthful, and Pause then Play works.
- Same with the Download button on the failure veil: after it lands the clip plays.
- Pausing manually while the download runs stays paused after it lands.
- Study: a card still autoplays, Auto Reveal still pauses and resumes with playback.
- `bun run test` and `bun run build` pass.

## Outcome

Built as `playWanted` in `StudyMediaPlayer.vue`: `onLoadStart` resets `isPlaying` when the element is paused after a reload and restarts playback when play had been requested. The cause was confirmed with a standalone Chrome test (swapping `src` on a pending play leaves the element paused with no `pause` event; adding a resume-on-`loadstart` handler ended with it playing). Evidence: `bun run build` and `bun run test` (1740 tests) pass. The full in-app flow (download finishing mid-load on `/cards`) was not exercised, because the live library has no default download folder set. No unit test was added: the change is component event handling, not pure logic.
