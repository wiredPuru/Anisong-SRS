# Feature: Insert songs - setting, import, and storage

**From build-plan:** feature 85a (parent: 85. Insert songs)
**Status:** verified
**Branch:** `feature/85a-insert-songs-import`

## Goal

Let the user opt in to AMQ insert songs. With a new "Include insert songs"
setting on, anime import, song search, and artist import stop dropping
AnisongDB's `"Insert Song"` entries, store them as real `Song`/`Card` rows,
and show them in `/cards`' add-candidate groups labelled "Insert". With it off
(the default), every import behaves exactly as it does today.

## Findings that shaped this spec

- **Where inserts are dropped today** (`server/lib/anisongdb.ts`):
  `toThemeSlot` maps `"Insert Song"` to `null` (anime import skips it), and
  `OP_ED_ONLY` (`song_types: ["opening", "ending"]`) keeps inserts out of
  `searchSongs`, `searchArtists`, and `fetchArtistCatalog`. AnisongDB accepts
  `"insert"` in `song_types`; checked live 2026-09-26.
- **AnimeThemes has no insert songs.** Its REST API accepts `type=IN` but
  returns zero themes. So an insert never has an AnimeThemes match: its
  `animethemesThemeId` is always null, and it takes `source: "anisongdb"` in
  `resolveThemes`.
- **Title matching could steal an OP/ED's identity.** A song can be both an
  ED and an insert on the same show. Today `resolveThemes`, `findThemeMatch`
  (used by song import, artist import, and the AnimeThemes match backfill),
  and 60c's `matchTheme` all pair by song title. Without a guard, an insert
  could pick up an OP/ED's AnimeThemes id and link slugs, or an OP/ED card
  could be re-sourced to the insert's clip.
- **Song import trusts the slot the search result carries**
  (`song-import.post.ts` upserts on `body.themeSlot`). That's why the slot has
  to be computable from one AnisongDB entry alone (see Data / contracts).
- Live sample: Madoka Magica (MAL 9756) has 5 inserts (`annSongId` 21048,
  21049, 48203, 48206, 48748) alongside 1 OP and 3 EDs. Inserts added later
  have higher ids.

## In scope

- A persistent `includeInsertSongs` setting (default off), with a route and a
  Settings control.
- Parsing and storing inserts from all three AnisongDB paths (per-anime
  import, song search, artist catalog), gated on the setting.
- Insert-safe title matching everywhere a song is paired with AnimeThemes or
  re-sourced.
- An "Insert" label in the five add-candidate lists: the Anime, Song, and
  Artist groups, the AniList/MAL list import, and the deck add-anime modal.

## Out of scope (85b or later)

- The Study / deck-from-filters OP/ED filter, grading for the OP/ED number,
  the `/stats` OP vs ED split, and slot labels anywhere outside the
  add-candidate lists. All of these are 85b.
- AnimeThemes-backed inserts. There are none to back them.
- Changing how Themes only (`themesOnly`) works. With it on, an insert is
  treated like any other song AnimeThemes lacks: shown disabled in import
  results and not served by Study. The new setting's hint says so.
- Deleting inserts when the setting is turned off. Like Clip source (64),
  narrowing a setting never deletes stored cards.

**Known interim state until 85b ships** (the setting is off by default, so
nobody sees this without opting in):
- Outside the add-candidate lists, an insert card's slot shows as the raw
  `IN-21049`.
- A deck graded on the OP/ED number always fails an insert.
- `/stats` counts inserts under "other".
- Choosing OP or ED in the Study filter excludes inserts.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Setting** - a Drizzle migration adds
  `media_library_settings.include_insert_songs` (boolean, not null, default
  false). Add `getIncludeInsertSongs`/`setIncludeInsertSongs` in
  `server/utils/mediaLibrary.ts` (modeled on `getThemesOnly`/`setThemesOnly`),
  a `POST /api/media-library/include-insert-songs` route (`{ enabled: boolean }`,
  400 otherwise), `includeInsertSongs` in `GET /api/media-library`, and a
  `SettingsIncludeInsertSongsControl.vue` toggle next to the Themes only
  control. Its hint says: off means imports skip insert songs; on means they
  appear in anime, song, and artist results; AnimeThemes.moe has no insert
  songs, so with Themes only also on they can't be added; turning it off
  never removes cards. Nothing reads the setting yet. *Done when:* the toggle
  saves and survives a reload, a bad body returns 400, and the build and tests
  pass.
