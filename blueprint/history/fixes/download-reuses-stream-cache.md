# Fix: Downloading a card should reuse the stream cache, not re-fetch from animethemes.moe

**Type:** Fix
**Status:** verified

## The problem

Feature 41 added a local disk cache (`nuxt-app/.data/stream-cache/`) for
remote animethemes.moe clips played directly from the CDN - playing or
previewing a not-yet-downloaded card's video/audio already pulls the full
file through `GET /api/media/stream`, which caches it keyed by a hash of the
remote URL (`resolveCachedPath()` in `server/utils/streamCache.ts`).

But `downloadMediaFile()` (`server/utils/mediaDownload.ts`), used by both the
per-card "Download video/audio" action (feature 8) and the artist bulk
"Download all" (feature 37b), always fetched straight from the remote URL
over the network again, ignoring the cache entirely. If you were just
watching a card's video (so the exact bytes were already sitting in the
stream cache) and then hit Download, the app re-downloaded the whole file
from animethemes.moe instead of reusing what it already had on disk.

## The fix

Before `downloadMediaFile()` opens a network connection, it now checks
whether the stream cache already has this exact URL cached
(`cachedFilePathIfPresent()`, a new peek-only export from `streamCache.ts`
that never fetches) and, if so, copies that cached file straight into the
download destination instead of hitting the network.

- Copies rather than moves/deletes the cached file - the cache entry is left
  in place for the existing LRU eviction to reclaim later. This avoids two
  real risks a move would carry: an in-flight `serveRangedFile` read on that
  exact path (a concurrent playback), and Windows file-locking, which can
  reject a rename/delete of a file another process still has open (this app
  ships a Windows packaged build - feature 48).
- Falls through to the existing network-fetch path unchanged if there's no
  cached copy, or if the copy attempt itself fails - never a hard error,
  matching how every other degrade-gracefully path in this file already
  behaves.
- No change to the download route, the progress-event wire format, or the
  artist bulk download loop. A cached-copy download reports one `progress`
  event at 100% rather than a chunked stream, since a local file copy has no
  meaningful partial-progress granularity.
- `cachedFilePathIfPresent()` reuses the exact same host allowlist
  (`parseAllowedStreamUrl()`) the stream route already enforces.

## Build steps

- [x] **Step 1 - Reuse the stream cache in `downloadMediaFile()`** - added
  `cachedFilePathIfPresent(url)` to `streamCache.ts`; `mediaDownload.ts`
  checks it first and `copyFile()`s on a hit, falling through to the
  existing fetch-and-stream code on a miss. *Done when:* downloading a
  cached card completes near-instantly via local copy; an uncached card
  still downloads exactly as before.

## Verify

- `bun run build` passes clean.
- Live end-to-end test against the real dev server and animethemes.moe:
  - Populated the cache for a card's audio via `/api/media/stream` (2.6s,
    3.6MB), then downloaded it via `/api/cards/download` - completed in
    0.13s with a single 100% progress event, byte-identical file size, card
    row updated correctly.
  - Downloaded a different card's audio with nothing cached - unchanged
    chunked network fetch, 2.6s, ~90 progress events.
  - Both test downloads and their DB mutations were reverted afterward.
