# Feature: Local-first anime metadata resolution

**From build-plan:** feature 107a (Offline-first library)
**Status:** verified

## Goal

Resolve anime already in the local SQLite library without waiting on AniList.
Keep saved metadata stable during ordinary use and give the user a deliberate
way to refresh one saved anime online. This is the first slice of feature 107,
not a promise that every import, search, or playback path is offline yet.

## Design reference

Use the existing Cards inspector and its action/error styles. No visual
replication or redesign. The new action is a small existing-style button.

## In scope

- Local-first `createAnimeMetadataResolver().byAniListId()` for saved rows.
- Return saved titles, cover URL, external references, and filter details
  without calling providers or changing timestamps on a local hit.
- Preserve saved metadata when re-importing the same anime, including rich
  fields a sparse provider does not supply.
- Explicit single-anime refresh through a local POST route and a Cards
  inspector action labeled "Refresh anime metadata".
- Fetch fresh, validated AniList metadata on refresh, not a stale API-cache
  answer or an AnimeThemes fallback presented as a successful refresh.
- Keep source acquisition working: local-first metadata must not silently
  remove the MAL mapping required to query AnisongDB.

## Out of scope

- Offline toggle and global external-request suppression (107b).
- Offline messages throughout Study, Listen, Party, and discovery (107c).
- New catalog storage, crawling, bulk refresh, or API-cache retention changes.
- Backup/restore, replacing AniList identity, or changing existing external IDs.
- Automatically refreshing saved rows due to age or sparse metadata.
- Refreshing song metadata, downloading media, or replacing local cover files.
- Rebuilding cover storage/backfill, which already exists.
- Changing live catalog searches, MAL list fetching, or theme-source preference.
- Accepting existing provider-storage practices as compliant. That policy review
  remains separate; do not expand collection under this spec.

## Build loop

Build one small step at a time, verify it, self-review, and check it off only
after it passes. The explicitly requested Autopilot may bypass normal step
review and create configured feature-branch checkpoints, but stops before
completion, merge, or push. Never mix unrelated working-tree edits into it.

## Build steps

- [x] **Step 1 - Local metadata adapter and lookup** - map a saved Anime row
  to `AnimeMetadata` and make AniList-ID resolution check SQLite first.
  Add adjacent logic tests. *Done when:* a saved anime resolves with provider
  functions set to throw and zero provider calls; missing rows retain current
  primary/fallback/not-found semantics; invalid IDs fail before any lookup;
  reading never changes saved metadata or `aniListDetailsCheckedAt`.
- [x] **Step 2 - Preserve import contracts** - review single-anime, song, and
  artist imports against the local adapter. Keep stored filter details and
  identifiers intact; ensure source-specific MAL mapping acquisition remains
  explicit and does not turn ordinary metadata reads back into online reads.
  Add regression tests with existing cards and mocked providers. *Done when:*
  re-import retains anime/card identity, schedules, notes, local paths, rich
  metadata, and existing covers; AnisongDB continues to be queried with the
  correct MAL ID when available, including an AniList-only existing row.
- [x] **Step 3 - Fresh single-anime refresh logic** - add a fresh AniList
  by-ID operation and a service that validates the selected stored row,
  fetches before writing, and atomically updates only anime metadata.
  *Done when:* stale cache cannot count as refresh success; null, mismatched,
  malformed, rate-limited, or unavailable responses leave the row unchanged;
  a valid response updates the existing row without modifying cards, songs,
  reviews, deck memberships, external AnimeThemes mappings, or local covers.
- [x] **Step 4 - Refresh route** - add
  `POST /api/lookup/anime-metadata-refresh` with the contract below, using
  the existing local-app and party-door boundaries. *Done when:* malformed
  input and missing saved rows fail before a provider call; success and
  failures have the specified responses; party display/player doors cannot
  reach this write operation. Verify against an isolated test database.
- [x] **Step 5 - Inspector refresh action** - add the button with pending,
  success, and error states, using a focused component/composable if needed.
  *Done when:* one click requests only the selected anime; repeat clicks are
  disabled while pending; all cards for it show updated data after normal
  list/detail reload; selection changes cannot apply old results or messages
  to a different anime; failure preserves the visible card and allows retry.