- [x] **Step 2 - Parse inserts in the AnisongDB client** - in
  `server/lib/anisongdb.ts`, `fetchThemesByMalId`, `searchSongs`,
  `searchArtists`, and `fetchArtistCatalog` take an `{ includeInserts }`
  option, defaulting to false. When it's true, the `song_types` filter adds
  `"insert"`, and an `"Insert Song"` entry becomes slot `IN-<annSongId>` (see
  Data / contracts). An entry with no numeric `annSongId` is dropped. Inserts
  on one anime with the same song title and artist (`titleKey`) collapse into
  one theme: the slot uses the group's lowest `annSongId`, and the media comes
  from the best-ranked copy (existing `rank`). Export `isInsertSlot(slot)` from
  a new `server/utils/themeSlot.ts`. No caller passes true yet. *Done when:*
  unit tests cover the cases under Testing, and existing callers behave the
  same.
- [x] **Step 3 - Insert-safe matching** - an insert must never pair with an
  AnimeThemes theme, and an OP/ED must never pair with an insert:
  - `findThemeMatch(index, songTitle, themeSlot)` returns null for an insert
    slot. Update its three callers: song import, artist import, and
    `animethemesMatch.ts`. The backfill still stamps an insert as checked.
  - `resolveThemes` keeps AnisongDB inserts out of title pairing. They go
    straight to the leftovers loop as `source: "anisongdb"`.
  - `cardSourceRefresh.ts`'s `matchTheme` only considers themes of the same
    kind as the candidate (insert vs not).

  *Done when:* unit tests show that an insert whose title equals an
  AnimeThemes ED stays unpaired in `resolveThemes`, that `findThemeMatch`
  returns null for an insert slot, and that `matchTheme` never crosses kinds.
  Existing tests pass.
- [x] **Step 4 - Wire the setting through imports** - `resolveThemes`,
  `searchSongEntries`, `searchArtistCandidates`, and `resolveArtistThemes`
  take `includeInserts`, which the lookup routes (anime import, song and artist
  search, artist import, and the two typed-answer suggestion routes) read from
  `getIncludeInsertSongs()`, keeping the source helpers free of the database. Update the route
  tests' `vi.mock("../../utils/mediaLibrary.ts")` factories to provide it.
  *Done when:* with the setting on, importing Madoka Magica on `/cards` lists
  its 5 inserts; adding "Sis puella magica!" creates a card with `themeSlot`
  `IN-21049` that plays in Preview; a song search for "Sis puella" finds it;
  and an Eri Itou artist import includes her inserts. With the setting off,
  all three return exactly what they do today. Re-importing Madoka twice
  creates no duplicate `Song` rows.
- [x] **Step 5 - "Insert" label in add-candidate lists** - add
  `formatThemeSlotLabel(slot)` to `app/utils/themeSlotAnswer.ts`. It returns
  "Insert" for an `IN-` slot and the slot unchanged otherwise. Use it where
  `CardAddAnimeResults`, `CardAddSongResults`, `CardAddArtistResults`,
  `CardImportListResults`, and `DeckAddAnimeModal` print `themeSlot`.
  *Done when:* a unit test covers the helper, and a screenshot of Madoka's
  expanded Anime result shows "Insert" beside the insert rows and `OP1`/`ED2`
  beside the others.

## Files / areas

- `nuxt-app/server/db/schema.ts`, plus a new migration under
  `server/db/migrations/`
- `nuxt-app/server/utils/mediaLibrary.ts`, `server/api/media-library.get.ts`,
  and a new `server/api/media-library/include-insert-songs.post.ts`
- `nuxt-app/app/pages/settings.vue`, and a new
  `app/components/settings/SettingsIncludeInsertSongsControl.vue`
- `nuxt-app/server/lib/anisongdb.ts` (+ test), and a new
  `server/utils/themeSlot.ts` (+ test)
- `nuxt-app/server/utils/themeSource.ts`, `songSource.ts`, `artistSource.ts`,
  `animethemesMatch.ts`, and `cardSourceRefresh.ts` (+ their tests)
