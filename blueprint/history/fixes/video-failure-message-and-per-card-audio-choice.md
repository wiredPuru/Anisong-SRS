# Fix: Say when video failed, and make the audio fallback a per-card choice

**Type:** Fix
**Status:** verified

## The problem

The `retry-broken-download-and-audio-fallback` fix (merged 2026-09-12) made
`StudyMediaPlayer` fall back to audio automatically the moment a video errored.
That swap is silent and it is the app's decision, not the user's:

1. **The failure is never reported.** `onError()` sets `errorMessage`, but
   flipping `mediaKind` to `"audio"` recomputes `src`, and the existing
   `watch(src, ...)` clears `errorMessage` in the same tick. The error veil
   never renders. Video just disappears and audio plays instead, with no way
   to tell a broken video apart from a card that never had one (feature 44's
   spinning cover record looks identical either way).
2. **There is no way back to video for that card.** Once `videoBroken` is set,
   `mediaKind` is pinned to audio for as long as the component stays mounted.
   Nothing offers to re-attempt the video or redownload it, because the veil
   that carries those buttons is exactly what got cleared.
3. **Audio is the app's call, not a choice.** Switching to audio should be a
   deliberate per-card decision. The only thing that switches playback to audio
   for a whole session is the Audio Only setting (feature 43), which already
   has its own path through `props.audioOnly`.

## The fix

Keep the video element mounted on a failure, show what happened, and let the
user pick: re-attempt the video, redownload it, or drop to audio for this card
only.

- **`app/components/study/StudyMediaPlayer.vue`**
  - `videoBroken` stops feeding `mediaKind`. It now only marks "the video for
    this card failed", which selects the veil's message and reveals the actions
    below.
  - New `audioFallbackChosen` ref, set only by an explicit "Use audio for this
    card" click. It is the one new input to `mediaKind`:

        if (props.audioOnly && hasAudioSource.value) return "audio";
        if (audioFallbackChosen.value && hasAudioSource.value) return "audio";
        return hasVideoSource.value ? "video" : "audio";

    Both refs reset on `watch(() => props.card.id, ...)`. On `/study` the
    component also remounts per `presentationKey`, so a failed card that
    resurfaces later in the same session attempts video again. That is the
    "for that card, not for the session" scope.
  - `onError()` sets a kind-specific message: `"Video failed to load."` when
    `mediaKind` is video, today's `"Couldn't load this clip."` otherwise.
  - `watch(src, ...)` clears `videoBroken` alongside `errorMessage`, so a
    successful redownload or a card change resets the failure state. The
    now-redundant `videoBroken.value = false` line inside `redownload()` goes
    away with it.
  - Error-veil actions, when `videoBroken` is true:
    - **"Try again"** - clears the error and calls `videoRef.load()` to
      re-attempt the current source. Always available, and the cheapest fix
      for the transient CDN failure that 80 of the 199 cards (remote-only
      video) are exposed to.
    - **The existing download buttons, unchanged in behavior.** The stale-local
      one is relabeled from "Retry video" to **"Redownload video"** so it does
      not collide with "Try again"; "Download video" keeps its label.
    - **"Use audio for this card"** - shown only when `hasAudioSource` is true.
      It must sit outside the `v-if="hasAnyDownloadableSource(card)"` block
      that wraps the download section, so it still renders for a broken local
      file that has no remote reference to download.

**Must not break:**

- **Audio Only (feature 43)** stays the only session-wide switch, on its own
  `props.audioOnly` path, still resolved once before mount.
- **A card with genuinely no video reference** keeps today's behavior: audio
  plus the cover record, no veil, no interruption. Decided 2026-09-13; the veil
  is for real failures only, so deliberately stripping a card's video path
  (feature 27) does not start nagging on every presentation.
- **Hide Video (feature 10)** keeps its plain veil on a video-capable card.
- The stale-local clear-then-redownload flow and its `local-path-cleared`
  wiring into `/study`, `/cards`, and `CardPreviewModal` are untouched.

## Build steps

1. [x] **State and message** - drop the automatic swap, add `audioFallbackChosen`,
   make the failure message kind-specific, and reset `videoBroken` in
   `watch(src, ...)`.
   Done when: a card whose local video file is missing shows "Video failed to
   load." on the error veil and stays in video mode instead of silently
   playing audio. With Audio Only on, that same card goes straight to audio
   with no veil, exactly as before.

2. [x] **Veil actions** - add "Try again" and "Use audio for this card", relabel
   the stale-local button to "Redownload video".
   Done when: "Try again" re-attempts the video and clears the veil on
   success; "Use audio for this card" plays that card's audio and is gone by
   the next card (video is attempted again); "Use audio for this card" also
   appears for a broken local file with no remote reference, where no download
   button renders at all.

## Verify

Card 12 (`Re:Zero` ED2, "STRAIGHT BET") is a live reproduction: its
`localVideoPath` points at a file that no longer exists on disk, and it has
both a remote video and a remote audio reference.

- On `/cards?q=STRAIGHT BET` (inspector player) or `/study`, with Playback mode
  on Auto: confirm the veil reads "Video failed to load." and offers Try again,
  Redownload video, and Use audio for this card.
- Click "Use audio for this card": audio plays with the cover record. Move to
  another card and back, and confirm video is attempted again rather than the
  choice sticking.
- Turn Audio Only on in `/settings` and confirm that card plays audio
  immediately with no veil.
- Confirm a healthy video card is unaffected, including with Hide Video on.
- Run `bun run test` and `bun run build`.

No new unit test: the change is a component computed and its veil, which the
Testing section of `coding-standards.md` puts out of scope for unit tests
(UI surfaces ride on browser plus build evidence). The composable logic this
touches, `canDownload` / `canRetryDownload`, is already covered.

## Verification evidence

Verified 2026-09-13 against card 12 in the dev database, whose `localVideoPath`
points at a file that is genuinely absent from the media library folder.

- **Failure is reported.** With Playback mode on Auto, the veil shows "Video
  failed to load." plus Try again, Use audio for this card, Redownload video,
  and Download audio. Before this fix the same card silently played audio with
  no message at all.
- **Try again, still-broken source.** Re-issued a real second request for the
  same path (`GET /api/media?path=...` returning 404 twice in the request log)
  and re-reported the failure rather than clearing to a blank state.
- **Try again, recovered source.** A file was moved into that path while the
  veil was showing; clicking Try again cleared the veil and loaded the video
  (duration resolved to 1:30). The file was removed afterward.
- **Use audio for this card.** Switched playback to the remote audio stream
  (`GET /api/media/stream?url=...a.animethemes.moe/ReZero-ED2.ogg` -> 206,
  duration 4:07) with the veil gone.
- **Per-card scope.** After choosing audio, selecting a different card and
  returning attempted video again and re-reported the failure, so the choice
  does not carry across cards.
- **Audio Only unchanged.** With `playbackMode` set to `audioOnly`, the same
  card loaded audio immediately with no veil. The setting was restored to
  `auto` afterward.
- **Healthy card unaffected.** A card with a present local video loaded
  normally with the standard paused veil.
- `bun run test` - 166/166 passing. `bun run build` - clean.

All test state was restored: the database row, the `playbackMode` setting, and
the media library folder were left exactly as they were found.