- [x] **Step 6 - Final verification** - run the full documented tests and
  build, and capture browser/API evidence. *Done when:* all checks pass,
  local resolution is observed without external calls, successful and failed
  refresh are demonstrated, and no claim of complete offline mode is made.

## Files / areas

- Server: `server/utils/animeMetadata.ts`, `server/utils/lookup.ts`,
  `server/lib/anilist.ts`, and their adjacent tests.
- Import consumers: `server/utils/animeImport.ts`,
  `server/api/lookup/song-import.post.ts`, and
  `server/api/lookup/artist-import.post.ts`, only as required by step 2.
- New `server/utils/animeMetadataRefresh.ts` and adjacent logic tests;
  `server/api/lookup/anime-metadata-refresh.post.ts`.
- Client: `app/components/card/CardInspector.vue` and its Cards/deck-detail
  parents or existing refresh composables, only for metadata reload wiring.
- Existing `server/utils/animeCoverStore.ts`, source-mapping helpers, and
  launcher party-door rules are constraints to inspect, not rewrite targets.
- Paths above are relative to `nuxt-app/`. No dependency installs planned.

## Data / contracts

### Local resolution (load-bearing)

- Keep the existing `AnimeMetadata` interface and resolver method names.
- `byAniListId(id)` validates a positive safe integer, then returns a saved
  row through the adapter before any provider call. Local hits are read-only.
- Copy titles, cover URL, and AnimeThemes ID from the row; do not replace a
  local cover file or derive a remote request from its URL during resolution.
- Include `details` only when `aniListDetailsCheckedAt` is non-null. Copy
  year, season, format, averageScore, popularity, genres, and tags unchanged.
  A read must not stamp these details as freshly fetched on subsequent upsert.
- The existing schema has no persisted MAL ID. Do not confuse it with either
  local `id` or `aniListId`. Preserve an already-known mapping through existing
  validated cache/source helpers where possible. When an online theme import
  genuinely needs an unavailable MAL mapping, it may perform the existing
  source-specific lookup; this does not belong in ordinary metadata reads.
  Test this path explicitly. Do not silently skip AnisongDB or invent IDs.
- `byMalId()` and remote search keep existing behavior in this slice. Library
  card/deck search already uses SQLite; catalog discovery is still online.
- No schema migration is planned. If preserving source behavior demonstrably
  requires one, stop with the exact mapping decision rather than expanding scope.

### Explicit refresh (load-bearing)

- Request: `POST /api/lookup/anime-metadata-refresh`, JSON
  `{ "animeId": <positive safe integer local Anime.id> }`.
- Refresh only an existing stored anime, identified by its current AniList ID.
  Never create a new row through this route.
- Success: `{ "animeId": number, "aniListId": number,
  "refreshedAt": string }`, where `refreshedAt` is the committed
  `aniListDetailsCheckedAt` as an ISO-8601 string. Consumers then reload
  existing card/detail routes; no duplicate card response shape is needed.
- HTTP 400 for invalid input, 404 for a missing local row or an anime AniList
  genuinely no longer returns, 503 for provider unavailability. Invalid query
  or internal failures use the existing safe error handling, not a false 404.
- Fetch with existing timeout, cooldown, validation, and rate-limit handling,
  but bypass fresh/stale cache reads. Never return cached data on failure and
  never fall back to another provider as a successful explicit AniList refresh.
- Write only after validation and ID agreement. Do not let late writes
  recreate a row deleted during the request. No automatic retries or jobs.
- Preserve AnimeThemes ID/slug, local `coverImagePath`, card scheduling and
  notes, and song metadata. A refreshed cover URL can change; an existing
  local cover remains authoritative. This operation downloads no images.
- A refresh targets the anime, so it affects all its cards. Button help/success
  copy must state that, not imply it updates just one song.
- Later 107b must guard this route before cache or provider access. Local-app
  requests and authorized party LAN requests are not external-provider traffic.

## Testing

- Use the existing Vitest command, with tests beside changed logic and mocked
  providers. Test cache bypass, timestamp preservation, sparse details, invalid
  IDs, local hits, absent rows, primary/fallback failures, MAL mapping/source
  regressions, metadata-only writes, and row deletion during refresh.
- Include existing downloaded cards, reviews, and deck membership in refresh
  fixtures and assert they are unchanged after success and failure.
