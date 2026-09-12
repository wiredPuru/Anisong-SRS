# Current Feature

**Title:** Recreate the default download folder instead of blocking downloads

**Type:** Fix

**Status:** verified

## The problem

The previous fix (`blueprint/history/fixes/default-download-folder-missing.md`)
made `POST /api/cards/download` (`nuxt-app/server/api/cards/download.post.ts`)
return a clean 400 - "Default download folder no longer exists on disk. Set a
valid folder in Settings." - instead of crashing with a raw `ENOENT` when the
configured default download folder had been deleted or renamed on disk.

That stops the crash, but it still blocks every download until the user
manually revisits `/settings`. A missing destination folder is just an empty
directory that needs to exist again - there's no data to lose by recreating
it, so the app can recover on its own instead of making downloading a card
depend on a separate trip to Settings.

## The fix

In `download.post.ts`, replace the "folder missing -> error" branch with
"folder missing -> create it" (`mkdirSync(destDir, { recursive: true })`),
keeping a real error only for the case a folder truly can't be used - the
configured path exists but is a file, not a directory (recreating over that
would be destructive/wrong, so it must still stop and tell the user to fix it
in Settings).

Scope stays to this exact case: a `defaultDownloadFolder` value that is set
but missing on disk. The separate "no default download folder is configured
at all" branch (0 library folders, or 2+ with none picked) is untouched -
that one is deliberate per feature 8's design (asks the user to pick when
there's a real choice to make) and out of scope for this fix.

## Build steps

1. [x] In `download.post.ts`, import `mkdirSync` from `node:fs` alongside the
   existing `existsSync`/`statSync`/`unlinkSync`. Replace the current
   `if (!existsSync(destDir) || !statSync(destDir).isDirectory()) { throw ... }`
   block with:
   - if the path exists and is **not** a directory (e.g. a file), throw the
     same kind of `createError` as today, since that case genuinely needs a
     Settings fix.
   - if the path does not exist, `mkdirSync(destDir, { recursive: true })`
     and continue the download normally.
   Done when: downloading a card whose configured default download folder
   has been deleted from disk succeeds (the folder is recreated and the file
   downloads into it) instead of returning any error, while a
   `defaultDownloadFolder` that points at an existing plain *file* still
   returns the same clear 400 as before.

## Verify

- Delete the currently-configured default download folder on disk (or point
  at one that doesn't exist), then download a remote-only card's video from
  `/study` or `/cards` -> the folder is recreated and the download succeeds.
- Point the default download folder at an existing plain file (not a
  directory) and try to download -> still a clear 400 error, not a crash.
- A normal download against an already-existing folder is unaffected.
