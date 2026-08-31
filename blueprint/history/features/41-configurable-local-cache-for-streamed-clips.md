# Feature: Configurable local cache for streamed clips

**From build-plan:** feature 41
**Status:** verified

## Goal

Remote (animethemes.moe) video/audio clips are currently played straight from
the CDN on every playback, with no local caching. A failed card sits in Leitner
box 1 and keeps resurfacing immediately, so its clip can be re-fetched from the
CDN over and over in the same session. This feature adds a size-capped local
disk cache (default 1GB, configurable in Settings): the first time a remote
clip is played it's saved to disk server-side, and every later play of that
same clip is served from the local copy instead of re-hitting the CDN.
Oldest-unused entries are evicted once the cache is full. On top of that, the
app prefetches ahead of the queue: as soon as a card is loaded (in Study or
Preview), it kicks off a background fetch for its own remote clip, and in
Study it also prefetches the next 2 upcoming due cards' clips - so by the time
the user reaches a card, its clip has typically already finished caching in
the background instead of only starting to fetch on the play click itself.
Local-file cards are unaffected - they're already local.

## In scope

- A new server-side cache directory (`nuxt-app/.data/stream-cache/`), capped
  at a configurable total size (default 1GB), keyed by the remote URL.
- A new proxy route that serves a remote animethemes.moe clip from cache when
  present, or fetches it, saves it, then serves it on a cache miss.
- LRU eviction (oldest-accessed first) once the cache exceeds its configured
  cap.
- Full byte-range (`Range`) support on cached files, so scrubbing works exactly
  as it does today for local files.
- Wiring `StudyMediaPlayer.vue` (shared by `/study` and `CardPreviewModal`) to
  route remote sources through the new cache proxy instead of the raw CDN URL.
- Concurrent-request dedupe: two simultaneous requests for the same uncached
  URL (e.g. a background prefetch and the real play request racing each
  other) share one fetch instead of racing two downloads.
- A host allowlist (`animethemes.moe` and subdomains only) on the new route, so
  it can't be used as an open URL proxy.
- **A Settings control for the cache size cap.** A new `streamCacheMaxBytes`
  column on the existing `mediaLibrarySettings` singleton (default
  1073741824 = 1GB), a `GET /api/media-library`-returned field, a dedicated
  `POST /api/media-library/stream-cache-max-mb` route (value entered/edited in
  MB), and a `SettingsStreamCacheSizeControl.vue` component on `/settings`,
  matching the existing per-setting pattern (`SettingsBoxOneStreakControl.vue`,
  `SettingsNewCardLimitControl.vue`). Lowering the cap re-runs eviction
  immediately so the cache shrinks right away, not just on the next write.
- **Prefetch on card load.** As soon as `StudyMediaPlayer.vue` mounts (a new
  card in Study) or its `card` prop changes (opening Preview on a different
  card), if the resolved source is remote and not already cached, fire a
  best-effort background request to warm the cache for it - no loading
  indicator, no gating of anything on it. A new `POST /api/media/prefetch`
  route (body `{ url }`, same host allowlist) triggers the same
  cache-resolving function the stream route uses and returns once caching has
  started/finished; the client doesn't wait on the response.
- **Lookahead prefetch for the next 2 cards in Study.** `GET /api/study/next`
  additionally returns up to 2 further upcoming due cards (same scope/order,
  excluding the one being returned). `useStudySession.ts` fires the same
  best-effort prefetch call for each of their remote sources, so by the time
  the queue reaches them their clips are typically already cached. Preview has
  no queue, so it only ever prefetches the single card it's showing (above).

## Out of scope

- **Streaming-through on first play.** Chosen approach: on a cache miss, the
  server fully downloads the clip before serving any bytes to the browser, then
  serves it from disk. This adds a small one-time delay on an uncached clip's
  first play (these are short OP/ED clips - typically well under a couple
  seconds), in exchange for much simpler, lower-risk code. A live
  tee-while-streaming approach (no added first-play delay, write to disk in
  the background) was considered and explicitly deferred - reviewed and
  declined for this pass. Prefetch (above) is what closes most of this gap in
  practice: by the time the user presses play, the clip has often already
  finished caching in the background.
- **Lookahead depth beyond 2, and perfect prediction.** The lookahead window
  is a fixed 2 cards, not configurable. It's also a best-effort snapshot, not
  a guarantee: a card's actual position in the due queue can shift after the
  *current* card is answered (a fail sends it back to box 1, immediately due
  again, ahead of what was predicted), so a prefetched card isn't always the
  one that plays next. Harmless when that happens - the wrongly-guessed
  prefetch just occupies a cache slot, and whatever card actually comes up
  falls back to on-demand caching exactly as it does today.
