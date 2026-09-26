# Feature: Library scan

**From build-plan:** feature 83
**Status:** verified

## Goal

Recover cards from clip files already sitting in the media library folders,
for when cards were deleted but their files were kept. Deleting a card keeps its
`Song`/`Artist`/`Anime` rows (feature 61's decision), and feature 8 names every
download `<anime romaji> - <slot> - <artist>.<ext>`, so most files map back to a
known song with no network call. A Settings action previews what it found and
changes nothing until the user confirms.

Measured on the live library (2026-09-26, 180 files): 139 already used by a
card, 21 recoverable songs with no card, 4 files attachable to a card missing a
local file of that kind, 8 duplicates of a card that already has its own file, 8
unmatched.

## In scope

- A pure matcher (`server/utils/libraryScan.ts`) that classifies each file into
  one of: create, attach, already used, duplicate, unmatched, ambiguous.
- A recursive listing of every configured library folder, skipping dotfiles and
  anything that is not a known video or audio extension.
- `GET /api/cards/recover` - the preview. Read-only.
- `POST /api/cards/recover` - applies the create/attach entries the client names
  by path, after recomputing the plan server-side. Runs in one transaction.
- A "Recover cards from files" panel in Settings > Library health, below the
  existing health scan: Scan, a grouped preview, one Confirm, a result summary.

## Out of scope

- Looking up unmatched files online (AniList/AnisongDB). Unmatched files are
  listed by name so they can be re-added through `/cards` search.
- Per-row selection in the preview. The POST already takes an explicit path
  list, so checkboxes can be added later without a contract change.
- Restoring review history, Leitner boxes, notes, or deck membership. Those went
  with the deleted card rows; created cards start fresh at box 1.
- Any sidecar/manifest file written into the library. SQLite stays the only
  record.
- Renaming, moving, or deleting files on disk. The scan never writes to the
  library folders.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Pure matcher + tests** - `server/utils/libraryScan.ts`:
  `clipKindForFile(name)`, `matchKey(...)`, and `planLibraryScan(input)` per the
  contract below, with `libraryScan.test.ts`. *Done when:* `bun run test` passes
  with cases for each outcome, the ` (N)` suffix, NFD vs NFC names,
  case-insensitivity, an ambiguous key, a song that gets both a video and an
  audio file, two video files for one song (the unsuffixed one wins), and an
  unknown extension being ignored.
- [x] **Step 2 - Preview route** - `server/api/cards/recover.get.ts` plus the
  DB/fs loader in `libraryScan.ts` (`loadLibraryScan()`): read library paths,
  list files recursively, load songs with anime romaji/slot/artist and cards'
  local paths, return `planLibraryScan`'s result. An unreadable folder is
  reported in `unreadableFolders`, never thrown. *Done when:* `curl
  localhost:3000/api/cards/recover` against the live library reports 21 songs
  to create, 4 attaches, 139 already used, 8 duplicates, 8 unmatched (or the
  current counts if the library changed), and the DB is unchanged.
- [x] **Step 3 - Apply route** - `server/api/cards/recover.post.ts` and
  `applyLibraryScan(paths)`: validate the body (`parseRecoverBody`, 1-5000
  absolute path strings, tested), recompute the plan, and in one transaction
  insert a card per create entry with at least one named path (only its named
  paths are set), and set a null local path per named attach entry (`WHERE ... IS NULL`
  guard). Paths not currently plannable are returned in `skipped`. *Done when:*
  tests for `parseRecoverBody` pass; POSTing the preview's paths against a copy
  of the DB creates the cards and fills the attaches, a second POST creates
  nothing and reports everything skipped.
- [x] **Step 4 - Settings panel** - `SettingsLibraryRecover.vue` in the health
  section: Scan button, summary counts, grouped lists (Will add, Will attach,
  Duplicates, Unmatched, and an "already used" count), Confirm with the count,
  a result line, and loading/error/empty states. *Done when:* a screenshot of
  the preview and of the post-confirm result against the live library, build
  passes, no console errors.

## Files / areas

- `nuxt-app/server/utils/libraryScan.ts` (new) + `libraryScan.test.ts` (new)
- `nuxt-app/server/api/cards/recover.get.ts` (new)
- `nuxt-app/server/api/cards/recover.post.ts` (new)
- `nuxt-app/app/components/settings/SettingsLibraryRecover.vue` (new)
- `nuxt-app/app/pages/settings.vue` - mount the panel in the health section

## Data / contracts

No schema change. New shapes (server in `libraryScan.ts`, client copy in the
component, same field order):

```ts
type ClipKind = "video" | "audio";

interface ScanSong {
  songId: number;
  songTitle: string;
  animeTitleRomaji: string;
  themeSlot: string;
  artistName: string;
}

interface RecoverCreate extends ScanSong {
  videoPath: string | null;
  audioPath: string | null;
}

interface RecoverAttach extends ScanSong {
  cardId: number;
  kind: ClipKind;
  path: string;
}

interface RecoverSkip {
  path: string;
  reason: "duplicate" | "unmatched" | "ambiguous";
  songTitle: string | null; // set for duplicate
}

interface LibraryScanResponse {
  scannedFiles: number;      // media files found
  alreadyUsed: number;
  create: RecoverCreate[];
  attach: RecoverAttach[];
  skipped: RecoverSkip[];
  unreadableFolders: string[];
  truncated: boolean;        // listing stopped at MAX_SCAN_FILES
}

interface RecoverResult {
  created: number;
  attached: number;
  skipped: string[];         // named paths no longer plannable
}
```

Rules:

- Match key: `sanitizeSegment(animeTitleRomaji) - sanitizeSegment(themeSlot) -
  sanitizeSegment(artistName)` (reusing `mediaDownload.ts`), then NFC and
  lowercase. The file's base name drops its extension and one trailing ` (N)`,
  then gets the same NFC + lowercase.
- Video extensions: `.webm .mp4 .mkv .m4v .mov`. Audio: `.mp3 .ogg .oga .opus
  .m4a .aac .flac .wav`. Anything else is not counted.
- "Already used" compares normalized absolute paths against every card's
  `localVideoPath`/`localAudioPath`.
- A key matching more than one song is `ambiguous`, never guessed.
- Per song and kind, one file wins: the one with no ` (N)` suffix, else the
  lowest N, else name order. The rest are `duplicate`.
- Song with no card -> `create`. Song whose card's local path for that kind is
  null -> `attach`. Otherwise -> `duplicate`.
- Created cards take only local paths; remote URL columns stay null.

## Testing

- Vitest is on. In-scope logic: `clipKindForFile`, `matchKey`,
  `planLibraryScan`, `parseRecoverBody` - all pure, all tested in Steps 1 and 3.
- Routes and the panel ride on curl output, a DB count before/after, the
  screenshots in Step 4, and `bun run build`.
- The apply step is verified against a copy of the DB (`GAQ_SRS_DATA_DIR`
  pointed at a scratch dir) before the live one is touched; the live library is
  only changed by the user clicking Confirm.

## Notes for the AI

- Server-only fs/DB access; the component only calls the two routes.
- The POST never trusts client paths: it recomputes the plan and acts only on
  entries that are still plannable, so a stale preview or a crafted path cannot
  create a card outside the library or overwrite a set path.
- The listing must not walk huge trees forever: stop at `MAX_SCAN_FILES`
  (20,000) media files and set `truncated`. Symlinked directories are not
  followed.
- Follow `SettingsLibraryHealth.vue`'s look (header, hint, button, summary) and
  `extractErrorMessage` for errors. Tokens only, no hard-coded colors.
- No em dashes in code, comments, or docs.

## Outcome

Built 2026-09-26. Verified against a scratch copy of the live database (built
server on port 3100, `GAQ_SRS_DATA_DIR` pointed at a copy): the preview reported
185 files, 145 already used, 14 cards to add, 3 attaches, 9 duplicates, 7
unmatched; Confirm took the copy from 159 to 173 cards and a rescan then showed
nothing to recover; a second POST created nothing; a crafted `/etc/passwd` path
was skipped; an empty body returned 400. The live database was never written.
Counts differ from the spec's 2026-09-26 snapshot because clips were still being
downloaded into the folder during the build. `bun run test` (1281 tests) and
`bun run build` passed. The DB/fs loader lives in its own module,
`server/utils/libraryScanLoad.ts`, so `libraryScan.ts` stays pure and testable.
