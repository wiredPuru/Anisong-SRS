# Feature: Community song difficulty - field, storage and import

**From build-plan:** feature 112a (first sub-feature of 112)
**Status:** not started

## Goal

Store AMQ's per-song guess rate on every song, so 112b can show it as a chip and
filter on it. This sub-feature is data only: read the rate from AnisongDB at
import, keep it on `Song`, and fill it for songs already in the library with a
Settings backfill. The app looks the same afterwards, except for the Settings
control that reports how many songs have a rate.

The rate is "community" difficulty: how often AMQ players guess the song. It is
unrelated to the user's own review history, and Spotify or YouTube plays are not
used (they measure fame, not recognisability from a clip).

## In scope

- **Confirm the AnisongDB field** from a real response before anything depends on
  it (see the unconfirmed assumptions below).
- **Storage:** two nullable columns on `Song`.
  - `communityDifficulty` (real, 0-100): AMQ's guess rate in percent. Higher is
    easier. Null means unknown.
  - `communityDifficultyCheckedAt` (timestamp): set when AnisongDB was asked and
    answered, whether or not it carried a rate, so a genuine miss is not
    re-probed (the same idea as `animethemesCheckedAt`).
- **A pure parser** `parseCommunityDifficulty(value)` in `server/lib/anisongdb.ts`
  that accepts a finite number from 0 to 100 and returns null for anything else
  (missing, a string, NaN, negative, over 100).
- **Import:** every path that creates or updates a `Song` from an AnisongDB entry
  carries the rate through to `upsertSong`:
  - anime import (`resolveThemes` -> `ResolvedTheme` -> `importAnimeThemes`),
  - song import (`/api/lookup/song-import`, from `AnisongSongResult`),
  - artist import (`/api/lookup/artist-import`).
- **Upsert rule:** a non-null rate overwrites (it drifts as more people play), a
  null rate never erases a stored one, and `communityDifficultyCheckedAt` is set
  whenever the provider supplied an entry. Same shape as the existing null-key
  rule in `upsertSong`.
- **Backfill:** a Settings action fills songs that back a card and have never
  been checked, one AniList lookup (for the MAL id) and one AnisongDB request per
  anime, with progress, rate-limit waiting and outage handling like feature 60c's
  Re-source. It reports checked / filled / no rate / unavailable.
- **Offline mode** blocks import lookups and the backfill (`assertOnline`); stored
  rates are untouched.

## Out of scope

- Any chip, filter, sort or other display of the rate (112b).
- The user's own difficulty from `ReviewLog`, and any blend of the two.
- Putting the rate on `CardWithDetails` or any API response. 112b locks that
  shape; here the value is readable only from the database and the Settings count.
- Deck export/import manifests (`deckImport.ts`): a manifest carries no rate, and
  re-resolving through the backfill is the way to fill it.
- Spotify, YouTube or any second source.
- Showing a rate for a song AnisongDB has no entry for.

## Unconfirmed assumptions (decide at step 1)

This environment cannot reach anisongdb.com (the proxy refuses it), so these are
from memory and are checked on the user's machine first:

1. **Field name:** each AnisongDB entry carries `songDifficulty`, a guess rate in
   percent. Our client reads no such field today.
2. **Range and direction:** 0-100, higher easier.
3. **Bands (for 112b, but chosen here):** AMQ's own cut-offs are not known to me.
   Proposed default, to be confirmed or replaced: Easy 70 and up, Medium 40-69,
   Hard 20-39, Very hard under 20. 112a stores only the number, so the bands can
   change later without a migration.

If step 1 finds no such field, stop and come back to the user; nothing else in
this sub-feature has a source.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [ ] **Step 1 - Confirm the field and the parser** - the user runs one command on
  their machine and pastes the output; I confirm the field name, range, and
  whether insert songs and rebroadcast copies carry it. Then add
  `parseCommunityDifficulty` to `server/lib/anisongdb.ts` with a test file of
  real (trimmed) entries as fixtures.
  - The command (read-only, no key needed):
    `curl -s -X POST https://anisongdb.com/api/mal_ids_request -H 'content-type: application/json' -d '{"mal_ids":[5114],"ignore_duplicate":true}' | head -c 3000`
    (5114 is Fullmetal Alchemist: Brotherhood.)
  - *Done when:* the pasted response shows the field and the user agrees the
    bands, and `bunx vitest run server/lib/anisongdb.test.ts` passes cases for a
    valid number, 0, 100, a numeric string (rejected), negative, over 100, NaN,
    missing and null.
- [ ] **Step 2 - Columns and upsert** - add `communityDifficulty` and
  `communityDifficultyCheckedAt` to `song` in `server/db/schema.ts`, generate the
  next Drizzle migration (`0042`, never hand-written SQL), and extend
  `upsertSong` with the rule above.
  - *Done when:* the migration applies on a copy of the demo database and existing
    rows read null; a new `server/utils/lookup.test.ts` (no test covers
    `upsertSong` today; use the in-memory database approach other server tests
    use) covers insert with a rate, re-import with a new rate
    (overwrites), re-import with null (keeps the stored value) and the checked-at
    stamp; `bun run test` passes.
