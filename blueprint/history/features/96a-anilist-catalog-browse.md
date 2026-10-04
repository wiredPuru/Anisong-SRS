# AniList catalog browse (96a)

**Type:** Feature (build-plan item 96, sub-feature 96a of 96a-96b)
**Status:** verified

## Goal

The server half of "Browse and mass-add by filters": a filtered, paged query of
AniList's whole anime catalog that says which results are already in the
library, plus AniList's genre and tag lists for the filter form. No UI, so the
app behaves as it does today.

## In scope

- `POST /api/lookup/anilist-browse` (POST because tag and genre lists can be
  long): `{ filters, page }` -> `{ results: BrowseAnime[], hasNextPage }`.
- `GET /api/lookup/anilist-options` -> `{ genres: string[], tags: { name,
  category }[] }`, adult tags removed, cached in memory for 24h.
- Filters supported: year range, seasons, AniList score range, formats, genres
  include/exclude, tags include/exclude with a minimum tag rank. Sorted by
  popularity, 50 per page, adult (hentai) always excluded.
- Each result carries cover, titles, year, season, format, score, and
  `inLibrary` plus `cardCount` (0 when absent or card-less).

## Out of scope

- Any UI, the batch import, deck assignment (96b and later).
- Study's OP/ED and list filters (meaningless against the catalog).
- Sorting choices other than popularity; searching by title text.

## Decisions (made at intake)

- **Years** use AniList's `startDate` range (FuzzyDateInt), not `seasonYear`,
  since AniList cannot filter a range on `seasonYear`. A show spanning a
  boundary counts by its start.
- **Several seasons** fan out as one query per season, run in parallel for the
  same page and merged by popularity. `hasNextPage` is true if any season has
  more. Page contents are therefore approximately, not strictly, popularity
  ordered across seasons.
- **Failures**: an AniList outage or malformed reply surfaces as a 502-style
  `ProviderUnavailableError`, like the other AniList routes; nothing is cached
  on failure.
- **Library match** is by `anime.aniListId` with at least one card; shows with
  no cards read `inLibrary: false` so 96b still offers them.

## Build steps

- [x] 1. **Filters to a GraphQL request.** A pure `buildBrowseVariables(filters,
  page, season?)` in `server/lib/anilistBrowse.ts` mapping the filter shape to
  AniList's variables (`startDate_greater/lesser`, `genre_in/not_in`,
  `tag_in/not_in`, `minimumTagRank`, `format_in`, `averageScore_*`, `isAdult:
  false`, `sort: POPULARITY_DESC`), plus a `parseBrowseBody` validator
  (bounds, list sizes, page >= 1) in `server/utils/anilistBrowseBody.ts`.
  **Done when:** `bun run test` passes cases for each filter mapping, an empty
  filter set, year-end boundaries (`20101231`), an unknown format rejected, and
  an oversized tag list or page 0 rejected.
- [x] 2. **Catalog fetch + merge.** `browseAniList(filters, page)` in
  `server/lib/anilistBrowse.ts` runs the query (one per selected season),
  validates the reply into `AniListBrowseItem`, merges and de-duplicates by id,
  sorts by popularity, and reports `hasNextPage`. Tested with a mocked
  `requestAniList`.
  **Done when:** tests cover a single page, a multi-season merge with a
  duplicate id, a malformed media entry raising `ProviderUnavailableError`, and
  `hasNextPage` from any season.
- [x] 3. **Routes + library flags.** `anilist-browse.post.ts` (parse, browse,
  attach `inLibrary`/`cardCount` with one query over the returned ids) and
  `anilist-options.get.ts` (AniList `GenreCollection` and
  `MediaTagCollection`, non-adult only, 24h in-memory cache).
  **Done when:** tests cover the library flagging against an in-memory DB (a
  show with cards, one with none, one absent) and the options cache serving a
  second call without a second request; `curl` of both routes against the dev
  server returns data for `genres: ["Ecchi"]`.

## Files and areas

- Server: `server/lib/anilistBrowse.ts`, `server/utils/anilistBrowseBody.ts`,
  `server/utils/anilistBrowseLibrary.ts` (flags), the two routes under
  `server/api/lookup/`, each with a `*.test.ts` beside it.
- Reuses `requestAniList`, `ProviderUnavailableError`, and the existing
  `StudyFilters` shape for the fields it shares.

## Contracts (load-bearing for 96b)

```ts
interface BrowseAnime {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImageUrl: string | null;
  year: number | null;
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  format: string | null;
  averageScore: number | null;
  inLibrary: boolean;
  cardCount: number;
}
// POST body { filters: BrowseFilters; page: number }
// BrowseFilters: yearMin, yearMax, seasons, scoreMin, scoreMax, formats,
// genresInclude, genresExclude, tagsInclude, tagsExclude, tagMinRank
// (the StudyFilters fields that apply to a catalog, same names and order).
```

## Testing

All logic (variable mapping, validation, merge, library flags, cache) gets
Vitest tests per the project gate; the routes are thin and ride on the tests
plus a `curl` check and `bun run build`.

## Notes for the AI

- Call AniList only from the server, with the project's User-Agent via the
  existing client. Keep every provider failure degrading, never crashing.
- Do not touch `StudyFilterForm` or Study here; that is 96b.
- Update `project-overview.md`'s item 96 entry when `/complete` runs.
