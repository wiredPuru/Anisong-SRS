# Feature: Import from AniList/MyAnimeList (Completed list)

**From build-plan:** feature 58
**Status:** verified

## Goal

Let the user enter their AniList and/or MyAnimeList username and browse their
public Completed-status anime list as add-candidates on `/cards`, so building a
card library from "everything I've already watched" doesn't require searching
for each anime by title one at a time. No account linking, no OAuth, no stored
credentials - both sources are read as public data by username only.

## In scope

- A new `GET /api/lookup/anilist-list` route: given a public AniList username,
  returns that user's Completed-status anime list normalized to the same
  `{ aniListId, titleRomaji, titleEnglish, titleNative, coverImageUrl }` shape
  `anilist-search` already returns.
- A new `GET /api/lookup/mal-list` route: given a public MyAnimeList username,
  fetches their Completed list via the unofficial Jikan API
  (`api.jikan.moe`), resolves each MAL entry to its AniList counterpart via
  AniList's `idMal` field, and returns the same normalized shape. An entry
  with no AniList counterpart is skipped, not fatal to the rest of the list
  (same degrade-gracefully precedent as feature 37a skipping an anime whose
  AniList round-trip fails).
- A new `CardImportListResults.vue` component that renders a list of
  candidates and, per result, expands into the exact same theme-picker
  interaction `CardAddAnimeResults.vue` already has: `POST
  /api/lookup/import`, per-theme Add / Add all / Download all, pre-marked
  "Added" state via `GET /api/cards/by-songs`. No schema change and no new
  import endpoint - both new lookup routes feed the *existing* `aniListId`
  ->`/api/lookup/import` pipeline unchanged.
