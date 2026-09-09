# AniList outage fallback

**Type:** Fix

**Status:** verified

**Branch:** `fix/anilist-outage-fallback`

## The problem
Anime search and metadata imports depend on AniList with no timeout or backup.
An outage blocks anime import and song import, causes artist imports to skip
anime, and also breaks the AniList ID resolution used by MyAnimeList imports.
Nav and deck searches can incorrectly present upstream failure as no matches.

On 2026-09-08 a direct public metadata query to `https://graphql.anilist.co`
returned HTTP 403 with the message "The AniList API has been temporarily
disabled due to severe stability issues." This confirms an upstream outage
at the time of the check, not just an application error.

## The fix
Keep AniList primary, with a shared server-side metadata resolver that falls
back to AnimeThemes on upstream unavailability. Reuse the existing AnimeThemes
GraphQL service rather than add another metadata service or a new ID system.
Use locally stored anime metadata when available during a failure; request
AnimeThemes metadata for uncached anime. Theme/media resolution still requires
AnimeThemes as it does today.

- Bound provider requests with a 5-second timeout. Fall back on network errors,
  timeouts, HTTP 403/429/5xx, invalid JSON, or unusable GraphQL responses. Treat
  a valid empty search or genuine not-found result normally. Do not hide
  request-validation errors as outages.
- After an availability failure, bypass AniList for 60 seconds in the current
  server process (honor a longer valid Retry-After for rate limits). Then allow
  a recovery attempt. Prevent repeated primary attempts inside a bulk import.
- For search, query AnimeThemes `animePagination(search:, first:)` and include
  `title { romaji english native }` and
  `resources(site: ANILIST, first: 1) { nodes { externalId } }`.
  Return at most 10 valid, distinct AniList-mapped candidates; skip missing or
  invalid mappings. Never use title similarity or an AnimeThemes/MAL ID as an
  AniList ID. Coverage is limited to anime present in AnimeThemes.
- For lookup by AniList ID, use the exact AnimeThemes external-site lookup.
  For MAL import resolution, use an exact MAL external-resource lookup followed
  by the same record's AniList mapping. Verify the live MAL site enum/query
  during implementation; no title-based identity guessing.
- Preserve richer stored English/native titles, cover URL, and AnimeThemes ID
  when fallback metadata omits them. Fresh rows can use existing title fallback
  conventions and no cover. Do not pass a missing fallback cover as an explicit
  null that clears stored art. Subsequent successful primary imports can enrich
  the same row without duplicate anime/cards.
- Route anime search, anime import, song import, artist import, and MAL ID
  resolution through this resolver. Preserve existing API candidate shapes and
  deduplication behavior. Keep AniList-specific transport in its own client.
- Surface an actionable lookup-unavailable error if both usable sources fail.
  Nav and deck search must distinguish this from a successful empty result.
  Preserve the existing artist-import partial-success reporting.
- AniList Completed-list retrieval cannot use AnimeThemes as a substitute.
  Show a clear temporary-unavailability message and keep any independently
  successful MAL results. Do not guess that the same username belongs to the
  user on another service or silently substitute another user's list.

## Build steps

- [x] **1. Add the metadata fallback resolver and integrate import routes.**
  Extend `server/lib/animethemes.ts`, add a focused resolver, and update lookup
  callers and metadata preservation in `server/utils/lookup.ts` as needed.
  Add colocated logic tests for failure classification, cooldown/recovery,
  response mapping, exact IDs, deduplication, and partial metadata preservation.
  **Done when:** simulated AniList downtime still allows mapped anime, song,
  and artist imports and MAL ID resolution, without duplicate rows or loss of
  richer stored metadata; primary recovery resumes automatically.
- [x] **2. Connect fallback search and make outage states accurate.**
  Use the resolver behind the existing anime-search endpoint; update affected
  Cards, nav, deck, and list-import error handling only where needed.
  **Done when:** anime search returns mapped AnimeThemes candidates during an
  AniList outage and selecting one can load its themes; failure of both sources
  is shown as an error, while valid empty search remains a no-results state.
  AniList list failure does not discard successful MAL results.

## Verify

- Run `bun run test` and `bun run build` from `nuxt-app/`.
- Test primary success, valid empty/not-found, 403, 429 with Retry-After, 5xx,
  timeout/network rejection, invalid JSON, GraphQL errors, backup failure,
  missing/duplicate/conflicting ID mappings, and cooldown recovery.
- In a controlled environment with AniList failure injected, search from
  Cards, nav, and deck search; expand an anime; add a song and an artist's
  songs. Use an isolated test database for imports, not the user's library.
- Re-import an existing anime with sparse backup data and confirm stored
  Japanese/English titles, art, IDs, and existing cards remain intact.
- Verify MAL mapping independently of AniList; a missing exact mapping is
  skipped, but a backup service error is not silently treated as an empty list.
- Confirm existing local cards and Study remain usable during either outage.

## Research evidence and limits

- A live AnimeThemes query on 2026-09-08 successfully searched Cowboy Bebop and
  returned AnimeThemes ID 521 mapped to AniList ID 1. Exact AniList lookup
  returned the same record. The movie had English/native titles; the TV record
  returned null for both, demonstrating the need to preserve local metadata.
- Public GraphQL introspection did not produce usable schema data. Search and
  exact AniList lookup were verified with real queries instead. MAL resource
  lookup and cover fields have not been live-verified for this proposal.
