# AniList outage fallback

## Type
Fix

## Status
not started (proposal; not the active work item)

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

- [ ] **1. Add the metadata fallback resolver and integrate import routes.**
  Extend `server/lib/animethemes.ts`, add a focused resolver, and update lookup
  callers and metadata preservation in `server/utils/lookup.ts` as needed.
  Add colocated logic tests for failure classification, cooldown/recovery,
  response mapping, exact IDs, deduplication, and partial metadata preservation.
  **Done when:** simulated AniList downtime still allows mapped anime, song,
  and artist imports and MAL ID resolution, without duplicate rows or loss of
  richer stored metadata; primary recovery resumes automatically.
- [ ] **2. Connect fallback search and make outage states accurate.**
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

`current-feature.md` still holds the approved but uncompleted
`fix/study-click-to-reveal` work. Preserve that spec, branch, and existing
unrelated working-tree changes. Activate this proposal only after the user
chooses to finish or set aside the current work. This proposal does not claim
that either fix is complete and does not authorize a commit or merge.
