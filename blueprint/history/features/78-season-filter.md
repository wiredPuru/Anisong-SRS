# Feature: Season filter

**From build-plan:** feature 78
**Status:** verified

## Goal

Let the shared filters (Study, and building a deck from filters) narrow by
broadcast season as well as year: Winter / Spring / Summer / Fall chips applied
on top of the year range, so "Spring 2009" is year 2009 to 2009 plus Spring and
"2009-2012 plus Fall" is every Fall show in those years. Needs AniList's
`season` stored on `Anime`, which nothing keeps today.

## In scope

- `anime.season` (nullable text), filled from AniList's `season` on every
  import that fetches details, and on the existing Settings "Fetch missing
  details" backfill.
- A migration that adds the column and resets `ani_list_details_checked_at` to
  null for every anime, so one run of that backfill fills seasons for the
  library imported before this feature.
- `seasons` on `StudyFilters` (server and client), validated, counted as one
  active filter, and applied by `studyFilterCondition`, so Study's due queries
  and 77's deck preview and copy all respect it with no other change.
- Four season chips in `StudyFilterForm`'s Year section.
- Copy: the filter popup's "missing details" note and Settings' Anime details
  hint mention season, and the note no longer claims those anime have no
  details at all.

## Out of scope

- Season-precise ranges ("Spring 2009 to Fall 2012"). Decided: chips on top of
  the year range.
- Deriving a season from `startDate` for anime AniList gives none (movies,
  OVAs). They are dropped while a season filter is active, as unknown years are.
- Showing season anywhere else (info panel, `/cards`, deck tiles, stats).
- Running the backfill automatically. It stays the explicit Settings action.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - store `season`** - `schema.ts` gains `season:
  text("season").$type<AnimeSeason | null>()`; `bun run db:generate` makes
  migration `0022`, to which one hand-added statement is appended:
  `UPDATE anime SET ani_list_details_checked_at = NULL;` (with a comment saying
  why, like `0019`). `server/lib/anilist.ts`: `AnimeSeason` type and
  `ANIME_SEASONS` constant, `season` added to `DETAILS_FIELDS` (so the by-id and
  `id_in` batch queries both select it) and to `AniListDetails`;
  `toAniListDetails` maps a known value through and anything else (null,
  missing, or an unexpected string) to `null`, so an odd season never fails a
  whole import. `upsertAnime` and the backfill already spread
  `AniListDetails`, so they write it with no change. Settings' Anime details
  hint reads "Year, season, format, AniList score, genres, and tags, used by
  Study filters." *Done when:* `bun run test` passes with the details-mapping
  test in `anilist.test.ts` extended (each of the four seasons, null, and an
  unknown string mapping to null) and the backfill test asserting `season` is
  written; restarting the dev server applies `0022` (the `anime` table has a
  `season` column and every `ani_list_details_checked_at` is null, checked
  with `sqlite3` on `nuxt-app/.data/gaq-srs.db`), and Settings shows every
  anime as missing details.
- [x] **Step 2 - server filter** - `server/utils/studyFilters.ts`: `SEASONS`
  constant, `seasons: AnimeSeason[]` on `StudyFilters` right after `yearMax`,
  parsed with `parseNames(body.seasons, "seasons", SEASONS)` (missing means
  `[]`, so older stored filter sets still parse), included in `isEmpty`, and
  applied in `studyFilterCondition` as `isNotNull(anime.season)` plus
  `inArray(anime.season, seasons)`. *Done when:* `bun run test` passes with:
  parser cases (accepts and dedupes seasons, rejects an unknown season, a
  missing field still parses, a seasons-only filter is not empty); a
  due-query case in `studyDueFilters.test.ts` (Spring only serves Spring cards
  and skips a null-season anime); a `deckFilterPreview.test.ts` case (year
  2009 to 2009 plus Spring lists only Spring 2009 anime, and
  `copyFilteredCards` adds the same cards). Existing fixtures gain
  `seasons: []`.