- Focused commands from `nuxt-app/`: `bun run test --
  server/utils/animeMetadata.test.ts` and the added refresh/import test files.
  Run `bun run test` and `bun run build` as final automated gates; no umbrella
  Verify command is currently declared. Spec-writing alone runs neither.
- Browser/API evidence: inspect a saved card, refresh once, verify updated
  titles and retained local cover; simulate failed refresh and verify error,
  unchanged data, and retry; change selection while pending to verify isolation.
  Use isolated data and mocked provider responses for failures, not a real
  library mutation. Record actual evidence, not just a manual try guide.
- Regular check/audit/try-guide policies are currently manual. That skips
  automatic skill gates, not tests, build, or behavioral evidence.

## Notes for the AI

- Self-critique tightened two hidden contracts: local rows lack the MAL mapping
  used by AnisongDB, and `upsertAnime` stamps supplied details as freshly read.
  Neither source selection nor timestamps may regress behind local-first reads.
- Refresh must actually reach the provider; the existing stale-on-outage cache
  would otherwise report old data as a successful refresh.
- Reuse existing cover saving and library search. Do not create another database.
- The pre-existing `DeckCopyCardsModal.vue` formatting and approved planning
  changes were verified and committed separately before this feature branch.
- Party servers may already be running from the previous request. Do not kill
  or restart them, change their live data, or rebuild under them as a shortcut
  to verification without separate coordination.
- Verification uses isolated production builds and disposable SQLite fixtures.
  The real library and running party-server output were not changed.

## Verification evidence

- Steps 1-6 each passed `bun run test` and `bun run build`. Builds ran on
  source copies in `/private/tmp/` with the existing dependencies linked,
  rather than replacing `.output/` used by the running party servers.
- Final gate full suite: 164 files, 2230 passing tests. Final isolated build
  directory: `/private/tmp/gaq-107a-final-gate.fryqaB/`.
- Local-runtime check against real disposable SQLite, with all provider
  fetches forbidden: zero provider calls, stored title returned, timestamp
  preserved. Artifact (repository-relative):
  `.playwright-cli/107a/gaq-107a-local-runtime.log`.
- HTTP checks with mocked AniList: malformed requests 400, missing saved anime
  404, fresh success 200, outage 503 with saved metadata unchanged. Party ports
  4000, 4001, and 4003 reject this route with 404. Local card reads generated
  zero external provider requests.
- Browser evidence with disposable fixtures: Cards and deck-detail refresh,
  disabled pending button, both cards' titles updated, unchanged local cover,
  preserved notes, outage feedback, selection isolation, filter/reload loading
  race, and recovery after a failed list reload all passed. Simulated 503s
  intentionally produce failed-request console entries; no unexpected browser
  errors were observed on successful flows. Existing Nuxt link-prefetch timer
  warnings and the existing duplicated USER_AGENT build warning remain.
- Screenshots and final build/test logs are under the repository's ignored
  `.playwright-cli/107a/` directory. Browser evidence uses disposable data and
  mocked providers, not live AniList availability or real-library mutations.
- Regular check, audit, and try-guide gates are manual and were not invoked.
  Required behavioral evidence was gathered directly. No new P0/P1 issue was
  found during self-review; existing findings were not accepted or changed.
- All six build steps are verified. Autopilot stops here for review, before
  `/complete`, archive, merge, push, or starting 107b. The active branch is
  `feature/local-first-anime-metadata`.

## Completion verification

- `/complete` reran `bun run test`: 164 files and 2230 tests passed.
- `/complete` reran `bun run build` on an isolated source copy at
  `/private/tmp/gaq-107a-complete.314D3l/`: build passed without replacing the
  running party servers' output. Logs are in
  `.playwright-cli/107a/gaq-107a-complete-tests.log` and
  `.playwright-cli/107a/gaq-107a-complete-build.log`.
- Feature 107a is archived; feature 107 and siblings 107b/107c remain pending.
  Unresolved findings remain unchanged in the live ledger.
- How to try after starting a build with this feature: open Cards or a deck's
  cards, select a saved card, and click **Refresh anime metadata**. Expect a
  disabled pending button followed by refreshed shared metadata or a retryable
  error, with local covers and learning data unchanged.