- [ ] **Step 3 - Carry the rate through import** - add `communityDifficulty` to
  `AnisongTheme`, `AnisongSongResult` and `ResolvedTheme`; `toTheme` and
  `toSongResult` read it with the parser; `resolveThemes` keeps it when it merges
  an AnisongDB theme with an AnimeThemes one (an AnimeThemes-only theme stays
  null); `importAnimeThemes`, `song-import` and `artist-import` pass it to
  `upsertSong`. When copies of one theme collapse to the best entry (the
  `outranks` rule), the rate comes from the entry that was chosen.
  - *Done when:* tests cover `toTheme`/`toSongResult` reading the field, the
    merge keeping it, and a collapsed rebroadcast taking the chosen entry's value;
    importing an anime in the demo app (AnisongDB stubbed with a Fetch
    interception script as in earlier verification) leaves `communityDifficulty`
    set on its songs and `communityDifficultyCheckedAt` stamped.
- [ ] **Step 4 - Backfill logic and route** - `server/utils/communityDifficulty.ts`
  with `listDifficultyCandidates()` (songs backing a card with a null
  `communityDifficultyCheckedAt`) and `backfillCommunityDifficulty(candidates,
  deps, report)`, pairing a candidate to an AnisongDB theme with the existing
  `matchTheme` (title first, slot only to break a tie) so a differently
  romanised title is left unfilled rather than guessed. The AniList rate-limit
  waiting that `refreshCardSources` does privately moves into a small shared
  helper rather than being copied. Route `POST /api/lookup/community-difficulty`
  via `respondWithImportProgress`.
  - *Done when:* tests (injected deps, like `backfillAnimeThemesMatches`) cover a
    match, a title AnisongDB lacks, an anime with no MAL id, an AniList outage
    (rows stay unstamped), an AnisongDB entry with no rate (stamped, still null)
    and offline mode refusing; the existing `cardSourceRefresh.test.ts` still
    passes unchanged after the helper moves; `bun run test` passes.
- [ ] **Step 5 - Settings control** - `SettingsCommunityDifficultyControl.vue`
  next to the other backfill controls, in the style of
  `SettingsAnimeThemesMatchControl.vue`: "N of M songs have a community
  difficulty", a Fill button and the progress readout; the two counts come from
  `server/api/media-library.get.ts` as the other backfills' do.
  - *Done when:* in headless Chrome with stubbed providers the control shows the
    count, a run fills the songs, the count rises, a second run checks nothing,
    and the offline-mode state explains why Fill is unavailable.
- [ ] **Step 6 - Verify end to end** - run the full suite, the typecheck and the
  build, and screenshot Settings before and after a fill.
  - *Done when:* `bun run test`, the typecheck and `bun run build` pass and the
    screenshots are attached.

## Files / areas

- Changed: `server/lib/anisongdb.ts`, `server/db/schema.ts`, a new migration,
  `server/utils/lookup.ts` (`upsertSong`), `server/utils/themeSource.ts`,
  `server/utils/animeImport.ts`, `server/api/lookup/song-import.post.ts`,
  `server/api/lookup/artist-import.post.ts`, `server/utils/cardSourceRefresh.ts`
  (shared rate-limit helper only), the Settings page that lists the other
  backfill controls.
- New: `server/utils/communityDifficulty.ts` and its test,
  `server/api/lookup/community-difficulty.post.ts`,
  `app/components/settings/SettingsCommunityDifficultyControl.vue`, a count in
  the settings payload (`server/api/media-library.get.ts`, as the other
  backfills do).

## Data / contracts

- **Load-bearing for 112b:** `Song.communityDifficulty` (real, nullable, percent
  0-100, higher easier) and `Song.communityDifficultyCheckedAt` (timestamp,
  nullable). A null rate with a stamp means AnisongDB answered with no rate; a
  null rate with no stamp means never asked.
- `parseCommunityDifficulty(value: unknown): number | null`.
- No change to `CardWithDetails` or any existing response in this sub-feature.

## Testing

Test gate is on (Vitest). Logic that needs tests: the parser, `upsertSong`'s
rate rule, the theme/result readers, the merge and collapse behaviour, the
backfill (injected deps) and the candidate query. UI (the Settings control) and
the live import ride on browser evidence with stubbed providers, since
anisongdb.com is unreachable from the build environment. A real AnisongDB fetch
is therefore checked by the user, as in feature 60.

## Notes for the AI

- Follow `animethemesMatch.ts` for the backfill shape and
  `cardSourceRefresh.ts` for the per-anime AniList-then-AnisongDB flow; do not
  add a second way to obtain MAL ids.
- All schema changes go through Drizzle migrations. Do not edit an applied one.
- Keep the percent as sent (real), never rounded on write; bucketing is 112b's job.
- Migrations: master is at `0041`; confirm the next number when generating.
- No em dashes in code, comments or docs.
