# Prevent duplicate downloads from a concurrent card+kind download

**Type:** Fix

**Status:** verified

**Branch:** `fix/concurrent-download-guard`

**Completed:** 2026-09-22

## The problem

`POST /api/cards/download` ([download.post.ts](../../../nuxt-app/server/api/cards/download.post.ts))
guards against downloading over an **already-local** file (400 if
`localVideoPath`/`localAudioPath` is already set), but nothing guards against
two requests for the **same card and kind running at the same time**. The
check ("no local path yet") and the eventual write (`updateCard` once bytes
finish) aren't atomic, so a second request that starts before the first
finishes reads the same "no local path" state and proceeds.

Real trigger: Auto Download (feature 59) fires from `StudyMediaPlayer.vue` on
mount/`autoDownloadTarget` change, silently, in the background. If the same
card+kind is also downloaded some other way while that background download is
still running - e.g. `CardPreviewModal`'s own `StudyMediaPlayer` instance for
the same card, or a manual click on a per-row Download button - both requests
pass the "no local path" check and both call `downloadMediaFile()`
([mediaDownload.ts](../../../nuxt-app/server/utils/mediaDownload.ts)).
`resolveUniquePath()` gives the second one a `Name (2).ext` filename instead
of colliding, so both downloads complete and both call `updateCard()` - the
one that finishes last wins the card's stored path, and the other's file is
never referenced by any card, orphaned on disk with no cleanup (existing
orphan cleanup only runs on an explicit clear-to-null, not here).

Each `useCardDownloads()` call also creates its own local `downloading`
state, so this can't be caught client-side either: `StudyMediaPlayer`'s
background auto-download and a `CardAdd*Results` component's own
`useCardDownloads()` instance have no shared view of "a download for this
card+kind is already running."

Not in scope: the other two related gaps flagged in chat (a stale
already-cached-on-disk file not being detected via a fresh network fetch
racing ahead of it, and two different cards ever sharing one song/clip) -
neither has a real trigger in the current app and both are follow-up ideas,
not this fix.

## The fix

Add a server-side in-flight guard in `download.post.ts`, keyed by
`` `${cardId}:${kind}` ``, mirroring the existing `downloadKey()` shape
client-side already uses. A request for a key that's already in flight
returns `409` with a clear message instead of starting a second download;
the guard clears in a `finally` once the first request's stream ends
(success or error), so a later, non-concurrent download of the same
card+kind is unaffected.

This is a module-level `Set<string>` - in-process state is fine here,
matching how `streamCache.ts`'s existing dedupe-in-flight-fetches mechanism
(feature 41) is scoped, and this app has exactly one server process
(localhost-only, no clustering).

Client side, surface the 409 through the existing `downloadError` path in
`useCardDownloads.downloadMedia()` (it already throws on a non-ok response
and reads `statusMessage` into `downloadError`) rather than adding new UI -
Auto Download already swallows a failed `runDownload()` result silently (it
just leaves `autoDownloadTarget` non-null for the next mount/watch trigger),
so a 409 there is a quiet no-op, exactly like today's "no default folder"
no-op. A manual Download button click that loses the race shows the same
error styling every other download failure already uses.

Must not break: the existing "already has a local path" 400, the stream
cache short-circuit in `downloadMediaFile()`, or a normal (non-concurrent)
sequential download of the same card+kind after the first one finishes.

## Build steps

- [x] 1. **Add the in-flight guard to `download.post.ts`.** (done)

   Built as a small pure module, `server/utils/downloadGuard.ts` -
   `downloadGuardKey(cardId, kind)`, `acquireDownloadGuard(key)` (a
   synchronous check-and-set on a module-level `Set<string>`; no `await`
   separates the check from the set, so two concurrent requests can't both
   observe a key as free), and `releaseDownloadGuard(key)`. Kept as a
   separate util rather than the route's own module scope so the guard
   logic itself is independently unit-testable, matching this project's
   logic-test convention (route/integration behavior rides on other
   evidence, not unit tests).

   Wired into `download.post.ts`: acquired right after the existing
   "already has a local path" 400, before the download-folder validation.
   Released in `streamDownloadResponse`'s `finally` (covers a successful
   download, a mid-download error, and an early client disconnect), or in
   a `catch` around a newly-extracted `resolveDestDir()` helper if a
   pre-flight folder check throws before the generator (and its own
   `finally`) ever starts.

   New test: `server/utils/downloadGuard.test.ts` - blocks a second
   concurrent acquire for the same key, frees the key on release for a
   later sequential download, does not cross-block a different card or a
   different kind on the same card, and releasing an already-free key is a
   no-op.

   **Done when:** two concurrent `POST /api/cards/download` calls for the
   same `cardId`+`kind` result in exactly one file written and one card
   update; the second call's stream emits a single `{"type":"error", ...}`
   ndjson line with the 409's message; `bun run test` passes including the
   new test. Met: `bun run test` - 744/744 passed across 54 files
   (including the new guard test); `bun run build` - clean production
   build.

## Verify

- Automated: `bun run test` (new guard test, plus the existing
  `mediaDownload`/`cards` suites still green). Run in-session: 744/744
  passed.
- Manual (not run this session - regular check gate was `manual` and not
  requested): with a default download folder configured, open a
  remote-only card in `/study` with Auto Download on, and within the same
  second open the same card in `CardPreviewModal` (via `/cards`' Preview
  button) - only one file should land in the download folder, and the
  card's local path should point at it. Triggering a second download of
  the *same* card+kind again after the first genuinely finishes should
  still succeed normally (not permanently blocked).

## Notes from the build

- No project `Verify` command is declared in `AGENTS.md` yet (`/ci` hasn't
  been run), and no type checker is installed, so the automated gate used
  was `bun run test` plus `bun run build`, per the fallback order in
  `coding-standards.md`.
- The other two duplicate-download angles raised alongside this one (a
  fresh network fetch racing ahead of an already-cached disk copy; two
  different cards ever sharing one clip URL) were explicitly scoped out -
  neither has a real trigger path in the current app.
