# Fix: Retry a broken local download, and fall back to audio automatically

**Type:** Fix
**Status:** verified

## The problem

1. **No retry for a broken local file.** `StudyMediaPlayer`'s playback-error
   fallback (feature 42) only offers a "Download video/audio" button for a
   kind that has **no** local path yet (`canDownload` in `useCardDownloads.ts`
   requires `!localPath`). If a card's local video (or audio) file goes stale
   - deleted or moved out of the configured media library folder, while the
   DB row still points at it and still has a working `animethemesVideoUrl` /
   `animethemesAudioUrl` - no button shows at all for that kind. The only
   recovery today is a manual detour: open Edit, click "Clear" (feature 27),
   then download again. This is the "Couldn't play this clip" screen with
   only a "Download audio" button and nothing for video shown in the bug
   report - the card's local video file is stale, but nothing offers to fix
   it.
2. **No fallback to audio when video is broken.** `mediaKind` (the computed
   that decides whether the `<video>` or `<audio>` element mounts) always
   prefers video whenever `hasVideoSource` is true, with no reaction to a
   real playback error. So once video fails, the player keeps trying to show
   it - even after the audio fallback button in (1) successfully downloads a
   perfectly good audio file, because nothing ever moves `mediaKind` off
   `"video"`.

## The fix

- **`app/composables/useCardDownloads.ts`**
  - Added `canRetryDownload(card, kind)`: true when that kind already has a
    local path **and** still has a remote `animethemes*Url` reference (the
    "local file went stale but a remote copy exists" case) - the mirror
    image of `canDownload`'s `!localPath` check.
  - Widened `hasAnyDownloadableSource` to also count a retryable kind, so the
    download section still renders when only a retry applies, not a plain
    download.

- **`app/components/study/StudyMediaPlayer.vue`**
  - Added a `videoBroken` ref, set in `onError()` when the element that just
    errored is the video element (`mediaKind.value === "video"` at that
    moment). Reset whenever the displayed card changes (`watch(() =>
    props.card.id, ...)`, needed because `CardPreviewModal` reuses one
    instance across cards without remounting) and after a video redownload
    lands a fresh local file.
  - `mediaKind` also resolves to `"audio"` when `videoBroken` is true and an
    audio source (local or remote) exists. This reuses the existing
    `watch(mediaKind, ...)` safety net (already pauses/stops the outgoing
    element and resets playback state before the DOM swaps) - the same
    mechanism that already existed for a `mediaKind` change after mount, so
    this doesn't reintroduce the overlapping-audio failure that got features
    18/32 abandoned.
  - Widened `retryDownload(kind)` to return the resolved local path (or
    `null`) instead of `void`.
  - Added `redownload(kind)`: PATCHes that kind's local path to `null` via
    `/api/cards` (the same call `StudyCardEditPanel`'s "Clear" button already
    makes), emits a new `local-path-cleared` event, then calls
    `retryDownload(kind)`. On a successful video redownload, clears
    `videoBroken` so the player prefers video again.
  - Error-veil template: for a kind where `canRetryDownload` is true (and
    `canDownload` is false), renders a "Retry" button wired to
    `redownload(kind)` where before nothing showed.
  - New emit: `"local-path-cleared": [{ kind: "video" | "audio" }]`,
    mirroring the existing `local-path-updated` shape.

- **Wiring the new event** - every place that already listened for
  `local-path-updated` got the sibling `local-path-cleared` too, so a page's
  own copy of the card doesn't keep a stale local path after it's cleared
  mid-retry:
  - `app/pages/study/index.vue` - the live player.
  - `app/pages/cards/index.vue` - the inspector-rail player.
  - `app/components/card/CardPreviewModal.vue` - folds it into its existing
    `updated` emit, so `app/pages/decks/index.vue` and `study/index.vue`'s
    history-preview `CardPreviewModal` usage needed no changes (they already
    handle `updated` generically).

**Must not break:** the documented "never change `audioOnly` reactively
after mount" behavior (untouched - `videoBroken` is a separate, independent
trigger with its own safety net); Hide Video's plain veil on a genuinely
video-capable card (untouched - `videoBroken` is only ever set by a real
playback error, never by the Hide Video toggle).

## Build steps

1. [x] **`useCardDownloads.ts` + test** - added `canRetryDownload`, widened
   `hasAnyDownloadableSource`, with unit tests for both alongside the
   existing ones in `useCardDownloads.test.ts`.
   Done when: `bun run test` covers the new function and passes.

2. [x] **`StudyMediaPlayer.vue`** - `videoBroken` tracking, the `mediaKind`
   fallback, widened `retryDownload`, new `redownload` + `local-path-cleared`
   emit, and the error-veil "Retry" button.
   Done when: reproducing a broken local video (delete/rename the file on
   disk, or point a card's `localVideoPath` at a nonexistent path) on a card
   that still has a remote video reference shows a "Retry" button, and
   clicking it restores playback. On a card whose video is broken with no
   video fallback but a real audio source (local or remote), the player
   switches to audio automatically with no error veil shown - Hide Video's
   existing plain-veil behavior on a normal video-capable card is unchanged.

3. [x] **Wire `local-path-cleared`** through `study/index.vue`, `cards/index.vue`,
   and `CardPreviewModal.vue`.
   Done when: clicking Retry keeps that page's own card state (live study
   card, inspector selection, preview) in sync with the cleared-then-
   redownloaded value - no stale local path left behind after a retry.

## Verify

- On `/study` or a card's Preview (`/cards`, `/decks`), force a stale local
  video on a card that also has a working remote video reference (edit the
  DB row directly, or delete the downloaded file from the media library
  folder). Confirm the error veil now shows a "Retry" button for video, and
  that clicking it clears the stale path, redownloads, and plays.
- Do the same on a card whose only real fallback is audio (video broken, no
  usable video anywhere) and confirm the player silently switches to audio
  playback instead of showing the video error veil.
- Confirm a normal video-capable card with Hide Video toggled on still shows
  today's plain veil, unaffected.
- Run `bun run test`.

## Verification evidence

- `bun run test` - 166/166 passing, including two new `canRetryDownload` /
  `hasAnyDownloadableSource` test cases in `useCardDownloads.test.ts`.
- `bun run build` - clean, no type errors.
- Live manual verification against a real broken card in the dev database
  (id 12, whose local video file had genuinely gone missing from disk - the
  exact bug reported): confirmed the video-only case shows "Retry video" and
  wires through `PATCH /api/cards` (clear) then `POST /api/cards/download`
  correctly, including keeping the button's own page state in sync once the
  clear lands; confirmed a video failure with a working remote audio
  reference falls back to audio automatically with real playback and no
  error veil shown. The test card's database row was restored to its exact
  original state afterward.
