# Import the rest of an anime list

**Type:** Feature (build-plan item 94, sub-features 94a-94b)
**Status:** verified

## Goal

When an Anime list is active in the deck-building filter form, offer to import
the list's anime that are not in the library, so "27 in your library" of a
502-show list is no longer a dead end.

## Built

- 94a: `missingAniListIds` on `resolveListAnimeIds`; `importAnimeThemes` and
  `addCardsForThemes` in `server/utils/animeImport.ts`; `POST
  /api/lookup/import-cards`. Tests: `studyListFilter.test.ts`,
  `animeImport.test.ts`.
- 94b: "Import the rest (N)" in `StudyFilterForm` (`importable`, deck modal
  only); `importAnimeBatch` with a unit test.

## Verification

`bun run test` (1642 passing) and `bun run build`. Not exercised against the
live AniList/AnisongDB providers or in a browser.
