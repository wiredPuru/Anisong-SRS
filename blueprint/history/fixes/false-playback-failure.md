# Fix: Stop reporting a failure for a clip that is playing fine

**Type:** Fix
**Status:** verified

## The problem

On `/study`, a card shows the failure veil ("Couldn't load this clip." with a
"Download audio" button) while the clip is in fact healthy: the cover record is
already on screen, and pressing `S` plays it normally. The veil never clears,
because nothing in `StudyMediaPlayer` can retract a failure once it is set.

Three separate defects combine into that, in `app/components/study/StudyMediaPlayer.vue`:

1. **A background download swaps the live source, and the resulting abort is
   reported as a failure.** Auto Download (feature 59) calls `retryDownload()`
   on mount. When it lands it emits `local-path-updated`, `/study`'s
   `onLocalPathUpdated` replaces `currentCard`, and `src` flips from
   `/api/media/stream?url=...` to `/api/media?path=...` **on the element that is
   already loading or playing**. The browser tears that load down. `watch(src, ...)`
   is a pre-flush watcher, so it clears `errorMessage` *before* the element's
   `src` attribute is patched; any `error` the teardown produces therefore lands
   *after* the clear and sticks. The new local source then loads perfectly, which
   is why the record appears and playback works with the veil still up.

2. **`onError()` trusts every error event.** It reads `mediaKind.value` instead of
   the element that fired, and never looks at `el.error.code`. So an error
   belonging to an element that is no longer mounted (the `<video>` right after
   "Use audio for this card", or the previous card's element inside
   `CardPreviewModal`, which does not remount per card) and an aborted load
   (`MEDIA_ERR_ABORTED`, what a source swap or a fast card advance produces) both
   land as a permanent "this clip is broken" verdict.

3. **The verdict is never retracted, and its remedies are not scoped to what
   failed.** Only a `src` change or a card change clears `errorMessage`.
   `canplay`, `loadeddata`, and `playing` (the browser proving the element works)
   leave the veil up. The veil's download block is gated on
   `hasAnyDownloadableSource(card)`, so a **video** failure renders "Download
   audio" beside it, which is the reported "it says download audio, but the audio
   is fine". "Try again" is gated on `videoBroken`, so an audio failure gets no
   retry at all, only a download. And the play button is `:disabled="!!errorMessage"`
   while the `S` hotkey calls `togglePlay()` unguarded, which is how a working
   clip gets discovered behind a dead button.

## The fix

Make the failure state describe the element that is actually mounted right now,
and let a background download fill the library without disturbing a source that
is already working.

- **Never disturb a loaded source.** Pin the source the element actually loaded
  (set on `loadeddata`) and keep serving it for the rest of this presentation, so
  a `local-path-updated` from Auto Download cannot reload a live element. Release
  the pin on a card change, a `mediaKind` change, an explicit retry, and on a real
  failure, so feature 42's manual "Download video/audio" recovery still swaps a
  broken source out.
- **Only trust an error from the active element.** Ignore an event whose
  `target` is not `activeEl`, and ignore `MEDIA_ERR_ABORTED`. Record which kind
  failed rather than inferring it from `mediaKind` at handler time.
- **Let the veil heal.** Clear the failure as soon as the active element reaches
  `canplay` / `loadeddata` / `playing`. A failure verdict must never outlive an
  element that can play, whatever produced it.
- **Offer only what is relevant.** Scope the veil's actions to the kind that
  failed, and give audio the same "Try again" video already has.

**Must not break:**

- **Feature 42's download fallback.** A genuinely broken source must still show
  the veil, and a successful download from it must still swap the source in and
  clear the failure.
- **Feature 59's Auto Download** keeps downloading in the background; only the
  mid-card source swap goes away. The card's stored paths are still updated, so
  the next presentation uses the local file.
- **"Use audio for this card"** (`audioFallbackChosen`) keeps its per-card scope,
  and **Audio Only** (feature 43) stays the only session-wide switch.
- The stale-local clear-then-redownload flow and its `local-path-cleared` wiring
  into `/study`, `/cards`, and `CardPreviewModal` are untouched.
- `CardPreviewModal`, which keeps one player mounted across cards, must not carry
  a previous card's failure into the next one.

## Build steps

1. [x] **Trust only the active element, and let the veil heal.**
   `onError(event)` ignores an event from a non-active element and a
   `MEDIA_ERR_ABORTED` code, and records the failed kind (replacing
   `videoBroken`'s double duty). Clearing moves onto proof of health:
   `canplay` / `loadeddata` / `playing` on the active element clear the failure.
   Add the missing `@loadeddata` binding to `<audio>`.
   Done when: a card that reaches `canplay` never shows the veil, including one
   whose auto-download lands during its initial load; a card whose source really
   is missing still shows "Video failed to load." with its actions.

2. [x] **Stop a background download from reloading a working clip.**
   Pin the loaded source per presentation, released on card change, `mediaKind`
   change, explicit retry, and failure.
   Done when: with Auto Download on, a remote clip keeps playing through its own
   download completing (position and play state unchanged, no reload in the
   network log) and the card's local path is still saved for next time; a failed
   clip still recovers when its download finishes.

3. [x] **Scope the veil's actions to what failed.**
   Drive the actions from the failed kind: a video failure offers Try again,
   Use audio for this card, and the video download or redownload only; an audio
   failure offers Try again and the audio download or redownload only. Enable the
   play button during a failure and have `togglePlay()` re-attempt the load first,
   so it matches what `S` already does.
   Done when: a video failure no longer renders "Download audio"; an audio
   failure offers "Try again"; the play button on a failure behaves exactly like
   the `S` hotkey.
   Also repairs **F-16** (folded in here rather than taken as its own step, since
   it is the same code): `togglePlay()`'s play rejection set `errorMessage`
   without a `failedKind`, so this step's kind-scoped actions would still have
   rendered an actionless veil on that path. The rejection now records the kind,
   and ignores an `AbortError` caused by the step's own `retryLoad()`.

## Verify

- **The reported case.** Auto Download on in `/settings`, Playback mode on Auto,
  a card whose clip is remote-only. Load it on `/study` and let the download
  finish. Expect: no veil at any point, the record/video keeps its position and
  play state, and `/api/media/stream` is not re-requested as `/api/media` mid-card.
  Confirm the card's local path was saved, and that reopening it plays from the
  local file.
- **A real failure still reports.** Card 12 (`Re:Zero` ED2, "STRAIGHT BET") has a
  `localVideoPath` pointing at a file that is absent from disk, plus remote video
  and audio references. Expect "Video failed to load." with Try again, Use audio
  for this card, and Redownload video - and **no** "Download audio".
- **Audio failure.** Point a card's audio at a broken source with no video, and
  confirm the veil offers Try again alongside the audio download.
- **Recovery still works.** From that veil, run the download and confirm the
  source swaps in and the veil clears.
- **Preview.** Open two cards in a row in `CardPreviewModal` from `/cards`, the
  first one broken, and confirm the failure does not carry into the second.
- `bun run test` and `bun run build`.

No new unit test: this is component state and its veil, which the Testing section
of `coding-standards.md` puts out of scope for unit tests (UI surfaces ride on
browser plus build evidence). The download predicates it re-uses
(`canDownload` / `canRetryDownload`) are already covered.

## Noted, not in scope

`serveRangedFile` (`server/utils/rangedFile.ts`) answers `416` when a range's
end is at or past the file size. RFC 9110 says a last-byte-pos at or beyond the
length must be clamped to the remainder, not rejected, so a spec-legal request
currently fails. Nothing here proves a browser is sending one, so it is left
alone rather than folded into this fix.