- [AnimeThemes API documentation](https://animethemes-animethemes-server.mintlify.app/introduction)
  documents anime metadata, GraphQL, search, and external integrations.
- AnimeThemes is a metadata fallback for AniList, not an independent backup
  for AnimeThemes media or AniList personal lists. No new dependency, schema
  migration, persistent catalog mirror, or settings panel is planned.

## Activation

Activated from `anilist-fallback-proposal.md` at the user's direction on
2026-09-09. The previous Study fix is committed as `8d32a08`; the active
spec was empty. No commit or merge is authorized by this implementation.

## Implementation evidence — step 1 (2026-09-09)

Step 1 was approved by the user on 2026-09-09. Step 2 is in progress. Branch: `fix/anilist-outage-fallback`.

- `bun run test` in `nuxt-app/`: 14 files, 111 tests passed.
- `bun run build` in `nuxt-app/`: passed.
- `git diff --check`: passed.
- Built-server smoke check on `127.0.0.1:3187`, with provider fetches
  controlled by a temporary preload and an isolated database under
  `/tmp/gaq-anilist-fallback-check/data`: anime/song/artist imports and MAL
  mapping passed during injected AniList HTTP 403. Only one primary request
  occurred. Four anime rows, four songs, and one existing card remained
  distinct; re-import preserved English/native titles, cover, mapping, and
  card progress. Both-provider failure returned an actionable HTTP 503;
  local Cards and Study APIs continued to work. The test server was stopped.
- Live AnimeThemes introspection verified `ResourceSite.MAL`; its exact MAL
  ID 1 lookup returned AnimeThemes 521, AniList 1 (Cowboy Bebop).
- Colocated tests cover failure classification, cooldown/recovery and its
  concurrent-request race, long bulk imports, exact mappings, invalid and
  conflicting IDs, search deduplication, and metadata preservation/enrichment.
- Actual timeout check: a localhost server sent headers then stalled its JSON
  body; the request aborted after 5003 ms with a provider-unavailable error.
- The implemented client also passed a live exact MAL lookup for ID 1,
  returning AnimeThemes ID 521 and AniList ID 1.
- Full step diff: `/tmp/gaq-anilist-fallback-check/step-1.diff`.
- Regular audit/check/try-guide gates: all `manual`. No browser verification
  yet; search/UI behavior is step 2. Existing unrelated finding F-14 (P2,
  preview launcher) remains open. No commits or merges made.

## Implementation evidence — step 2 (2026-09-09)

Step 2 was already substantially implemented in the working tree from the
prior session; this pass reviewed the diff against the spec, ran full
verification, and closed it out. Branch: `fix/anilist-outage-fallback`.

- `bun run test` in `nuxt-app/`: 14 files, 115 tests passed (up from 111 in
  step 1 - new coverage for the search/route wiring).
- `bun run build` in `nuxt-app/`: passed.
- `git diff --check`: passed.
- Reviewed every changed caller: `anilist-search.get.ts`, `import.post.ts`,
  `song-import.post.ts`, `artist-import.post.ts`, and `mal-list.get.ts` now
  route through `createAnimeMetadataResolver()`; `anilist-list.get.ts`
  (AniList's own Completed-list query) is deliberately untouched, matching
  the spec's "cannot use AnimeThemes as a substitute" requirement, and its
  `ProviderUnavailableError` already surfaces as a clean 503 through the
  existing error-propagation convention.
- Three built-server smoke checks against isolated databases under `/tmp`
  (each stopped after use, none touched the user's library):
  1. AniList forced to HTTP 403: `GET anilist-search?q=cowboy+bebop` returned
     two AnimeThemes-mapped candidates (aniListId 5 and 1); a query with no
     plausible matches returned `{"results":[]}` (genuine empty state, not an
     error); `POST import` for aniListId 1 succeeded, loading 4 real themes
     from AnimeThemes with title fallback since no row existed yet; `POST
     artist-import` for slug `lisa` resolved an 8-anime catalog with no
     duplicate anime rows; `artist-search` (AnimeThemes-native) was
     unaffected throughout.
  2. Both AniList and AnimeThemes forced to HTTP 503: `anilist-search`
     returned an actionable `HTTP 503` with statusMessage "Anime metadata
     lookup is temporarily unavailable. Please try again later."; `GET
     /api/cards` still returned `200` with the local list, confirming
     existing cards/Study stay usable during a total outage.
  3. (Combined with check 1's server instance.)
- UI error-state wiring reviewed: `NavSearch.vue` and `decks/index.vue` now
  track a dedicated error ref per external search (separate from the
  existing pending/empty states) so an outage renders as an inline error
  message, not a false "no results"; `cards/index.vue`'s AniList/MAL
  Completed-list import already ran both sources via `Promise.allSettled`
  and now suppresses the "No completed anime found" empty state whenever
  either source errored, so a failing AniList list can't hide a genuinely
  empty result and can't discard an independently successful MAL list;
  `CardAddArtistResults.vue` surfaces `unavailableAnimeCount` as an inline
  notice alongside whatever anime groups did resolve.
- Regular audit/check/try-guide gates: all `manual`, not run this pass. No
  commits or merges made; both build steps are now complete and the fix is
  ready for `/complete` after a final review.
