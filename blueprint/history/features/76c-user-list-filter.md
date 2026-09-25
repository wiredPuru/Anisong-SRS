# Feature: User-list filter

**From build-plan:** feature 76c (parent: 76 Study filters)
**Status:** verified

## Goal

Add one more Study filter: only anime on a public AniList or MyAnimeList
user's Completed list - your own, or anyone's. The list is fetched and matched
against the library once, when the filter is set or refreshed, never per card.

## In scope

- `GET /api/study/list-anime?site=anilist|mal&username=<name>`: fetch the
  Completed list (feature 58's clients), map it to AniList ids, and return only
  the ids of anime in the library that have at least one card.
- MAL ids mapped to AniList ids in batches of 50 with AniList's `idMal_in`,
  instead of feature 58's one request per anime.
- Two new `StudyFilters` fields (see Data / contracts): the matched ids, which
  the server filters on, and the list's site and username, for display.
- An "Anime list" section in `StudyFiltersModal`: site choice, username, a Use
  list button, then a summary chip with Refresh and Remove.
- Clear errors for a missing or private user and for a provider outage, which
  leave the draft unchanged.

## Out of scope

- Lists other than Completed (Watching, Planning, and so on).
- Refreshing automatically. The matched ids are a snapshot; anime added to the
  library afterwards join only after Refresh, which the chip's date explains.
- Storing a username anywhere but the browser's saved filters.

## Build steps

- [x] **Step 1 - Contract** - `listAniListIds` and `listSource` in the server
  `StudyFilters`, `parseStudyFilters` validation, and an `anime.aniListId IN
  (...)` condition. *Done when:* tests show a null list meaning off, an empty
  list matching nothing, a list narrowing cards, `listSource` ignored by the
  query but validated (site enum, username 1-100 characters, required exactly
  when the id list is set), and the id list capped at 5000 positive integers.
- [x] **Step 2 - List resolution endpoint** - `fetchAniListIdsByMalIds` in
  `lib/anilist.ts`, `resolveListAnimeIds(site, username, deps)` in
  `server/utils/studyListFilter.ts`, and the route. *Done when:* tests show
  AniList ids intersected with anime that have cards, MAL ids batched 50 per
  request and MAL entries without an AniList match counted as unmatched, the
  result `{ aniListIds, listSize, matched }`, a missing user as `404`, a blank
  username or bad site as `400`; and a live call for AniList user `Kyoto`
  against a scratch database returns a plausible match count.
- [x] **Step 3 - Client contract** - the two fields in
  `app/utils/studyFilters.ts`, counted as one filter, validated by
  `readStoredFilters`. *Done when:* util tests cover them.
- [x] **Step 4 - Anime list section** - in `StudyFiltersModal`. *Done when:*
  on a scratch database, entering AniList `Kyoto`, Use list, and Apply narrows
  "N left" to cards from that list; the chip reads the site, username, and
  matched count; an unknown username shows a not-found message; Remove clears
  it; and there are no new console errors (screenshot captured).

## Files / areas

- `nuxt-app/server/utils/studyFilters.ts` + test
- `nuxt-app/server/lib/anilist.ts` + test
- `nuxt-app/server/utils/studyListFilter.ts` + test (new)
- `nuxt-app/server/api/study/list-anime.get.ts` (new)
- `nuxt-app/app/utils/studyFilters.ts` + test
- `nuxt-app/app/components/study/StudyFiltersModal.vue`

## Data / contracts

Added to `StudyFilters` (server and client, same order, after `tagMinRank`):

```ts
listAniListIds: number[] | null; // null = off; [] = the list matched nothing
listSource: { site: "anilist" | "mal"; username: string; fetchedAt: string } | null;
```

`listSource` is set exactly when `listAniListIds` is. The server filters on
`anime.aniListId IN listAniListIds` and ignores `listSource`, which exists so
the popup can show and refresh the list. Only ids of anime already in the
library with cards are stored, which keeps the `filters` query param small
however long the user's list is.

`GET /api/study/list-anime` returns
`{ aniListIds: number[]; listSize: number; matched: number }`, where
`listSize` is the entries on the Completed list and `matched` how many of
them are in the library.

## Testing

Test gate is on. In-scope logic: the parser and condition (step 1), the MAL
batch lookup and the resolver with injected fetchers (step 2), and the client
util (step 3). The popup section is UI, verified in the browser on a scratch
database plus the build (step 4).

## Notes for the AI

- Never run the dev server against the live `.data/gaq-srs.db`; use a scratch
  copy via `GAQ_SRS_DATA_DIR`.
- The resolver calls AniList directly, like the backfills: a fallback provider
  cannot answer "what is on this user's list".
- Public test accounts found 2026-09-25: AniList `Kyoto` (194 completed), MAL
  `Xinil`.
- Leave `nuxt-app/study-loaded.yml` out of every commit.

## Outcome

Verified 2026-09-25 with `bun run test` (1100 passing) and `bun run build`,
plus live API and browser evidence against a scratch copy of the live
database (`GAQ_SRS_DATA_DIR`): AniList `Kyoto` resolved 194 completed anime
to 1 in the library; MAL `Xinil` resolved 233 to 7 in 1.2s through batched
`idMal_in` lookups; an unknown user returned 404 and a bad site or blank
username 400. In the browser, Use list then Apply narrowed 103 cards left to 9
with the badge at 1, an unknown MAL user showed "not found, or their list is
private" without changing the draft, and Remove then Apply restored 103.

The browser console showed one error beyond the pre-existing hydration
warning; it was not inspected before the browser closed, and is most likely
the browser logging the expected 404 from the unknown-user lookup.
