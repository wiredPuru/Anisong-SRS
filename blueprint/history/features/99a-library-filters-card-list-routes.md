# Feature: Library filters on the card list routes (99a)

**From build-plan:** feature 99a (first sub-feature of 99, "Search your library from Browse by filters")
**Status:** verified

## Goal

Let the card list routes narrow the library by anime-level filters (year, season,
score, format, genres, tags, OP/ED including Insert) and by "has a local file", so
99b can offer "which insert songs have I downloaded". Server only: no UI, so the app
behaves exactly as it does today.

## In scope

- `CardListFilters` (`server/utils/cards.ts`) gains two optional fields:
  `downloadedOnly` (the card has a local video or audio path) and `studyFilters`
  (a feature 76b `StudyFilters` or null, applied with `studyFilterCondition`, which
  already reads `anime` and `song` columns and `cardQuery`'s joins provide both).
- `cardSearchCondition` ANDs them in with the existing text, missing-match, and
  suspended conditions. `listCards` and `listCardIds` pick them up with no further change.
- `GET /api/cards` and `GET /api/cards/ids` read `downloaded=1` and a `filters` JSON
  string (the same format as `/api/study/next`, parsed by `parseStudyFilters`). An
  invalid `filters` string is a `400` with the parser's message, never ignored.
- `hasAnyCardsIdsFilter` counts a non-empty `studyFilters` or `downloadedOnly` as an
  active filter, so `/api/cards/ids` (and "Delete all matching") works from them
  alone, and still refuses to match the whole library when nothing is set. The `400`
  message names the new options.

## Out of scope

- Any UI: the modal switch, the Downloaded toggle, the chip (99b).
- Rejecting or trimming a `listAniListIds` list in `filters`: 99b never sends one.
- Separate video and audio "downloaded" flags (decided at intake: any local file).

## Build loop

Build one step at a time. Plan, implement just that step, show the diff, approve,
then optionally checkpoint. `/complete` makes the real commit.

## Build steps

- [x] **Step 1 - Conditions in the query layer** - add `downloadedOnly` and
  `studyFilters` to `CardListFilters` and `cardSearchCondition`, with a Vitest test
  against the in-memory database pattern in `studyFilters.test.ts` (seed an OP song
  and an insert song, one downloaded and one not). *Done when:* the test proves
  `listCards` and `listCardIds` return only the downloaded insert song for
  `{ downloadedOnly: true, studyFilters: { themeTypes: ["IN"] } }`, each condition
  works alone, a card with only a local audio path counts as downloaded, and
  existing filters still combine with them.
- [x] **Step 2 - Parse and route them** - `parseCardListFilters` reads `downloaded` and
  `filters` (returning an error for bad JSON so the routes can answer `400`), both
  routes pass them through, and `hasAnyCardsIdsFilter` counts them. Update
  `cardDelete.test.ts` for the new shape. *Done when:* `GET /api/cards?downloaded=1&filters={"themeTypes":["IN"]}`
  returns only downloaded insert songs, a malformed `filters` returns `400`,
  `GET /api/cards/ids` with only these set returns ids and with nothing set still
  returns `400`, and `bun run test` passes.

## Files / areas

- `nuxt-app/server/utils/cards.ts`, `cardDelete.ts` and their tests
  (`cardDelete.test.ts`, plus a new test beside `cards.ts`)
- `nuxt-app/server/api/cards.get.ts`, `nuxt-app/server/api/cards/ids.get.ts`

## Data / contracts

- No schema or migration change. `StudyFilters` and `parseStudyFilters` are reused as is.
- `CardListFilters` is load-bearing: 99b and the existing `/cards` toggles
  (`missingAnimeThemesMatch`, `suspendedOnly`) share it. New fields are optional, so
  current callers are untouched.
- Query params: `downloaded` (only the literal `"1"` turns it on, like the existing toggles)
  and `filters` (JSON string). Response shapes are unchanged.

## Testing

- Vitest is configured, so the logic gate applies: Step 1 ships the in-memory-DB test
  and Step 2 updates the parser tests.
- Manual check of the two routes with `curl` against the dev server, including the
  `400` cases. No UI to verify.

## Notes for the AI

- Client/server: server routes and utils only. No inline styles or components touched.
- `studyFilterCondition` only works inside a query that joins `anime` and `song`;
  `cardQuery`, `listCards`'s count query, and `listCardIds` all do, so check the
  count query in `listCards` gets the same condition (it uses `cardSearchCondition`).
- A filter set that parses to "no filtering" comes back as `null`, which must not count
  as an active filter in `hasAnyCardsIdsFilter`.
- Keep the 400 behaviour: an unfiltered `/api/cards/ids` must never match the whole
  library ("Delete all matching" safety, feature 61c).

## Outcome

Built as specced. `CardListFilters` gained `downloadedOnly` and `studyFilters`, `parseCardListFilters` now returns `{ filters } | { error }` (callers `cards.get.ts` and `ids.get.ts` answer `400` on an error), and `hasAnyCardsIdsFilter` counts both new options. Evidence: `bun run test` 1750 pass (new `cardsLibraryFilters.test.ts`, updated `cardDelete.test.ts`), `bun run build` passes, and `curl` against the dev server on the real library: `downloaded=1` with `themeTypes:["IN"]` returned 33 cards (463 inserts, 309 downloaded in total), bad JSON returned `400`, and `/api/cards/ids` with nothing or with `filters={}` still returned `400`.

