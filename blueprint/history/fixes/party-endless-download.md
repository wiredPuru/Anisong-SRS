# Party: download endless catalog songs

**Type:** Fix

**Status:** verified

## The problem

Party mode's Endless "outside library" songs (`topUpCatalog` and `catalogItem`
in `server/utils/partyStore.ts`, plus songs added from the catalog search) are
**not downloaded**. Answer to the question that prompted this:

- They have no `Card` (negated AMQ song id as `cardId`), and `catalogItem` calls
  `pickPartyClip` with both local paths `null`, so every clip is a remote
  AnisongDB URL.
- The display plays them through `/api/party/display/clip`, which streams via
  feature 41's capped stream cache (default 1GB, evicted oldest first). A clip
  is only ever on disk as a cache entry, never in the media library.
- Settings > Playback > Auto Download (feature 59) is a client-side trigger
  inside `StudyMediaPlayer.vue`. The party display never mounts that component,
  so the setting has no effect in party mode, for catalog songs or library
  cards.

The user wants these songs saved to the library folder, and wants party to have
its own setting for that instead of borrowing Study's.

## The fix

A persistent, party-only **Download endless songs** setting (default off).
While on, each catalog-sourced song is downloaded into the default download
folder as it is queued, so by the time it plays it is a local file.

- **Setting:** `MediaLibrarySettings.partyAutoDownload` (boolean, default false,
  Drizzle migration), `getPartyAutoDownload`/`setPartyAutoDownload` beside
  `getAutoDownload` in `server/utils/mediaLibrary.ts`, and a host-door route
  to read and set it. Toggle lives in `PartyEndlessPanel.vue`, shown with a
  hint when no default download folder is configured. It is independent of
  Study's Auto Download.
- **Download:** a small server helper (`server/utils/partyDownload.ts`) takes a
  queued catalog item, picks video or audio the way `pickPartyClip` already did
  (Playback mode, Clip source), and reuses `downloadMediaFile` and
  `buildDownloadBaseName` (stream-cache copy first, so a prefetched clip is not
  fetched twice). Runs in the background for the newly queued batch plus the
  next few songs, sequentially, never blocking `load`, with failures swallowed
  (the song keeps streaming).
- **Swap to local:** on success the queue item's clip source becomes the local
  file (same shape `pickPartyClip` returns for a local path), only when the
  song has not started playing, so the active clip never changes mid-song.
- **Not changed:** library cards (Study's Auto Download and the party's
  existing local-over-remote choice are untouched), the stream cache, clip
  allowlists, and what the display or phones can see. Catalog songs still
  create no `Card`/`Song` rows, so downloaded files are not cards; the
  Settings library scan (feature 83) will list them as unmatched.
- **Must not break:** party never writes `ReviewLog`/`Card`/`CardTrack`; a
  missing download folder or a failed download degrades to streaming with no
  error on the display.

## Build steps

- [x] **Setting and plumbing.** Migration, getter/setter, host route, and the
   panel toggle with the no-folder hint. Done when the toggle persists across a
   party restart and shows the hint with no default download folder.
- [x] **Download and swap.** `partyDownload.ts` plus its wiring in
   `partyStore.ts` after catalog items are queued; unit test for the pure parts
   (file naming, which items qualify, swap only before play). Done when, with
   the setting on and Endless set to outside library, queued songs appear as
   files in the default download folder and play from `local` origin.

## Also on this branch

Two small party changes made earlier in the same session ride along: multiple
choice now removes the buzzer (`canBuzz` refuses while `choices` is set), and
phones show a Song log of played songs (`log` on `PartyPlayerState`).

## Verify

- `bun run test` green with the new unit test.
- Run `bun run build` and `bun run party`, set a default download folder, turn
  Endless to outside library with the toggle on: files appear in the folder,
  the host queue shows them as local, and playback still works.
- Toggle off: nothing is written, songs stream as before.
- Remove the default download folder: songs still stream, hint is shown.