- Feature 42 (download-on-failure fallback) - separate build-plan item, not
  built here. This feature does change *why* a load can fail (a cache-miss
  fetch to the CDN can now fail inside our own proxy instead of directly in the
  browser), but the resulting UI behavior (today's generic "Couldn't load this
  clip." error veil) is unchanged until 42 builds the fallback UI.
  `StudyMediaPlayer.vue`'s existing `onError()` handling needs no change here.
- Any change to local-file playback (`localVideoPath`/`localAudioPath` cards) -
  those already stream straight from disk via `/api/media` and are untouched.
- Any change to the permanent per-card "Download" action (feature 8) - that
  remains a separate, user-triggered, library-folder download; this cache is
  internal, automatic, and not user-visible/manageable (beyond its size cap).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Extract shared range-serving helper** - factor the
  byte-range parsing/serving logic currently inline in
  `server/api/media.get.ts` into `server/utils/rangedFile.ts` (e.g.
  `serveRangedFile(event, filePath, mimeType)`), covering the no-`Range`,
  full-`Range`, and suffix-`Range` cases exactly as today. Refactor
  `media.get.ts` to call it - no behavior change. *Done when:* local video and
  audio still play, pause/seek/scrub identically on `/study` and Preview for a
  local-file card (manual check), and `bun run build` passes.
- [x] **Step 2 - Configurable cache-size setting** - add `streamCacheMaxBytes`
  (integer, not null, default `1073741824`) to `mediaLibrarySettings` in
  `server/db/schema.ts`; generate the Drizzle migration (`bun run
  db:generate`). Add `getStreamCacheMaxBytes()`/`setStreamCacheMaxBytes()` to
  `server/utils/mediaLibrary.ts` (validate a positive integer, mirroring
  `setBoxOneStreakRequired`). Add `server/api/media-library/
  stream-cache-max-mb.post.ts` (body `{ mb: number }`, converts to bytes,
  400s on invalid input) and include the new field in `GET
  /api/media-library`'s response. Add `SettingsStreamCacheSizeControl.vue`
  (same shape as `SettingsBoxOneStreakControl.vue`: labeled number input in
  MB, save on change, inline error) and wire it into `settings.vue`'s type
  and template. *Done when:* `/settings` shows the current cache size in MB
  (1024 by default), editing and saving it persists across a page refresh,
  and an invalid value (0, negative, non-numeric) shows an inline error and
  doesn't save.
- [x] **Step 3 - Stream cache utility + proxy + prefetch routes** - add
  `server/utils/streamCache.ts`: given a remote URL, resolve the local cache
  path, fetching and saving it first on a miss. Cache key is a sha256 hash of
  the URL; cache files live in `nuxt-app/.data/stream-cache/` named
  `<hash><ext-from-url>`. Reuse the `USER_AGENT` and timeout behavior already
  in `server/utils/mediaDownload.ts` (export them from there) for the fetch.
  Dedupe concurrent fetches for the same URL via an in-memory
  `Map<hash, Promise<...>>`, so a prefetch call and a real play request for
  the same clip share one fetch instead of racing two. Create the cache
  directory (`mkdir` recursive) on first use if it doesn't exist yet. After a
  successful save, enforce the cap from Step 2 (`getStreamCacheMaxBytes()`,
  read fresh each time, not cached in memory): sum cached file sizes, and if
  over budget, delete oldest-`atime`-first until back under it; touch
  (`utimes`) a hit file's atime on every cache read so eviction order
  reflects last access, not last write. Export this eviction step
  separately (e.g. `enforceStreamCacheQuota()`) so Step 2's settings route
  can also call it right after a cap change, so lowering the cap takes
  effect immediately. If a single fetched file alone exceeds the configured
  cap, skip caching it (still serve it once, don't persist it). Add
  `server/api/media/stream.get.ts`: takes `?url=`, rejects (400) a missing
  `url` or one whose hostname isn't `animethemes.moe` or a subdomain of it,
  resolves the cache path via the new utility (502 on fetch failure), then
  serves it with Step 1's `serveRangedFile`. Add `server/api/media/
  prefetch.post.ts`: same validation, calls the same cache-resolving
  function, and returns a small JSON ack (`{ cached: true }` or `{ error }`)
  without streaming any file bytes back. *Done when:* requesting
  `/api/media/stream?url=<a real animethemes.moe clip URL>` directly in the
  browser plays/downloads the file; a matching file appears under
  `nuxt-app/.data/stream-cache/`; a second request for the same URL is
  served without a new outbound fetch; a missing `url` or a
  non-animethemes.moe URL both return 400 on both routes; lowering the
  configured cap below the current cache size (via Step 2's setting) evicts
  files immediately; `POST /api/media/prefetch` with a valid URL populates
  the cache without returning file content.
- [x] **Step 4 - Wire the player to the cache proxy and prefetch the current
  card** - add a shared `app/utils/mediaSource.ts` exporting
  `resolveRemotePrefetchUrl(card)`: returns the remote URL that will actually
  be requested for playback (video if any video source exists and isn't
  local; else audio if it exists and isn't local; else `null`) - the same
  video-vs-audio priority `StudyMediaPlayer.vue`'s `mediaKind` already uses,
  factored out so Step 5 can reuse it too. In `StudyMediaPlayer.vue`'s
  `mediaUrl()`, route a remote source through `/api/media/stream?url=<encoded
  remote URL>` instead of using the raw CDN URL directly; local sources are
  unchanged. Separately, on mount and whenever the resolved remote source
  changes (new card), call `resolveRemotePrefetchUrl()` and, if non-null,
  fire a best-effort `POST /api/media/prefetch` for it (`.catch(() => {})`,
  no awaited UI state). *Done when:* a card with only a remote source plays
  correctly on both `/study` and Cards → Preview (video and audio-only
  cases), scrubbing works, and playing the same card a second time is
  visibly instant with a cached file present on disk; opening a card whose
  clip isn't cached yet shows a prefetch request firing immediately (visible
  in the network tab) well before any play click; a local-file card's
  playback is unchanged and triggers no prefetch call.
- [x] **Step 5 - Prefetch the next 2 upcoming cards in Study's queue** - add
  `getUpcomingDueCards(scope, excludeCardId, limit)` to
  `server/utils/cards.ts`, reusing the existing `dueCardCondition(scope)` and
  the same `asc(card.nextReviewAt)` order `getNextDueCard` uses, fetching
  `limit + 1` rows and dropping `excludeCardId` before slicing to `limit`.
  Have `GET /api/study/next` call it with the just-resolved card's id and
  `limit: 2`, and include the result as `upcoming: CardWithDetails[]` in its
  response. In `useStudySession.ts`, after a successful `fetchNext()`, loop
  `upcoming` and fire the same best-effort `POST /api/media/prefetch` call
  (via `resolveRemotePrefetchUrl()` from Step 4) for each card whose
  resolved source is remote. *Done when:* on `/study`, loading a card (fresh
  session start, or right after a pass/fail) fires prefetch requests in the
  network tab for up to 2 further upcoming cards in addition to the current
  one; those cards' clips are already cached (instant playback, no fresh
  fetch) once the queue actually reaches them; Preview is unaffected (still
  only prefetches the one card it's showing).

## Files / areas

- `nuxt-app/server/utils/rangedFile.ts` - new, extracted range-serving helper.
- `nuxt-app/server/api/media.get.ts` - refactor to use the shared helper.
- `nuxt-app/server/db/schema.ts` - new `streamCacheMaxBytes` column.
- `nuxt-app/server/db/migrations/` - generated migration.
- `nuxt-app/server/utils/mediaLibrary.ts` - get/set for the new setting.
- `nuxt-app/server/api/media-library.get.ts` - include the new field.
- `nuxt-app/server/api/media-library/stream-cache-max-mb.post.ts` - new route.
- `nuxt-app/app/components/settings/SettingsStreamCacheSizeControl.vue` - new.
- `nuxt-app/app/pages/settings.vue` - wire in the new control.
- `nuxt-app/server/utils/mediaDownload.ts` - export `USER_AGENT`/
  `DOWNLOAD_TIMEOUT_MS` for reuse.
- `nuxt-app/server/utils/streamCache.ts` - new cache utility.
- `nuxt-app/server/api/media/stream.get.ts` - new proxy route.
- `nuxt-app/server/api/media/prefetch.post.ts` - new prefetch route.
- `nuxt-app/app/utils/mediaSource.ts` - new shared `resolveRemotePrefetchUrl()`.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - `mediaUrl()` change
  plus the new prefetch trigger.
- `nuxt-app/server/utils/cards.ts` - new `getUpcomingDueCards()`.
- `nuxt-app/server/api/study/next.get.ts` - include `upcoming` in the response.
- `nuxt-app/app/composables/useStudySession.ts` - prefetch the 2 upcoming cards.

## Data / contracts

Schema change: `mediaLibrarySettings.streamCacheMaxBytes` (integer, not null,
default `1073741824`), via a Drizzle migration (applied automatically on
server boot, same as every other migration in this project).

The cache directory (`nuxt-app/.data/stream-cache/`) itself is ephemeral,
rebuildable, internal server state - not a tracked data model, same treatment
as the SQLite file already at `nuxt-app/.data/gaq-srs.db` (gitignored via the
existing `.data` entry).

## Testing

No test runner is configured yet (opt-in via `/tests`), so this rides on
manual browser verification plus `bun run build`:

- Local playback (video and audio) still works identically after Step 1's
  refactor - no regression in the existing, already-working path.
- The Settings cache-size control saves and persists a new value, and rejects
  invalid input.
- A remote-only card plays correctly through the new proxy on both `/study`
  and Preview, first play succeeds, and a second play of the same card is
  fast and reads from the on-disk cache file instead of re-fetching.
- Scrubbing/seeking works on a cached file (exercises the `Range` path).
- An invalid/non-animethemes.moe `url`, or a missing one, is rejected with
  400 on both the stream and prefetch routes.
- Loading a card (without pressing play) triggers a prefetch request and
  populates the cache; lowering the configured cap evicts existing files
  immediately.
- In Study, loading or advancing to a card also prefetches the next 2
  upcoming due cards, verifiable via the network tab and by checking those
  cards' clips play instantly once actually reached.
- If a test runner is added later, `streamCache.ts`'s eviction selection
  (given a list of files with sizes/atimes and a byte budget, which ones to
  delete) is a good candidate for a focused unit test - it's pure logic with
  a clear right answer.

## Notes for the AI

- Server-only for the cache/proxy mechanics; the client changes are the
  proxy-URL swap and the prefetch trigger in `StudyMediaPlayer.vue`, plus the
  new Settings control component.
- Host-allowlist the `url` param on both `/api/media/stream` and
  `/api/media/prefetch` (`animethemes.moe` or a subdomain, `https:` only) -
  without it these routes are an open URL proxy/SSRF vector. Do not relax
  this. Share the validation logic between the two routes rather than
  duplicating it.
- Reuse, don't duplicate: the range-serving logic (Step 1), the
  User-Agent/timeout fetch behavior (Step 3, from `mediaDownload.ts`), and the
  per-setting Settings pattern (Step 2, from `SettingsBoxOneStreakControl.vue`
  and its route) already exist - extract/export and reuse them rather than
  re-implementing.
- Read the configured cap fresh on every eviction check (a small DB read) -
  don't cache it in a module-level variable that could go stale after the
  setting changes.
- Keep the eviction check cheap and synchronous (this is a single-user local
  app with at most a few hundred small cached clips) - no need for a
  background job, queue, or separate index file. Filesystem `atime` is the
  source of truth for LRU order; don't add a parallel JSON index that could
  drift out of sync with it.
- Full-download-then-serve on a cache miss is the deliberate, approved
  design (see Out of scope) - don't build a tee/streaming-while-caching
  path. Prefetch is what makes this feel instant in practice: because the
  stream route already fully caches on any request regardless of the Range
  it was asked for, and prefetch and the eventual play request dedupe
  through the same in-flight-fetch map, firing prefetch as early as possible
  (card load, not a timed delay) gives the fetch the maximum head start
  without ever making playback wait longer than it would today.
- The prefetch trigger fires immediately on card load rather than after an
  artificial delay - a deliberate call: starting the fetch sooner only ever
  helps it finish before play, and there is no scenario where waiting first
  would help.
- The lookahead (Step 5) is a snapshot taken at the moment `/api/study/next`
  responds, not a live-updating prediction - don't try to invalidate or
  re-fetch it when the current card's review later changes the real due
  order. A stale guess is harmless (see Out of scope); building anything to
  correct it would be solving a problem this cache doesn't actually have.
- `resolveRemotePrefetchUrl()` (Step 4) is the single source of truth for
  "which URL would playback actually request" - both `StudyMediaPlayer.vue`
  and `useStudySession.ts` must call it rather than re-deriving the
  video-vs-audio/local-vs-remote logic independently.
