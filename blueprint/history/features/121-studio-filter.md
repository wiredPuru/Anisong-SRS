# Feature: Studio filter

**From build-plan:** feature 121
**Status:** verified

## Goal

Add a Studio section to the shared filter form so a session, a deck build, or a
library search can be narrowed to shows animated by chosen studios (for example
Kyoto Animation or Shaft). The data is already stored; this only filters on it.

## In scope

- A new `studios: string[]` field on `StudyFilters`, in the server type and its
  hand-kept client copy (`app/utils/studyFilters.ts`), placed right after
  `formats` in both.
- Matching: a show matches when **any** picked studio is in its `Anime.studios`.
  An active studio filter drops a show with no studio recorded, like the year,
  score, season and format filters.
- Server: parse and validate `studios` in `parseStudyFilters`, apply it in
  `studyFilterCondition`, and list the studios present among anime with cards in
  `getStudyFilterOptions` (with a show count each, most shows first).
- Client: `EMPTY_STUDY_FILTERS`, `countActiveFilters` (one filter per picked
  studio, like genres), the stored-filter parse (a set saved before this reads
  as `[]`), and the form's Studio section: a search box over the library's
  studios, a suggestion list, and removable chips for the picked ones.
- It reaches every consumer of the form with no extra wiring: Study's Filters
  popup, "From filters" deck building (`/api/decks/filter-preview` and
  `copy-filtered`), `/cards`' library search (feature 99), and party mode's
  queue builder (they all parse through `parseStudyFilters`).

## Out of scope

- An exclude list or an "all of these studios" mode (any-of include only).
- Producers, licensors and non-main studios: only the main animation studios
  AniList gives are stored.
- The "Browse by filters" AniList catalog mode: the form hides the Studio
  section there (`catalog` prop), and `anilistBrowseBody.ts` ignores the field.
- A schema change, migration, backfill or new AniList query.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

## Build steps

- [x] **Step 1 - Server: parse, apply, list.** Add `studios` to the server
  `StudyFilters`, `parseNames` it (at most 50 entries, as genres), count it in
  `isEmpty`, add a `hasStudio` clause to `studyFilterCondition` that ORs the
  picked names over `json_each(anime.studios)`, and add
  `studios: { name: string; count: number }[]` to `StudyFilterOptions`. Update
  the existing tests that build a full `StudyFilters`. *Done when:* a Vitest
  case in `studyFilters.test.ts` shows `studios: ["Shaft", "Kyoto Animation"]`
  parses, an over-long or non-string list is rejected, an empty list is "no
  filter", and the condition keeps a show from either studio and drops one with
  `[]`; `studyFilterOptions.test.ts` shows counts and ordering; `bun run test`
  is green.
- [x] **Step 2 - Client filter util.** Add `studios` to the client
  `StudyFilters`, `EMPTY_STUDY_FILTERS`, `countActiveFilters`, the stored parse
  (`isStringList` check; missing field falls back to `[]`), and the
  `StudyFilterOptions` / `CatalogFilterOptions` shapes (`studios: []` for the
  catalog). Update the `libraryFilter` description if it names filter parts.
  *Done when:* `studyFilters.test.ts` (client) covers a set saved without
  `studios` loading as `[]`, a bad `studios` value resetting the set, and the
  active count rising by one per picked studio; `bun run test` is green.
- [x] **Step 3 - Studio section in the form.** In `StudyFilterForm.vue` add a
  Studio group after Format: search input, suggestions (click to add, already
  picked ones hidden, "No studio in your library matches that." empty hint,
  shown only while searching, capped at 12), and removable chips. Hidden when
  `catalog` is set. *Done when:* on `/study`, opening Filters, typing "shaft",
  adding it and pressing Apply narrows the queue and "N left" to Shaft shows and
  the Filters badge reads 1 more; in "From filters" the show list narrows the
  same way; reopening Study shows the chip restored; Browse by filters shows no
  Studio section; `bun run build` passes.

## Files / areas

- `nuxt-app/server/utils/studyFilters.ts` (+ `.test.ts`)
- `nuxt-app/server/utils/studyFilterOptions.ts` (+ `.test.ts`)
- tests that construct a full `StudyFilters`: `studyDueFilters.test.ts`,
  `deckFilterPreview.test.ts`, `cardsLibraryFilters.test.ts`,
  `cardDelete.test.ts`, `anilistBrowseBody.test.ts`
- `nuxt-app/app/utils/studyFilters.ts` (+ `.test.ts`), `app/utils/libraryFilter.ts`
- `nuxt-app/app/components/study/StudyFilterForm.vue`

## Data / contracts

- **Load-bearing:** `StudyFilters.studios: string[]`, after `formats`, in both
  hand-kept copies (server and client, same order), and sent inside the existing
  JSON `filters` param. A missing field means `[]`, so stored and in-flight
  filter sets from before this feature keep working.
- `GET /api/study/filter-options` gains `studios: { name; count }[]`. Additive.
- Reads `Anime.studios` (JSON `string[]`, existing). No schema or migration.
- Names match exactly as stored (case-sensitive), since the options list is
  built from the same column the filter reads.

## Testing

- Logic is in scope and the test gate is on: server parse/condition/options and
  client stored-parse/count each ship a Vitest case in the step that adds them.
- The form UI rides on browser evidence (Study Filters popup, "From filters",
  Browse by filters) plus `bun run build`.

## Notes for the AI

- Follow how genres are done end to end (`hasGenre`, `genresInclude`, the
  form's pill rows) and mirror it, minus the exclude half.
- 51 of 1,108 anime in the dev library have `studios = []`; they should drop out
  while the filter is on, never match by accident.
- Keep both `StudyFilters` copies in the same field order. No inline styles, no
  em dashes, comments only for the why.
- Feature 120 is still unmerged on `feature/quick-deck-from-card-edit`; this
  branch is cut from its tip. Do not touch the deck panel files.
