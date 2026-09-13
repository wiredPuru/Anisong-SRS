# Fix: Show a real loading state while a clip buffers

**Type:** Fix
**Status:** verified

## The problem

Pressing play on a card whose clip is not local yet leaves a completely blank
player: black frame, no progress bar, `0:00 / 0:00`, and a pause icon that
claims playback is underway. Nothing distinguishes "still fetching" from
"broken" until, eventually, either the clip starts or the error veil appears.

All of it is in `nuxt-app/app/components/study/StudyMediaPlayer.vue`, shared by
`/study` and `CardPreviewModal`.

1. **`isPlaying` means "playback requested", not "playback happening".**
   `onPlay()` sets it from the `play` event, which fires the instant `play()`
   is called, while the clip is still being fetched. `showVeil` is
   `quizType === "audio" || !isPlaying`, so in video mode the veil drops on
   that same event and exposes a `<video>` with no decoded frames: a black
   rectangle. The component already knows the difference - `onPlaying()` exists
   for exactly this reason, and its comment says so - but only emits
   `playback-started` from it and never feeds it back into its own UI.
2. **There is no loading state to show.** The element is wired to `play`,
   `playing`, `pause`, `timeupdate`, `loadedmetadata`, `loadeddata`, `seeked`,
   and `error`, but not `loadstart`, `waiting`, `stalled`, or `canplay`, so
   "fetching" and "playing" are indistinguishable internally.
3. **The controls give no signal either.** `duration` stays 0 until
   `loadedmetadata`, so `progressPercent` is 0 and the time reads `0:00 / 0:00`
   - the same thing a dead player shows.
4. **The blank window is long, not momentary.** A remote clip is served by
   `GET /api/media/stream`, which awaits `resolveCachedPath()`
   (`server/utils/streamCache.ts`) - that downloads the **entire** file into
   the stream cache before `serveRangedFile` writes a single byte. The
   browser's request just stays pending for the whole download, bounded only
   by `DOWNLOAD_TIMEOUT_MS` (30s, `server/utils/mediaDownload.ts`). So a slow
   or unreachable CDN produces up to 30 seconds of black screen before the
   route 502s and the media element finally fires `error`.
5. **The record spins through it.** In cover-art mode `.record-disk` binds
   `spinning` to `isPlaying`, so an audio card's record spins silently while
   nothing has loaded.

The error veil itself works once `error` actually fires (the
`video-failure-message-and-per-card-audio-choice` fix). The gap is everything
before that: the wait is invisible, and on a hung fetch it is a 30-second
invisible wait.

## The fix

Track whether the active element actually has playable data, keep the veil up
until it does, and say what is happening in it. Reuse the app's existing
slow-operation convention (`ActivityStatus` / `useActivityTimer`, from the
`clear loading and live progress feedback` fix) so the wait reports elapsed
seconds and flags itself as slow, rather than inventing a second spinner
style.

Must not break:

- `playback-started` stays emitted only from `playing` - `/study`'s auto-reveal
  timer keys off it.
- `mediaKind` stays non-reactive mid-playback (the feature 18 overlapping-audio
  constraint); this fix adds no new input to it.
- The error veil, its message, and its Try again / Use audio / Download /
  Redownload actions stay exactly as they are.
- Audio and cover-art veil visuals are unchanged whenever nothing is buffering.

## Build steps

### Step 1 - buffering state and a loading veil

- [x] Done

`StudyMediaPlayer.vue` only.

- Add `isBuffering` ref, driven by real media events on both `<video>` and
  `<audio>`: `loadstart` and `waiting` and `stalled` set it true; `canplay`,
  `playing`, and `error` set it false. Reset it alongside the other per-card
  state in `watch(src, ...)` and `watch(mediaKind, ...)`.
- `showVeil` gains `|| isBuffering.value`, so the frame is never bare while the
  clip is still loading.
- Inside the veil, when `isBuffering` is true, render `<ActivityStatus>` with a
  label naming the kind being loaded (video or audio) in place of the
  `Listening... / Paused` text, shown for cover-art cards too (today that text
  is suppressed under `showCoverArt`).
- `.record-disk`'s `spinning` class gates on `isPlaying && !isBuffering`.

**Done when:** pressing play on a card with a remote, not-yet-cached clip keeps
the veil up with a visible "Loading video..." (or audio) message and a
ticking elapsed-seconds counter, which disappears the moment playback actually
starts; a card whose clip is already local still goes straight to playback with
no visible loading flash; an audio card's record does not spin until sound
starts.

### Step 2 - offer recovery without waiting out the timeout

- [x] Done

- Reuse `useActivityTimer`'s `isSlow` (15s of no progress) already surfaced by
  `ActivityStatus`, and when the load is slow render the two zero-cost recovery
  actions the error veil already has - **Try again** (`retryVideoLoad`) and, if
  `hasAudioSource`, **Use audio for this card** (`audioFallbackChosen = true`)
  - inline in the loading veil. No download or redownload buttons here: those
  stay in the error veil, where a real failure is confirmed.
- Wording stays honest: the clip has not failed, it is just slow, so the veil
  keeps its loading message rather than adopting the error styling.

**Done when:** a clip that stalls past the slow threshold shows Try again and
Use audio for this card without having to wait out the 30s stream timeout;
clicking either does what it does from the error veil; a normal fast load never
shows them.

## Verify

1. `bun run dev` in `nuxt-app/`, go to `/study` with a card whose video is
   remote-only and not yet in `nuxt-app/.data/stream-cache/`. Press play. The
   frame shows a loading veil with elapsed seconds, not a black rectangle, and
   it clears when the clip starts.
2. Repeat on a card with a local file: playback starts with no lingering
   loading state.
3. Throttle or block `v.animethemes.moe` (DevTools offline, or point the card
   at an unreachable URL) and press play: the loading veil appears, then Try
   again / Use audio for this card appear at the slow threshold, then the
   existing error veil takes over when the route finally fails.
4. Same three checks through `/cards` Preview, which shares the component.
5. Audio-only card with cover art: the record stays still while buffering and
   starts spinning when audio starts.
6. `bun run test` and `bun run build` in `nuxt-app/`.
