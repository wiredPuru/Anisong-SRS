# Browse modal + mass add (96b)

**Type:** Feature (build-plan item 96, sub-feature 96b of 96a-96b)
**Status:** verified

## Goal

A "Browse by filters" button on `/cards` opens a modal that runs the shared
filter form against AniList's whole catalog (96a), lists the matches, and
mass-imports the ticked shows with feature 94's one-at-a-time importer.

## In scope

- `StudyFilterForm` gains a `catalog` mode: options come from
  `/api/lookup/anilist-options` (AniList genres, all tags, fixed formats), the
  Theme and Anime list sections are hidden, and tag suggestions are plain name
  matches with no library counts. Study and the deck modal are unchanged.
- `CardBrowseModal.vue`: filter form on the left; on the right a list of
  `BrowseAnime` (cover, title, year, format, score) loaded 50 at a time with
  infinite scroll, refetched from page 1 300ms after a filter change with stale
  answers dropped. Shows already in the library show an "In library, N cards"
  badge and are not selectable.
- Selection: every loaded, not-in-library show is ticked by default (unticks
  kept as a set), with Tick all / Untick all. A run adds at most 300 ticked
  shows, in list order, and says so when more are ticked.
- "Add N shows" runs `importAnimeBatch` over `/api/lookup/import-cards` with a
  progress bar, Cancel, and a summary (cards added, failed, nothing addable),
  then reloads the list from page 1 so imported shows read "In library" and
  emits `imported` so `/cards` reloads. The modal cannot be closed mid-run.

## Out of scope

- Adding the imported cards to a deck (combine with "From filters" later).
- Sorting options, title search, saving filter sets.
- Topping up a show that already has some cards (use `/cards` search).

## Decisions (made at intake)

- **In-library shows are disabled, not skipped silently**, so the count on the
  button always matches what will be imported.
- **Only loaded rows can be ticked**, so the count is honest; scrolling loads
  more, which arrive ticked.
- **Adult content** stays excluded server-side (96a); the form cannot offer it.

## Build steps

- [x] 1. **Catalog mode in the filter form.** `catalog` prop on
  `StudyFilterForm.vue`, plus a pure `catalogFilterOptions(options)` adapter in
  `app/utils/studyFilters.ts` (genres as given, tags as names with no ranks,
  formats from the fixed list, `missingDetailsCount` 0) and a pure
  `toBrowseFilters(draft)` picking the 11 catalog fields. Tests for both.
  **Done when:** `bun run test` passes the adapter and picker cases, and the
  deck modal and Study filter popup still render the same sections as before.
- [x] 2. **Browse list + selection logic.** Pure helpers in
  `app/utils/browseSelection.ts`: `selectableIds(results)`,
  `selectedForRun(results, unticked, cap)` returning `{ ids, truncated }`, and
  `mergePage(existing, incoming)` de-duplicating by id. Tests.
  **Done when:** tests cover in-library rows never selectable, unticks
  honoured, the 300 cap with `truncated`, and a duplicate id across pages.
- [x] 3. **The modal.** `CardBrowseModal.vue` (list, infinite scroll, debounced
  refetch with stale-answer guard, selection, batch import with progress and
  Cancel, summary, error and empty states) and the "Browse by filters" button
  on `/cards` wired to open it and reload on `imported`.
  **Done when:** `bun run build` passes, and in the running app the button
  opens the modal, Ecchi + 2010 to 2014 lists shows with a next page loading on
  scroll, in-library shows are badged and unselectable, and Add imports a
  ticked show whose cards then appear in `/cards`.

## Files and areas

- Client: `app/components/study/StudyFilterForm.vue`,
  `app/components/card/CardBrowseModal.vue`, `app/pages/cards/index.vue`,
  `app/utils/studyFilters.ts`, `app/utils/browseSelection.ts` (+ tests).
- Reuses `app/utils/importAnimeBatch.ts`, `POST /api/lookup/anilist-browse`,
  `GET /api/lookup/anilist-options`, `POST /api/lookup/import-cards`.

## Contracts

`BrowseAnime` and the browse body are as locked in 96a. `StudyFilterForm`'s
`v-model` stays `StudyFilters`; catalog mode ignores `themeTypes` and the list
fields, and `toBrowseFilters` drops them.

## Testing

Pure logic (adapter, picker, selection, paging merge) gets Vitest tests. The
modal and button are UI and ride on `bun run build` plus a run against the dev
server with real AniList.

## Notes for the AI

- Do not change what Study or the deck modal show. Keep the form edits behind
  `catalog`.
- Update `project-overview.md`'s item 96 entry and check off 96b and 96 when
  `/complete` runs.
