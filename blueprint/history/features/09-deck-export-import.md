# Feature: Deck export/import

**From build-plan:** feature 9
**Status:** verified

## Goal

Let a deck (an artist or anime grouping) be exported to a self-contained bundle
on disk and re-imported later - so cards can be backed up, moved to another
copy of the app, or shared, without dragging in every video file.

**Design call for review:** the bundle is a plain directory (`manifest.json`
plus an optional `audio/` folder), not a zip archive. Node has no built-in zip
writer and the project has no archiving dependency yet; adding one (e.g.
`archiver`/`adm-zip`) just for this would be the first new runtime dependency
since kuroshiro. A folder bundle needs zero new dependencies and is just as
inspectable. Say so if a real `.zip` file matters enough to add the dependency
- easy to swap in later without changing the manifest shape.

## In scope

- A bundle format: a destination directory containing `manifest.json`
  (self-contained card/song/artist/anime metadata plus the
  `animethemesVideoUrl`/`animethemesAudioUrl` remote references) and, only
  when audio is included, an `audio/` subfolder holding copies of each
  card's *existing local* audio file. Video is never bundled (no file copy,
  no `localVideoPath` carried over) - matches the build-plan line exactly.
- `POST /api/decks/export` - exports **one deck** (`{ type: "artist", id }` or
  `{ type: "anime", id }`, matching the existing deck shape from feature 5) to
  a user-supplied absolute destination directory. An `includeAudio` flag
  controls whether local audio files get copied in; refuses to write into a
  destination that already exists and isn't empty.