- A small "Import from AniList / MyAnimeList" panel on `/cards`: two optional
  username fields (AniList, MyAnimeList) and an Import button. Submitting
  queries whichever fields are filled independently (one failing - unknown
  username, private list - doesn't block the other), merges the results,
  dedupes by `aniListId` (an anime on both lists shows once), and renders
  them through `CardImportListResults`.
- Clear, non-crashing errors for: unknown username, and a private/empty list
  (shown as "no completed anime found," not an error) on both sources.

## Out of scope

- OAuth account linking to AniList or MyAnimeList - explicitly rejected in
  favor of username-only public reads (a project-plan decision, not deferred
  scope).
- Any status other than Completed (Watching, Plan to Watch, Dropped, etc.) -
  Completed is the only list read.
- Automatic bulk card creation from the imported list - importing only
  produces browsable candidates; the user still picks themes to add per
  anime, same as today's Anime search group.
- Persisting the entered username(s) anywhere (no new settings field) -
  re-entering the username each time is accepted for this first version.
- Pagination/virtualization of a very large candidate list - rendered as one
  flat list; a follow-up can add infinite scroll if a real list turns out to
  be unwieldy.

## Build steps

- [x] **Step 1 - AniList Completed-list lookup** - add
  `fetchAniListCompletedList(username)` to `server/lib/anilist.ts` using
  AniList's public `MediaListCollection(userName: $u, type: ANIME, status:
  COMPLETED)` query (no auth required for a public list), mapped through the
  existing `toAniListAnime` normalizer. Add `server/api/lookup/anilist-list.get.ts`
  validating a required `username` query param, calling it, and returning
  `{ results }`. An AniList "user not found" error surfaces as a 404 with a
  clear message; a private or empty list returns `{ results: [] }`, not an
  error.
  *Done when:* `GET /api/lookup/anilist-list?username=<a real public AniList
  username>` returns that user's Completed anime as `{ results: [...] }`;
  `?username=<garbage>` returns a 404 with a readable message, not a 500.

- [x] **Step 2 - MyAnimeList Completed-list lookup via Jikan** - add
  `server/lib/jikan.ts` with `fetchMalCompletedList(username)`: paginate
  `GET https://api.jikan.moe/v4/users/{username}/animelist/completed`
  (confirm the exact path/query shape against Jikan's current docs at
  implementation time; cap at a sane page limit, e.g. 10, as a safety net
  against a malformed pagination response) to collect every MAL id. Resolve
  MAL ids to AniList entries by batching AniList's `Media(idMal_in: [...],
  type: ANIME)` filter (confirm `idMal_in` against AniList's live schema
  first - AniList's API was returning a stability-outage error as of this
  spec, so verify before relying on it; fall back to one `Media(idMal: $id)`
  call per entry if batching isn't available). Skip any MAL id with no
  AniList counterpart. Add `server/api/lookup/mal-list.get.ts` validating a
  required `username` query param and returning the same `{ results }` shape
  as Step 1's route. An unknown MAL username or empty/private list behaves
  the same as Step 1 (404 vs empty list).
  *Done when:* `GET /api/lookup/mal-list?username=<a real public MAL
  username>` returns `{ results: [...] }` with real `aniListId`s resolved;
  an unknown username returns a 404 with a readable message; an entry Jikan
  returns with no AniList match is silently absent from the results, not a
  thrown error.

- [x] **Step 3 - `CardImportListResults.vue` component** - new component
  under `app/components/card/`, structurally adapted from
  `CardAddAnimeResults.vue`'s expand-into-theme-picker (`toggleExpand`,
  `addCard`, `addAllThemes`, `downloadAllMedia`, `removeCard`, the
  `addedCards`/`adding`/`addError` reactive maps, and its scoped `<style>`
  block verbatim for visual consistency) but driven by a `results:
  AniListResult[]` prop instead of a live debounced search - there is no
  `query` input here, results arrive pre-fetched from the parent. Same
  props otherwise (`hasDefaultDownloadFolder`), same emits (`refresh`,
  `preview`). Not wired into `/cards` yet, so this step is diff-reviewed
  against its source component rather than exercised live.
  *Done when:* `bun run build` passes with the new component compiling
  cleanly, and a side-by-side diff review against `CardAddAnimeResults.vue`
  confirms every kept behavior (expand, add, add all, download all, remove,
  added-state) is intact with only the results-source swapped.

- [x] **Step 4 - Import panel on `/cards` + merge/dedupe** - add a small
  `app/utils/importCandidates.ts` exporting `mergeImportCandidates(lists:
  AniListResult[][]): AniListResult[]` (concatenate, dedupe by `aniListId`,
  first occurrence wins) with a focused unit test (empty lists, no overlap,
  full overlap, partial overlap - the test gate applies since this is a
  pure function with a real right/wrong answer). Wire a collapsible "Import
  from AniList / MyAnimeList" panel into `cards/index.vue`: two username
  inputs, an Import button, independent `$fetch` calls to
  `/api/lookup/anilist-list` and `/api/lookup/mal-list` for whichever
  fields are filled (via `Promise.allSettled` so one failing surfaces its
  own inline error without blocking the other), merged through
  `mergeImportCandidates`, rendered via `CardImportListResults`.
  *Done when:* entering a real public AniList username and/or MAL username
  and clicking Import shows a deduped candidate list on `/cards`; expanding
  a candidate and adding a theme creates a real card exactly like the
  existing Anime search group; entering a bad username in one field while
  the other is valid still shows that source's results, with an inline
  error only for the bad one.

## Files / areas

- `server/lib/anilist.ts` - add `fetchAniListCompletedList`, and either
  `fetchAniListByMalIds` (batched) or a per-id equivalent
- `server/lib/jikan.ts` - new
- `server/api/lookup/anilist-list.get.ts` - new
- `server/api/lookup/mal-list.get.ts` - new
- `app/components/card/CardImportListResults.vue` - new
- `app/utils/importCandidates.ts` - new, plus `importCandidates.test.ts`
- `app/pages/cards/index.vue` - add the import panel + wiring

## Data / contracts

No schema change. Both new routes return the existing `AniListResult` shape
(`{ aniListId, titleRomaji, titleEnglish, titleNative, coverImageUrl }`,
already defined client-side in `CardAddAnimeResults.vue` and server-side as
`AniListAnime` in `server/lib/anilist.ts`) so `CardImportListResults.vue` and
the existing `POST /api/lookup/import` need no new types.

## Testing

- `app/utils/importCandidates.test.ts` - the one new pure-logic unit: dedupe
  behavior for empty/disjoint/overlapping candidate lists. Required by the
  test gate (Vitest is configured).
- Everything else is external-API integration or Vue components, matching
  the existing untested precedent for `server/lib/anilist.ts`,
  `server/lib/animethemes.ts`, and every `CardAdd*Results.vue` sibling -
  verified by running the real endpoints against real public usernames and
  by browser evidence on `/cards`, not unit tests.
- Manual verification path: a real public AniList username with a non-empty
  Completed list; a real public MAL username; one deliberately wrong
  username in each field; a username whose list is empty or private.

## Verification gaps (pending AniList/Jikan recovery)

- Step 1: `GET /api/lookup/anilist-list` confirmed to degrade cleanly (same
  500-with-real-message shape as the already-shipped `anilist-search` route)
  against the live outage, but the happy path and the 404-unknown-username
  path are unverified against real data. Re-check before `/complete`.
- Step 2: `GET /api/lookup/mal-list` confirmed to degrade cleanly against a
  live Jikan 504 (Jikan can't reach MAL right now). The exact
  `JikanAnimeListResponse` field shape (`data[].anime.mal_id`/`.title`,
  `pagination.has_next_page`) is coded from Jikan's documented v4 schema but
  has never been exercised against a real successful response - confirm
  once Jikan's animelist endpoint is reachable, and adjust the parsing if
  the live shape differs. The AniList `idMal` crosswalk is similarly
  unverified pending AniList's own recovery.

## Notes for the AI

- **AniList's API was down during spec-writing** ("temporarily disabled due
  to severe stability issues" as of 2026-09-05). Steps 1 and 2 can't be
  verified against the live API until it's back - check before starting
  `/implement`, and if it's still down, build against the documented public
  schema and flag verification as blocked rather than skipping it silently.
- Reuse `server/utils/mediaDownload.ts`'s `USER_AGENT` constant for the
  Jikan fetch too - animethemes.moe and AniList both required a non-default
  `User-Agent` (feature 3/48), and Jikan/MAL may be equally strict.
- `CardImportListResults.vue` is a deliberate near-duplicate of
  `CardAddAnimeResults.vue`, not a shared composable - matches this
  codebase's existing convention of one independent component per
  add-candidate group (feature 49's notes: "a slow or failed lookup can't
  block the other groups").
- Keep the Jikan-to-AniList crosswalk sequential/batched rather than
  firing one AniList request per MAL entry unbatched - a large Completed
  list (hundreds of anime) hitting AniList one-by-one risks the same kind
  of rate-limit trouble a "good API citizen" pattern already avoids
  elsewhere (feature 37b's sequential, not parallel, downloads).
- `username` query params reach an external API verbatim - validate they're
  non-empty, trimmed strings before use; no other sanitization needed since
  neither route touches the local filesystem or DB with the value beyond
  that.