- [x] **Step 3 - client filter + chips** - `app/utils/studyFilters.ts`:
  `StudySeason` type, `seasons` in `StudyFilters` (same position as the
  server) and `EMPTY_STUDY_FILTERS`, `countActiveFilters` counts a non-empty
  season list as one filter, `readStoredFilters` accepts a stored value
  without `seasons` (defaulting to `[]`) and falls back to no filters when
  `seasons` holds an unknown value. `StudyFilterForm.vue`: a "Season" chip row
  (Winter, Spring, Summer, Fall, in that order) inside the Year section, using
  the existing `pill` / `include` toggle pattern the Theme chips use. The
  missing-details note becomes: "N anime are missing some AniList details, so
  filters on them (such as season) leave those anime out. Fetch them in
  Settings." *Done when:* `bun run test` passes with cases in
  `app/utils/studyFilters.test.ts` (`readStoredFilters` on a pre-78 stored
  value gives `seasons: []`, an unknown season falls back to empty filters,
  `countActiveFilters` counts seasons once); `bun run build` passes; in a
  browser, the Study Filters popup shows the four chips under Year, toggling
  one updates the Apply count, and "From filters" on a deck shows them too; no
  console errors.
- [x] **Step 4 - backfill the library and prove it end to end** - run
  Settings' "Fetch missing details" on the real library (the user's own
  intended action for this feature; it only rewrites AniList metadata columns
  on `anime`). *Done when:* Settings reports every anime has details again;
  `sqlite3` shows seasons filled for TV shows and null mostly for
  movies/OVAs (counts reported); in the browser, a deck's "From filters" with
  year 2009 to 2009 and Spring lists only anime whose stored season and year
  are Spring 2009 (cross-checked with `sqlite3`); the same filter in Study
  serves a matching card or shows "All caught up" naming the active filters.
  No decks or cards are created.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `nuxt-app/server/db/migrations/0022_*.sql`
  (+ drizzle meta)
- `nuxt-app/server/lib/anilist.ts` (+ `anilist.test.ts`)
- `nuxt-app/server/utils/animeDetailsBackfill.test.ts`
- `nuxt-app/server/utils/studyFilters.ts` (+ test), `studyDueFilters.test.ts`,
  `deckFilterPreview.test.ts`
- `nuxt-app/app/utils/studyFilters.ts` (+ test)
- `nuxt-app/app/components/study/StudyFilterForm.vue`
- `nuxt-app/app/components/settings/SettingsAnimeDetailsControl.vue` (hint copy)

## Data / contracts

- `anime.season`: `"WINTER" | "SPRING" | "SUMMER" | "FALL" | null`, AniList's
  `MediaSeason` as sent. Null means AniList gave none, or it has not been
  fetched yet (`aniListDetailsCheckedAt` null).
- `AniListDetails` gains `season: AnimeSeason | null` (load-bearing: import,
  backfill, and `upsertAnime` all spread it).
- `StudyFilters` gains `seasons: AnimeSeason[]` after `yearMax`, on both the
  server type and its hand-kept client copy (F-09 convention). A missing
  `seasons` parses as `[]` on both sides, so Study filters saved in
  `localStorage` before 78 keep working.
- Migration `0022` deliberately resets `ani_list_details_checked_at` for every
  anime. Until the backfill runs, year, score, format, genre and tag filters
  still work from the values already stored; only season is empty.

## Testing

Vitest is configured, so the gate is on.

- **Step 1**: AniList details mapping (four seasons, null, unknown) and the
  backfill writing `season`.
- **Step 2**: parser, due-query, and deck preview/copy cases listed in the step.
- **Step 3**: `readStoredFilters` and `countActiveFilters` cases; chips are UI
  and ride on browser evidence plus the build.
- **Step 4**: integration against the real library and AniList, browser and
  `sqlite3` evidence.

## Notes for the AI

- Server: SQL stays in `server/utils/`; no route changes are needed, since
  Study, the filter options, and 77's preview and copy all build their
  condition from `studyFilterCondition`.
- Keep `StudyFilters` field order identical on server and client, and update
  every hand-written fixture that builds a full `StudyFilters` object.
- Migration: use `db:generate` for the column, then append the reset `UPDATE`
  by hand with a `--> statement-breakpoint` separator and a leading comment;
  never edit an already-applied migration.
- The popup's filter-options endpoint needs no change: the chips are a fixed
  four, not derived from the library.
- Step 4 changes only AniList metadata columns on `anime`; it creates no decks
  or cards.
- No em dashes in copy, comments, or commit messages.