- `POST /api/decks/import` - reads a bundle's `manifest.json`, and per card
  entry:
  - Upserts anime/artist/song via the existing get-or-create utilities
    (`upsertAnime`, `getOrCreateArtist`, `upsertSong` from `lookup.ts`) - no
    live AniList/animethemes.moe calls, the manifest is self-contained.
  - Skips creating a card if one already exists for the resulting `songId`
    (import is idempotent - re-importing the same bundle doesn't duplicate
    cards).
  - Otherwise creates the card via the existing `createCard` (reusing its
    source validation), setting `localAudioPath` from a copied bundle file
    when one exists and a default download folder (feature 8's setting) is
    configured, and carrying `animethemesVideoUrl`/`animethemesAudioUrl`
    straight from the manifest onto the new card either way - this is the
    "re-link missing local media from animethemes.moe" behavior: it reuses
    the URL already in the manifest, it does not re-query the API.
  - Returns a summary (created / skipped / errors) rather than throwing on a
    single bad entry.
- **Export UI**: on the `/decks` deck-detail view, an "Export deck" control
  (destination path input, "include audio" checkbox, submit) showing a
  success summary or inline error - same absolute-path-text-input pattern
  `/settings` already uses for library folders.
- **Import UI**: on `/settings`, an "Import deck" form (source path input,
  submit) showing the created/skipped counts or an inline error. This
  resolves `project-overview.md`'s open "not yet confirmed" note about where
  import lives.

## Out of scope

- A real `.zip`/archive file (see the design call above).
- Exporting "all cards" in one action - scope is always one deck (artist or
  anime), matching the shape the rest of the app already uses for decks.
- Bulk artist import / auto-importing an artist's whole catalog from
  animethemes.moe - the pre-existing, still-unresolved Open Question in
  `project-overview.md`. Unrelated: that would pull new songs from the live
  API; this imports a previously-exported bundle of already-existing cards.
- Re-fetching fresh metadata from AniList/animethemes.moe during import.
- Restoring `localVideoPath` in any form, bundled or re-linked.
- Merge/overwrite handling for a card that already exists - it's skip-only,
  no conflict-resolution UI.
- A native OS file/folder picker - the app has no such picker anywhere yet;
  paths are typed, same as every other folder field in this project.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Export logic + API** - add `server/utils/deckExport.ts` with
  `buildManifest(scope)` (pulls a deck's cards via the existing
  `listCardsByArtist`/`listCardsByAnime`, shapes each into a
  `DeckBundleCardEntry`) and `writeBundle(destPath, manifest, includeAudio)`
  (creates `destPath` if missing via `mkdirSync(destPath, { recursive: true
  })`, 400s if it exists and is non-empty, copies each card's
  `localAudioPath` into `audio/<cardId>-<basename>` when `includeAudio` is
  true and the file exists, writes `manifest.json`). Add
  `POST /api/decks/export.post.ts`: 400 on a missing/invalid scope, 404 if
  the artist/anime doesn't exist (reuse `getArtistLabel`/`getAnimeLabel`),
  otherwise writes the bundle and returns
  `{ exportedTo, cardCount, audioFileCount }`. *Done when:* against a deck
  with at least one card that has a local audio file, `curl -X POST
  /api/decks/export` with `includeAudio: true` writes a `manifest.json` and
  an `audio/` folder with the copied file to the given path (verified via
  `ls`/`cat`); the same call with `includeAudio: false` writes only
  `manifest.json`, no `audio/` folder; re-running against the same
  non-empty destination 400s instead of overwriting.
- [x] **Step 2 - Import logic + API** - add `server/utils/deckImport.ts` with
  `importBundle(sourcePath)`: reads and validates `manifest.json` (400 if
  missing or its `version` doesn't match), then per entry: `upsertAnime` +
  `getOrCreateArtist` + `upsertSong`, skip if a card already exists for that
  `songId` (add a small `cardExistsForSong(songId)` check alongside the
  existing query helpers in `cards.ts`), else copy the entry's bundled audio
  file (if present in `audio/`) into `getDefaultDownloadFolder()` using the
  same naming convention as feature 8's downloads (reuse
  `buildDownloadBaseName`; export the currently-private `resolveUniquePath`
  from `mediaDownload.ts` for this collision-safe copy target), then call
  `createCard` with that local path (or `null` if no default folder is
  configured or the bundled file is missing) plus the manifest's
  `animethemesVideoUrl`/`animethemesAudioUrl`. Collect
  `{ created, skipped, errors }` instead of throwing per-entry (an entry
  `createCard` rejects, e.g. no source at all, becomes an error string, not
  a crash). Add `POST /api/decks/import.post.ts`: 400 if `sourcePath` is
  missing/not absolute/doesn't exist, otherwise calls `importBundle` and
  returns the summary. *Done when:* deleting the cards exported in Step 1
  from the DB, then `curl -X POST /api/decks/import` against that bundle
  recreates them (`created` matches the card count, confirmed via
  `/api/cards`); running the same import again reports everything
  `skipped`, `created: 0`; a bundle entry with no bundled audio but a
  populated `animethemesAudioUrl` produces a card whose
  `animethemesAudioUrl` is set and `localAudioPath` is `null`.
- [x] **Step 3 - Export UI on `/decks`** - in `app/pages/decks/index.vue`, add
  an "Export deck" block under the selected deck's card list: a destination
  path text input, an "Include audio" checkbox, and an Export button that
  posts to `/api/decks/export` with the current `activeType`/`selectedId` as
  scope, showing "Exported N cards (M audio files) to `<path>`" on success or
  the inline error on failure. *Done when:* in the browser, exporting a
  real deck with "Include audio" checked writes the bundle (confirmed on
  disk) and shows the success summary; leaving it unchecked exports
  metadata only.
- [x] **Step 4 - Import UI on `/settings`** - add an "Import deck" form to
  `app/pages/settings.vue`: a source path text input and an Import button
  that posts to `/api/decks/import`, showing "Imported N cards (M skipped)"
  or the per-entry error list on partial failure, or the inline
  `extractErrorMessage` error on a hard failure (bad path, malformed
  manifest). *Done when:* in the browser, pasting the path from Step 3's
  export and submitting shows the created/skipped summary, and the deck's
  card list on `/decks` now includes the (re-)imported cards.

## Files / areas

- `nuxt-app/server/utils/deckExport.ts` - new. Manifest building + bundle
  writing.
- `nuxt-app/server/utils/deckImport.ts` - new. Manifest reading + card
  recreation.
- `nuxt-app/server/api/decks/export.post.ts` - new.
- `nuxt-app/server/api/decks/import.post.ts` - new.
- `nuxt-app/server/utils/cards.ts` - add `cardExistsForSong(songId)`.
- `nuxt-app/server/utils/mediaDownload.ts` - export the existing
  `resolveUniquePath` helper (currently private) for reuse by the import
  copy step; no behavior change.
- `nuxt-app/app/pages/decks/index.vue` - export control.
- `nuxt-app/app/pages/settings.vue` - import form.

## Data / contracts

```ts
// server/utils/deckExport.ts
export type DeckExportScope = { type: "artist"; id: number } | { type: "anime"; id: number };

export interface DeckBundleManifest {
  version: 1;
  exportedAt: string; // ISO timestamp
  scope: DeckExportScope;
  cards: DeckBundleCardEntry[];
}

export interface DeckBundleCardEntry {
  anime: {
    aniListId: number;
    animethemesId: number | null;
    titleEnglish: string;
    titleRomaji: string;
    titleNative: string;
  };
  artistName: string;
  song: { title: string; themeSlot: string; animethemesThemeId: number | null };
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  audioFile: string | null; // relative path under the bundle dir, e.g. "audio/12-song.mp3"; null if not bundled
}
```

`POST /api/decks/export` request/response:

```ts
interface ExportDeckRequest {
  scope: DeckExportScope;
  destPath: string; // absolute
  includeAudio: boolean;
}
interface ExportDeckResponse {
  exportedTo: string;
  cardCount: number;
  audioFileCount: number;
}
```

`POST /api/decks/import` request/response:

```ts
interface ImportDeckRequest {
  sourcePath: string; // absolute; must contain manifest.json
}
interface ImportDeckResponse {
  created: number;
  skipped: number;
  errors: string[]; // one entry per manifest card that failed, human-readable
}
```

Reused, unchanged: `upsertAnime`, `getOrCreateArtist`, `upsertSong` (all from
`server/utils/lookup.ts`), `createCard` and `getCardWithDetails` (from
`server/utils/cards.ts`), `getDefaultDownloadFolder` (from
`server/utils/mediaLibrary.ts`), `buildDownloadBaseName` (from
`server/utils/mediaDownload.ts`).

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test` entry),
so this rides on direct verification, same as feature 8:

- Step 1 & 2: `curl` against both new endpoints using a real deck (cards
  built from a real animethemes.moe lookup, per feature 8's precedent),
  inspecting the written bundle with `ls`/`cat` and the re-import result via
  `/api/cards`. `bun run build` must stay clean.
- Step 3 & 4: browser check of both forms, plus confirming on disk (`ls`)
  that the export step actually wrote what the success message claims.

`DeckBundleCardEntry` shaping (mapping a `CardWithDetails` into the manifest
entry) and the skip-on-existing-song / error-collection logic in
`importBundle` are pure logic with clear right/wrong answers - reasonable
first candidates if `/tests` adds a runner later, but not part of this
feature's scope today.

## Notes for the AI

- Server-only: all filesystem access (directory creation, file copy, JSON
  read/write) stays in the two new `server/utils/` files and their routes;
  pages only call `$fetch`, per `coding-standards.md`.
- Query-string routing conventions (`?type=`) don't apply to the two new
  routes - they're POST actions, not page routes, matching feature 8's
  `/api/cards/download` precedent.
- Match existing error-response conventions: `createError({ statusCode,
  statusMessage })` server-side, `extractErrorMessage` client-side (already
  duplicated in `cards/new.vue`, `cards/index.vue`, and `settings.vue`).
- `destPath`/`sourcePath` validation should mirror `mediaLibrary.ts`'s
  `normalizeFolderPath` (trim, drop a trailing slash) and its absolute-path
  check, but neither path needs to be inside a configured library folder -
  a bundle is data outside the media library by design.
- animethemes.moe URLs carried through the manifest are opaque strings on
  both sides of export/import - never parsed, re-fetched, or validated for
  reachability. Only the *file copy* paths (export's source, import's
  destination) touch the filesystem.
