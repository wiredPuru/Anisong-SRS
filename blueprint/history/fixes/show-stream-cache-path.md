# Fix: Show the streamed-clip cache's folder path in Settings

**Type:** Fix
**Status:** verified

## The problem

Feature 41's stream cache (`server/utils/streamCache.ts`) writes cached
remote clips to a disk folder (`CACHE_DIR`) that was never surfaced anywhere
in the UI. `/settings`' `SettingsStreamCacheSizeControl` let you size the
cache but gave no way to know where it actually lives on disk.

## The fix

Exposed the cache's real folder path read-only next to the existing size
control on `/settings`.

- `streamCache.ts` exports `getStreamCacheDir()` returning the existing
  `CACHE_DIR` constant - no behavior change.
- `GET /api/media-library` now includes `streamCachePath`.
- `SettingsStreamCacheSizeControl.vue` takes a new `path` prop and renders
  it as a small read-only "Cache location: `<path>`" line under the size
  input.

## Build steps

- [x] **Step 1 - Surface the cache path** - added `getStreamCacheDir()`,
  wired it through `/api/media-library` and into
  `SettingsStreamCacheSizeControl.vue`. *Done when:* `/settings` shows the
  stream cache's actual on-disk folder path next to its size control.

## Verify

- `bun run build` passes clean.
- `curl localhost:3000/api/media-library` returned
  `"streamCachePath": "/Users/lu/Developer/GAQ_SRS/nuxt-app/.data/stream-cache"`,
  matching the real cache folder.
- Screenshot of `/settings?section=cache` confirms the path renders
  correctly under the size control.