- `nuxt-app/server/api/lookup/song-import.post.ts` and `artist-import.post.ts`
  (the new `findThemeMatch` signature), plus the route tests' mocks
- `nuxt-app/app/utils/themeSlotAnswer.ts` (+ test), and the five
  add-candidate components listed in Step 5

## Data / contracts

- **Insert slot format (load-bearing, 85b builds on it):** `IN-<annSongId>`,
  for example `IN-21049`, stored in `Song.themeSlot`. This keeps
  `(animeId, themeSlot)` unique with no song schema change.
  `isInsertSlot(slot)` is `/^IN-\d+$/`. 85b's filter (`like 'IN%'`), stats
  bucket, grading, and labels all key on this prefix.
  - Chosen over the originally proposed per-anime `IN1`, `IN2`: an ordinal
    cannot be worked out from a single song-search or artist-catalog result,
    and song import upserts on the slot the search result carries. The plan
    wording was updated to match.
- **Setting:** `MediaLibrarySettings.includeInsertSongs` (boolean, not null,
  default false). `GET /api/media-library` gains `includeInsertSongs:
  boolean`, and `POST /api/media-library/include-insert-songs` takes
  `{ enabled: boolean }` and returns `{ includeInsertSongs: boolean }`.
- No response shape changes on the lookup routes. Inserts arrive through the
  existing `themeSlot` string field.
- Downloads name files `<anime> - IN-21049 - <artist>.<ext>`. Library scan
  (83) and deck export/import (9) round-trip the slot string unchanged.

## Testing

Vitest is on (`bun run test` in `nuxt-app/`), so these steps ship tests:

- **Step 2** (`anisongdb.test.ts`, `themeSlot.test.ts`):
  - `"Insert Song"` maps to `IN-<annSongId>` only when `includeInserts` is
    true, and is dropped when false.
  - An entry with no `annSongId` is dropped.
  - Duplicate inserts (same title and artist) collapse to the lowest id, with
    the best-ranked media.
  - `song_types` includes `"insert"` only when enabled.
  - `isInsertSlot` accepts `IN-21049` and rejects `IN1`, `OP1`, `ED2-EN`, and
    `IN-`.
- **Step 3**:
  - An insert whose title equals an AnimeThemes ED stays unpaired, and the
    ED keeps its own clip.
  - `findThemeMatch` returns null for an insert slot.
  - The backfill still stamps an insert as checked.
  - `matchTheme` never matches across kinds.
- **Step 4**: the route tests (`import-progress`, `song-import`,
  `artist-import`) are updated for the new mock and still pass.
- **Step 5**: `formatThemeSlotLabel` handles `IN-21049`, `OP1`, and `ED7-ShounenHen`.
- **Steps 1, 4, and 5 (UI and integration):** browser evidence. The toggle
  persists, the Madoka import lists inserts with the setting on and none with
  it off, the added insert plays in Preview, and the label screenshot.

## Notes for the AI

- Server-only logic stays in `server/`; components only call routes.
- Keep `server/lib/anisongdb.ts` independent of settings. It takes
  `includeInserts` as an argument, and the `server/utils/*Source.ts` layer
  reads the setting.
- Leave comments only where the reason isn't obvious: why the id is the slot,
  why inserts skip title pairing, and why AnimeThemes can never match one.
- Don't touch `normalizeThemeSlot`, `classifyThemeSlot`, `studyFilters.ts`, or
  any Study/Stats surface. Those are 85b.
- Never delete stored insert cards when the setting turns off.
- No em dashes in code comments or docs.

## Completion evidence

- `bun run test`: 83 files, 1313 tests passing. `bun run build`: passing.
- Isolated run (fresh build, `GAQ_SRS_DATA_DIR` in a scratch folder): Madoka
  Magica import returned 4 themes with the setting off and 9 with it on (5
  `IN-<annSongId>` inserts); a second import created no duplicate songs. Song
  search "Sis puella" found `IN-21049`; an Eri Itou artist import grouped her
  inserts by anime. The added insert card streamed (`/api/media/stream` 206
  audio/mpeg) and loaded in the Cards inspector.
- Screenshot: Madoka's expanded Anime result labels the five inserts
  "Insert" and keeps `OP1`/`ED1`-`ED3` on the others.
