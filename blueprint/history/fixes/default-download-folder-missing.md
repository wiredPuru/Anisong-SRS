# Current Feature

**Title:** Friendly error when the default download folder is missing on disk

**Type:** Fix

**Status:** verified

## The problem

`POST /api/cards/download` (`nuxt-app/server/api/cards/download.post.ts`)
crashes with a raw, unhandled `ENOENT` when the configured default download
folder no longer exists on disk - surfaced to the user as an opaque 500
"Server Error" instead of an actionable message.

Confirmed by reproducing directly against the running dev server for card
265 (YuruYuri Season 2 OP2, remote-only, no local video path):

```
$ curl -X POST http://localhost:3000/api/cards/download \
    -d '{"cardId":265,"kind":"video"}'
{
  "statusCode": 500,
  "statusMessage": "Server Error",
  "message": "ENOENT: no such file or directory, open '/Users/lu/Downloads/Test/Yuru Yuri♪♪ - OP2 - Ayana Taketatsu.webm'"
}
```

`/Users/lu/Downloads/Test` is the app's configured default download folder
(`MediaLibrarySettings.defaultDownloadFolder`), but that directory has been
deleted/renamed on disk outside the app. `getDefaultDownloadFolder()`
(`nuxt-app/server/utils/mediaLibrary.ts`) only checks a folder exists at the
moment it's added in Settings (`validateFolderPath`) - nothing re-checks it
at download time.

This is why the clip visibly plays but downloading it fails: playback reads
from feature 41's separate stream-cache directory
(`nuxt-app/.data/stream-cache/`), which is unrelated to the user-configured
download folder and unaffected by it going missing.

## The fix

In `download.post.ts`, alongside the existing synchronous validations (no
source URL, already has a local path, no default folder configured), add a
check that `destDir` actually exists and is a directory on disk. If not,
throw a `createError` with a clear, actionable `statusMessage` (e.g.
"Default download folder no longer exists on disk. Set a valid folder in
Settings.") instead of letting the write fail with a raw filesystem error.

Must not change behavior when the folder does exist (the common case).

## Build steps

1. [x] Add an existence/directory check for `destDir` in `download.post.ts`
   right after `getDefaultDownloadFolder()` returns a path, mirroring the
   existing `if (!destDir) { throw createError(...) }` block's style, using
   `existsSync`/`statSync` from `node:fs` (already imported in
   `mediaDownload.ts`; import directly here too).
   Done when: the curl repro above returns a 400 with a clear
   `statusMessage` instead of a 500 "Server Error", and a normal download
   against an existing folder still succeeds.

## Verify

- Re-run the repro: `curl -X POST http://localhost:3000/api/cards/download -d '{"cardId":265,"kind":"video"}'` -> expect a 400 with an actionable message, not a 500.
- Point the default download folder (Settings) at a real, existing folder and download a remote-only card's video/audio from `/study` or `/cards` -> still succeeds and clears the error state.
