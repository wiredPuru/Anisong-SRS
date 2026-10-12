# Feature: Offline mode

**From build-plan:** feature 107b (Offline-first library)
**Status:** verified

## Goal

Add a persistent, explicit Offline mode to Settings. While enabled, the app
uses saved metadata, local covers, local clips, and complete stream-cache files
without starting external requests. Online discovery, provider refreshes, and
new remote downloads are unavailable, but ordinary library operations and LAN
Party traffic remain available.

This is the enforcement slice of feature 107. Feature 107a supplies local-first
metadata; 107c supplies the broader offline availability UX and end-to-end
Study, Listen, and Party verification. Do not call 107b a catalog mirror or a
guarantee that every saved card has its assets downloaded.

## Design reference

Use the existing Settings Media library section, checkbox controls, error
styles, and CSS tokens. Add a small Offline mode control and explanatory copy,
not a new Settings section or visual redesign. No prototype is consumed.

## In scope

- One SQLite setting shared by normal app and Party processes using the same
  library. Default off; enabling it never changes auto-download, clip-source,
  playback-mode, or Party rules preferences.
- Authoritative server guards at provider entry points and actual external
  fetch boundaries. Cover AniList, AnimeThemes, AnisongDB/AMQ, MAL lists,
  remote cover/media downloads, Party catalog work, and GitHub update work.
- Guard online-only actions before reading provider response caches or starting
  NDJSON/SSE work. Suppress automatic prefetch/download and any provider-driven
  background work while offline. A warm response cache is not an online-mode
  bypass or proof of a newly checked metadata timestamp.
- Local-only use of complete stream-cache files. Cache misses cannot fetch;
  existing clip-source allowlists and local-file restrictions still apply.
- Safe browser bootstrap, cover selection, remembered ambient images, fonts,
  and media behavior on normal and all three Party doors. No automatic direct
  external resource loading while the page is in offline mode.
- A deterministic blocked-operation error, a pending/save-failure state for
  the toggle, and minimal fallback behavior needed to avoid broken network
  promises. Detailed per-screen explanations remain 107c.
- Focused logic tests and direct browser/API evidence for the switch, restart,
  guards, cache hits/misses, and normal/Party access boundaries.

## Out of scope

- Mirroring provider catalogs, replacing AniList IDs, extra metadata collection,
  provider permissions review, backup/restore, or offline list snapshots.
- Automatic internet detection, service workers, PWA installation, a machine
  firewall, interception of extensions, or policing external links the user
  deliberately opens outside the app.
- Automatically downloading missing assets when enabling the switch, deleting
  remote references, clearing caches, or silently changing Study/Party queues.
- An offline availability dashboard, every disabled-action tooltip, and the
  full downloaded-content playback/regression matrix, reserved for 107c.
- Dependency/font installation or downloading new font assets. Use existing
  CSS font fallbacks offline; preserve the current online font behavior.
- Canceling every request already started before activation, instant broadcast
  across browser origins/processes, or rolling back completed import batches.

## Build loop

Build one small diff at a time, in the order below. Under the current config,
show and explain each diff, run its logic tests plus the documented final gates,
and stop for per-step approval. Checkpoints are enabled but require approval;
`/complete` owns archival and the work-level merge. The later explicit Autopilot
invocation authorizes one bounded implementation pass without per-step pauses.
The latest request leaves further changes uncommitted. This spec-writing request
does not authorize implementation, a branch, commits, merge, or push.

This is one cohesive safety switch with several reviewable integration steps,
not independent shipped sub-features. Keep the toggle out of the visible UI
until the server and browser enforcement steps are complete. Split a step
further if its actual diff is too large to review; do not expose an unsafe
partially guarded mode for the sake of an intermediate demo.

## Build steps

- [x] **Step 1 - Persist the network setting (server).** Add `offlineMode`
  through Drizzle schema and generated migration, strict boolean get/set
  helpers, a minimal read endpoint, a validated write endpoint, and the Settings
  response field. Do not expose the checkbox yet. *Done when:* old/fresh
  databases default to false, true survives restart, malformed writes return
  400 without mutation, and existing settings are unchanged.
- [x] **Step 2 - Guard metadata providers (server).** Introduce the distinct
  offline error and shared online assertion. Guard AniList/AnimeThemes request
  entry points, AnisongDB requests, MAL pagination, and their actual fetch
  boundaries. Guard before warm/timed caches for online-only calls. Preserve
  107a stored-row hits and propagate offline errors without provider fallback
  or cooldown changes. *Done when:* offline cold/warm discovery and explicit
  metadata refresh make zero provider calls and report offline mode; saved
  by-ID resolution still succeeds with its original timestamp.
- [x] **Step 3 - Stop provider-driven workflows (server).** Audit lookup,
  list-import, source-recovery/refresh, match/link/cover/details backfill,
  catalog-fill, and bulk loops. Guard online-only actions before streams or
  writes; recheck before each new provider request/batch. Treat activation as
  interruption, not missing provider data. *Done when:* offline invocation
  changes no metadata/cards/check timestamps; activation during a multi-item
  job keeps completed work but starts no further external requests and leaves
  unprocessed rows eligible for retry.
- [x] **Step 4 - Make clip cache and downloads local-only (server).** Return
  complete cached files before the offline miss guard; never join an external
  in-flight cache fill when offline. Guard manual, auto, bulk, and Party
  downloads at the actual remote transfer boundary and stop new lookahead
  work. Preserve cached-file-to-library copying when it needs no fetch.
  *Done when:* local/cache-hit clips still serve valid byte ranges, cache
  misses/new downloads make zero external calls, partial files are never hits,
  and original auto-download preferences remain stored.
- [x] **Step 5 - Guard cover serving and saving (server).** Prevent offline
  external cover redirects, remote saving, and Party cover-proxy fetches.
  Prefer readable local files; stale/missing local files return the existing
  no-cover response rather than falling back remotely. Keep stored URLs/paths.
  *Done when:* ordinary and Party cover routes return local image bytes offline,
  while remote-only/missing-local covers emit neither a redirect nor a fetch.
- [x] **Step 6 - Guard app updates (server).** Skip the automatic GitHub lookup
  offline and refuse new update downloads before cached provider answers can
  bypass the guard. Keep current-version/local staged-update status visible
  and retain existing online retry behavior. *Done when:* Settings reads,
  checks, and new-download actions make zero GitHub calls offline, no false
  up-to-date result appears, and an already verified local staged update is
  neither deleted nor made unavailable just because network mode changed.
- [x] **Step 7 - Bootstrap browser network state (client/server).** Add shared
  tri-state network state, minimal door-scoped reads, and reload/synchronization
  behavior. Resolve it before automatic external-capable effects; unknown or
  failed reads must fail closed for those effects, not for local navigation.
  Preserve Party authentication/door restrictions. *Done when:* fresh normal
  and Party pages know the persisted mode before resource loading, denied
  reads never default online, and no Party door can write the global setting.
- [x] **Step 8 - Remove browser image leaks (client/server).** Gate every
  direct remote cover binding, including browse results, card tables/inspectors,
  decks/filter modals, stats/dashboard, Study/Listen artwork, and Party host
  artwork. Gate old `lastPlayed` HTTPS images in both dashboard and ambient
  backdrop without deleting history; allow safe saved image routes and JPEG
  frame data. *Done when:* persisted offline pages render local art/fallbacks
  with zero external image requests, including stale online results/history.
- [x] **Step 9 - Guard playback and font bootstrap (client/server).** Suppress
  new prefetch/auto-download effects offline without excluding complete cached
  clip playback through same-origin routes. Prefer available local sources
  offline, including local audio when the preferred video is remote-only.
  Account for `loadedSrc` retained across card changes and source fallback.
  Remove the unconditional Google
  Fonts head link; install it only after known-online bootstrap. Add a narrowly
  scoped offline browser resource policy as defense in depth, compatible with
  local assets, frame/blob resources actually used, and Party SSE/LAN requests.
  *Done when:* offline cold loads make no font/media-provider requests, local
  playback and same-origin cached streams work, unknown mode cannot start
  automatic network work, and online typography/playback remain unchanged.
- [x] **Step 10 - Expose the Settings control (client).** Add the checkbox,
  scope/transition copy, save-pending/error handling, and mode reload behavior.
  Use the confirmed server value rather than an optimistic online assumption.
  *Done when:* rapid clicks cannot race saves, a failed save keeps the previous
  confirmed mode and permits retry, successful saves update/reload the page,
  and the enabled setting survives an application restart.
- [x] **Step 11 - Prove enforcement and regressions.** Exercise disposable
  persisted-offline fixtures under blocked/instrumented external fetch and a
  clean browser cache. Include both directions of the toggle, second tabs,
  Party doors, late jobs, warm API caches, missing assets, and update/font
  leaks. *Done when:* exact routes/logs/screenshots show the promised boundary,
  all focused tests plus `bun run test` and isolated `bun run build` pass, and
  any remaining availability UX belongs explicitly to 107c rather than being
  an unguarded request hidden by an error handler.

## Files / areas


- `nuxt-app/server/db/schema.ts`, generated SQL and migration metadata under
  `server/db/migrations/`; use `bun run db:generate`, not manual ALTER TABLE.
- `server/utils/mediaLibrary.ts`, `server/api/media-library.get.ts`, new
  `server/api/media-library/offline-mode.post.ts`, and
  `server/api/network-mode.get.ts`; a focused `server/utils/networkMode.ts`
  for the policy/error contract, with adjacent tests.
- Provider clients under `server/lib/`, `server/utils/apiCache.ts`, lookup
  entry points, bulk/stream orchestration, and existing fallback handling.
- `server/utils/streamCache.ts`, `mediaDownload.ts`, `partyDownload.ts`,
  `partyStore.ts`, `partyClip.ts`, media routes, and download workflows.
- `server/utils/animeCoverStore.ts`, `animeCoverSave.ts`, `animeCoverSql.ts`
  where appropriate, ordinary/Party cover routes, cover-save/backfill paths.
- `server/utils/version.ts`, `selfUpdate.ts`, their routes, and
  `app/composables/useUpdateCheck.ts` / update UI consumers.
- New `app/composables/useNetworkMode.ts`, a pure browser asset-policy helper
  with tests, `app/app.vue`/bootstrap, `nuxt.config.ts` font head handling,
  and minimal GET routes under `server/api/party/{display,host,player}/`.
- `app/pages/settings.vue`, new
  `app/components/settings/SettingsOfflineModeControl.vue`, direct image
  consumers, `app/utils/lastPlayed.ts`, and ambient/history consumers.
- Study/Listen/Preview media selection and prefetch/download consumers;
  Party host/display/player boot and media/image consumers.
- Existing `partyAccess`/door tests and adjacent policy/provider/cache tests.
  Never broaden a Party door to the normal `/api/media-library` write routes.

## Data / contracts

### Persisted state (load-bearing for 107c)

- Add `media_library_settings.offline_mode`, a not-null SQLite boolean integer
  with default false, exposed as `offlineMode: boolean` on the existing row
  `id = 1`. No additional database or settings storage in localStorage.
- `GET /api/network-mode` returns only `{ offlineMode: boolean }`, with
  `Cache-Control: no-store`. Add the same field to `GET /api/media-library`.
- `POST /api/media-library/offline-mode` accepts exactly the existing boolean
  toggle convention `{ enabled: boolean }` and returns
  `{ offlineMode: boolean }`; missing/null/string/number values return 400.
- Each Party door gets its own minimal read route
  `/api/party/<display|host|player>/network-mode`, with the existing access
  requirements and the same no-store response. No new write access, library
  paths, host secrets, or game answers in these responses.
- Server assertions read authoritative SQLite state per operation/request,
  not a process-lifetime boolean. Different processes sharing a DB must observe
  committed changes; processes using different data directories are separate
  libraries and do not share a switch.

### Offline outcomes and caches

- Use an `OfflineModeError` distinct from `ProviderUnavailableError`, with
  HTTP 409, `statusMessage: "Offline mode is enabled. Turn it off in Settings
  to use online features."`, and H3 error data `{ code: "OFFLINE_MODE" }`.
  It must not trigger provider fallback, cooldown, empty-result caching, or
  missing-record/check-timestamp writes. Guard assertions outside broad
  fetch catches that would relabel this as 502/503.
- Reject online-only entry actions even when an API/timed cache is warm.
  Saved metadata/library queries remain allowed. Complete cached clip bytes
  remain allowed under the current clip-source policy; incomplete/temp files
  and misses return offline errors without fetch. Offline cover absence stays
  a normal no-cover 404, never a 302 to an external host.
- For streaming jobs, fail before response headers when already offline.
  If activation interrupts a running job, use its existing terminal error
  event with an additive `code: "OFFLINE_MODE"` field, preserve completed work,
  release guards, and end the stream. Do not falsely report success or absence.
- Automatic update checking returns an honest unavailable/offline state while
  keeping the current version. Extend server/client `UpdateStatus` with
  `offlineMode: boolean` and allow `checkedAt: string | null`. Offline
  `GET /api/version` returns current version, `offlineMode: true`,
  `checkFailed: true`, `checkedAt: null`, null release fields, and
  `updateAvailable: false`; render it as not checked, never up to date. Online
  responses have `offlineMode: false` and their existing timestamps/results.
  Add `offline-mode` to the server/client self-update unavailable-reason union;
  local running/ready job status takes precedence and needs no release fetch.
  Starting a new remote update uses the 409 blocked-operation contract;
  existing explicit local staged-install/restart behavior remains unchanged.
- Keep original remote references and preferences intact. Disabling offline
  mode restores eligibility, not a burst replay of interrupted bulk jobs.

### Activation and browser boundary

- A successful enable write immediately blocks new server-side external
  requests against that DB. Recheck at the actual fetch start and at each job
  iteration, even if the job began online. Requests already started may finish;
  no promise of canceling their bodies or reversing their completed writes.
- Browser state is `unknown | online | offline`. Unknown suppresses external
  assets/effects until a no-store local status read succeeds. Offline is not
  inferred from `navigator.onLine`, provider failures, or remembered UI state.
- After either successful toggle, reload the initiating app document so its
  resource policy/fonts are rebuilt. Notify same-origin tabs to reread/reload;
  other Party origins read their door-scoped status on bootstrap, visibility
  return, and a five-second visible-page poll, reloading when mode changes.
  Read/reload failures stay restrictive rather than assuming online.
- Already-open other-origin documents are not synchronously controlled by the
  Settings page. Explain that they must refresh/reopen to apply the browser
  boundary immediately; automatic convergence is not a machine-wide firewall.
  Network-zero verification starts after each document has confirmed/reloaded
  into offline mode, separately proving immediate server enforcement.
- Direct external image/font/media sources must not mount while offline or
  unknown, including remembered HTTPS ambient art and stale discovery results.
  Suppress the source instead of rendering it and waiting for an onerror event.
  Local-file cover routes must themselves refuse remote fallback/redirects.
- Local app HTTP, Party LAN doors, SSE, static assets, mascot, lobby music,
  local image/clip endpoints, and the safe data/blob resources actually used
  are permitted. External hyperlinks opened deliberately are not app traffic.
- Loaded-source pinning must not create a new cache miss or external reload
  offline. Preserve valid local/cache-hit playback and existing Hide Info,
  source allowlists, and learning-state semantics; no review writes from Party.
- Offline media selection prefers configured, readable local sources using
  the existing audio-only/video priority among local candidates. A local audio
  clip must not become unusable because a remote video URL also exists. With
  no local candidate, an allowed remote reference can use the same-origin
  stream route for a complete cache hit; misses return offline feedback, never
  fetch. Do not assume that a stored path proves the file still exists.

## Testing

- Put Vitest tests beside changed logic. Cover strict setting parsing/defaults,
  migration retention, restart persistence, shared-DB state reads, error
  classification, warm cache bypass, provider fallback/cooldown non-mutation,
  and local-first timestamps. Test actual fetch spies, not just thrown messages.
- Cover stream-cache hit/miss/in-flight/partial-file behavior and byte-range
  routes; cover downloads using cached files versus new transfers, interrupted
  bulk work, unchanged unprocessed metadata, guard cleanup, and retry online.
- Cover ordinary/Party local covers and missing-file fallbacks, zero redirects,
  update lookup/download suppression, and browser asset classification including
  HTTPS remembered images, same-origin routes, frame data, and malformed URLs.
- Use disposable databases and a production build with instrumented external
  fetch. Capture API outcomes before/after activation and compare metadata,
  covers, cards, reviews, decks, paths, and preferences for unintended writes.
- Use the already available browser tool with a clean cache to capture Settings
  toggle/pending/failure, persisted offline reload, Cards/ambient art, one local
  and one cached playback path, a cache miss, fonts/update startup, tab
  convergence, and Party door bootstrap/auth checks. Network logs must show
  zero external requests after the stated boundary, not requests silently
  fulfilled from the browser cache. Basic local success must be demonstrated
  here; 107c cannot be used to defer broken playback or unguarded egress.
- Run focused tests first, then `bun run test` and `bun run build` from
  `nuxt-app/` for each reviewed step/final gate. No umbrella Verify command is
  currently declared. Build isolated source copies to avoid replacing `.output`
  used by running Party servers. Spec-writing runs neither command.
- Regular audit, check, and try-guide gates are manual under the current config.
  That does not waive logic tests, build, or direct behavioral evidence.

## Notes for the AI

- Critique added guards before warm caches and fallback catches, an immediate
  server versus reloaded-document browser boundary, and fail-closed startup.
  It also caught Google Fonts in `nuxt.config.ts`, HTTPS lastPlayed artwork,
  cover redirects after local-file loss, and Party background prefetch/download.
  A second pass locked the update response instead of deferring it, preserved
  existing local staged updates, and required local-audio precedence over a
  remote-only preferred video so the network switch does not strand downloads.
- The metadata resolver already avoids providers for saved AniList IDs (107a),
  but theme imports still need external MAL mapping/source resolution. Do not
  describe a stored metadata hit as a fully offline theme import.
- There is no generic browser network setting/composable today. Do not add an
  unrelated global fetch monkeypatch, expose user filesystem paths on Party
  doors, or weaken source/token/session allowlists to implement this switch.
- Keep response type copies ordered and synchronized per coding standards.
  Distinguish offline intent from outage, missing files, and no provider match.
- Font fallbacks may look different offline. Do not silently add a font package
  or fetch licensed assets as part of implementation; any expanded typography
  scope requires a separate decision.
- Do not accept or remove existing findings, change plans, commit, push, launch
  a real-library migration, restart Party servers, or mutate live fixture data
  while writing this spec. Implementation stays on a feature branch after
  review, with isolated verification data.

## Implementation evidence

### Step 1 - persisted setting and endpoints

- Branch: `feature/offline-mode`. Schema migration generated with
  `bun run db:generate`; not applied to the real library or running Party app.
- Focused command: `bun run test -- server/utils/networkMode.test.ts
  server/db/offlineModeMigration.test.ts`, 2 files and 18 tests passed.
- Full command: `bun run test`, 166 files and 2248 tests passed.
- `bun run build` passed on isolated source copy
  `/private/tmp/gaq-107b-step1.7Cvtrj/`, leaving the live `.output` unchanged.
  The pre-existing duplicated USER_AGENT warning remains.
- `node /private/tmp/gaq-107b-step1-http.mjs` exercised the production build
  on two disposable localhost servers. Verified default false, minimal no-store
  GET response, boolean saves, eight invalid payloads returning 400 without
  mutation, shared-database reads, persistence after process restart, and all
  unrelated settings unchanged. Both verification servers were stopped.
- Evidence logs: `.playwright-cli/107b/gaq-107b-step1-tests.log`,
  `.playwright-cli/107b/gaq-107b-step1-build.log`, and
  `.playwright-cli/107b/gaq-107b-step1-http.log` (ignored local artifacts).
- No checkbox is exposed yet. The setting is storage only at this step:
  external-request enforcement is not implemented. Do not use these endpoints
  as a working offline mode until the later guards are verified.
- Step 1 is implemented and tested, awaiting per-step user review before
  proceeding to step 2. No checkpoint commit, merge, or push was performed.

### Step 2 - metadata provider guards

- User approved continuing after step 1 without a checkpoint. Added a shared
  `assertOnline` and a handled `OfflineModeError` carrying HTTP 409 and
  `data.code = OFFLINE_MODE`. Guards read committed SQLite state at provider
  request/cache entry and actual fetch boundaries, outside outage catches.
- Guarded AniList, AnimeThemes, AnisongDB, MAL pages, resolver fallback entry,
  fresh single-anime refresh, and the AniList browse-options timed cache.
  Saved AniList-ID resolver hits still return before the online assertion.
- New provider tests use the real policy and real disposable SQLite caches;
  legacy provider tests default to an isolated online guard in Vitest setup,
  not the user library preference. An existing H3 transport mock now retains
  real exports so the handled error class can load.
- Focused command: `bun run test -- server/lib/offlineProviders.test.ts
  server/utils/networkMode.test.ts`, 2 files and 39 tests passed. Coverage
  includes cold/warm/stale caches, activation after cache lookup, raw GraphQL,
  fresh refresh, retained cooldowns, uncached random discovery, MAL pagination,
  local timestamp preservation, remembered-outage fallback, and injected
  refresh fetches. Initial fixture-state leakage was repaired in the tests.
- Final full `bun run test`: 167 files and 2270 tests passed. Isolated
  `bun run build` passed at `/private/tmp/gaq-107b-step2.OEeqDh/`; live Party
  output/data were untouched. Existing duplicated USER_AGENT warning remains.
- `node /private/tmp/gaq-107b-step2-http.mjs` passed against the isolated
  production server with mocked/instrumented external fetch. Six offline
  discovery/refresh routes returned 409 with OFFLINE_MODE, warm API and timed
  caches could not bypass the switch, provider calls were zero, local Cards
  remained readable, metadata/cache rows were unchanged, and online mode
  restored the warmed routes. Verification server stopped afterward.
- The first production HTTP check caught Nitro hiding data for a plain
  unhandled Error. The error now extends H3Error; tests assert its handled
  classification, and the repeated production check proves serialization.
- Logs are under `.playwright-cli/107b/gaq-107b-step2-*.log` (ignored).
  No browser/UI gate is applicable to this server-only step.
- Step 2 is implemented and verified, awaiting review before step 3. No
  checkpoint or other commit, merge, or push. Full offline mode is still not
  ready: job orchestration, clip/cover/update guards, and browser enforcement
  remain later steps, so the checkbox remains hidden.

### Step 3 evidence

- Fourteen focused workflow tests cover pre-stream refusal, terminal
  `OFFLINE_MODE` events, interrupted batches/items, retry suppression, and
  local popularity cutoffs without background requests.
- `bun run test`: 168 files, 2,284 passing tests.
- Isolated `bun run build`: passed in `/private/tmp/gaq-107b-step3.VDzJQ7`.
- Disposable production HTTP fixture: 16 online-only workflow routes return
  typed 409 before NDJSON headers; zero external calls and unchanged anime,
  songs, artists, cards, and API cache. Filesystem recovery remains available;
  Party host catalog routes still require authentication.
- Evidence: `/private/tmp/gaq-107b-step3-{focused,tests,build,http}.log`.
- Steps 1-2 checkpoint `6ce034f` was created under Autopilot authorization
  before the subsequent no-commit reply arrived. Further changes stay uncommitted.

### Step 4 evidence

- Six focused media tests pass; full suite: 169 files, 2,290 tests.
- Isolated build passed in `/private/tmp/gaq-107b-step4.lSjmek`.
- Disposable HTTP checks prove ordinary and Party local/cached byte ranges,
  typed cache/download misses before streaming, partial-file refusal, cache
  copying into the library, no Party lookahead transfers, and unchanged
  auto-download preferences. Zero external calls.
- Logs: `/private/tmp/gaq-107b-step4-{focused,tests,build,http}.log`.

### Step 5 evidence

- Five focused cover tests pass; full suite: 170 files, 2,295 tests.
- Isolated build passed in `/private/tmp/gaq-107b-step5.dHvFkS`.
- Production HTTP checks serve saved image bytes through ordinary and Party
  routes; remote-only and missing-local covers return 404 with no redirect or
  fetch. Metadata retains original URLs and paths.
- Logs: `/private/tmp/gaq-107b-step5-{focused,tests,build,http}.log`.

### Step 6 evidence

- Four focused updater tests pass, including warm-cache refusal and preserved
  local staged-update status. Full suite: 171 files, 2,299 tests.
- Isolated build passed; path in `/private/tmp/gaq-107b-step6-build-dir`.
- Production version/status reads return not-checked offline status; new
  download returns typed 409. No external server calls.
- Browser About panel shows the offline not-checked message, never up-to-date;
  `.playwright-cli/107b-step6-about.png`. No console errors.
- Logs: `/private/tmp/gaq-107b-step6-{focused,tests,build,http}.log`.

### Step 7 evidence

- Thirteen pure bootstrap tests pass; full suite: 172 files, 2,312 tests.
- Isolated build passed; path in `/private/tmp/gaq-107b-step7-build-dir`.
- Party status GETs return only `{ offlineMode }`, no-store; host/player
  authentication and cross-door 404 remain intact, with no scoped POST route.
- Browser cold load reads persisted true before mount; a confirmed change
  triggers reload within the visible poll interval. An injected 401 read
  produces null, never an assumed online value. That deliberate HTTP refusal
  generates the expected browser network error.
- Logs: `/private/tmp/gaq-107b-step7-{focused,tests,build,http}.log`.

### Step 8 evidence

- Nine image/history policy tests pass; full suite: 173 files, 2,321 tests.
- Isolated build passed; path in `/private/tmp/gaq-107b-step8-build-dir`.
- Shared NetworkImage guards all direct cover bindings. Study retains its
  actual image element reference for frame/canvas sampling with the same policy.
- Browser Home, Cards, Decks, and Stats: zero external image requests; saved
  local art remains mounted and old HTTPS last-played history remains stored.
- Local-only cover query prevents redirects/proxy fetches even if a failed
  browser status read leaves mode unknown while the server is online.
- `.playwright-cli/107b-step8-stats.png`; HTTP/build/test logs under
  `/private/tmp/gaq-107b-step8-*.log`. No app console errors in the image check.

### Step 9 evidence

- Focused playback/media/Party tests pass; full suite: 174 files, 2,327 tests.
- Isolated build passed; path in `/private/tmp/gaq-107b-step9-build-dir`.
- Browser cold offline Listen selects readable local WAV audio despite a
  missing stored video path and remote video reference. Local and complete
  cached WAV both reach readyState 4 and advance playback time after Play.
- Zero external, prefetch, auto-download, or font requests on cold offline
  load. Offline document CSP is present. Injected unknown status starts no
  remote stream, prefetch, update check, or font load.
- Missing saved cover and injected denied-read fixtures produce expected
  HTTP 404/401 browser resource errors, not application exceptions.
- `.playwright-cli/107b-step9-local-audio.png` and
  `/private/tmp/gaq-107b-step9-{focused,tests,build,headers}.log`.

### Step 10 evidence

- Full suite: 174 files, 2,327 tests; isolated build passed with path recorded
  in `/private/tmp/gaq-107b-step10-build-dir`.
- Browser delayed save: disabled checkbox, old confirmed value, one request.
  Injected 503 keeps the old value and enables retry with an actionable error.
- Real saves in both directions reload the initiating document and a second
  same-origin tab. Confirmed offline removes font links; online restores the
  original stylesheet link. External CSS is mocked for the online fixture.
- `.playwright-cli/107b-step10-settings.png` inspected visually; control matches
  existing Settings tokens. No real library or original Party process changed.

### Step 11 evidence

- Final `bun run test`: 174 files, 2,328 tests passed. Final isolated
  `bun run build` passed. Logs: `/private/tmp/gaq-107b-step11-tests.log` and
  `/private/tmp/gaq-107b-step11-build.log`; build directory recorded in
  `/private/tmp/gaq-107b-step11-build-dir`.
- Final workflow HTTP fixture: 19 online-only routes return pre-stream HTTP
  409 with `OFFLINE_MODE`, including Party anime search/theme/card additions.
  Metadata/cards remain unchanged, local recovery remains available, and
  instrumented provider calls remain zero.
- Final asset HTTP fixture: local and complete cached normal/Party byte ranges
  succeed; missing/partial files block; cached download copies work; background
  Party lookahead is suppressed; preferences remain unchanged. Missing local
  covers cannot redirect or proxy-fetch through `localOnly`, even online.
- Clean browser context against the final normal server: Home, Cards, Decks,
  Stats, Settings, Study, and both Listen fixtures render with Offline mode
  confirmed, document CSP present, and no Google Fonts links. Local and cached
  WAV playback reach readyState 4 and advance time. No automatic prefetch or
  download requests, external requests, or application exceptions occur.
- Actual Party launcher doors on disposable ports 4130/4131/4133: display,
  host, and joined player bootstrap offline; minimal status is no-store;
  unauthenticated host/player reads return 401; normal status/write routes
  remain inaccessible through every door (404). Local tokenized display media
  reaches readyState 4. Normal and Party servers share the fixture SQLite mode.
- Both real Settings toggle directions reload the initiating document and
  second normal tab. Bringing each Party door to the foreground lets its
  existing status poll converge and reload without manual navigation. Final
  offline reloads on all five documents start zero external requests.
- Proof: `/private/tmp/gaq-107b-final-browser.json` and
  `/private/tmp/gaq-107b-final-browser-direct.log`. The CLI daemon closed during
  final automation; the already installed Playwright library produced this
  proof instead, without installing dependencies. Online stylesheet requests
  are mocked; the deny-external server log records an expected GitHub attempt
  during the deliberately online phase, not during the offline checks.
- `git diff --check` passed. Self-review repaired swallowed Party search
  errors, guarded provider-derived Party card additions, narrowed local image
  paths, preserved Study's real image element reference, and corrected late
  updater activation messaging. Tests include late-job and warm-cache guards.

## Autopilot review packet

- Target: resumed approved 107b spec on `feature/offline-mode`. The existing
  critique and contracts remain in scope; no new catalog mirror or 107c UX was
  added. Files/areas above explain the persistence, provider/workflow, media,
  cover/update, client bootstrap, rendering, and Settings changes and tests.
- Verification: focused tests throughout, final full suite and isolated build,
  final workflow/asset HTTP checks, clean browser and actual Party-door checks
  all pass. Earlier step evidence covers restart persistence, missing assets,
  unknown-mode startup, staged updates, and pending/failed Settings saves.
- Regular `/check`, `/audit`, and `/try` policies are all manual. No automatic
  acceptance-check skill, audit, or try-guide gate ran. Existing P2/P3 findings
  are unchanged; no open or fixed P0/P1 findings block review in the ledger.
- Checkpoint `6ce034f` contains steps 1-2. The later explicit no-commit reply
  overrode checkpoint configuration during implementation: steps 3-11 were
  left uncommitted for review. The subsequent explicit `commit` request
  authorizes committing the verified remaining work. Nothing was merged,
  pushed, archived, deployed, or migrated in a real library.
- Screenshots: `nuxt-app/.playwright-cli/107b-step10-settings.png` and
  `nuxt-app/.playwright-cli/107b-step9-local-audio.png`. Settings screenshot was
  visually inspected. All original Party servers on ports 4000-4003 and the
  repository `.output` were left untouched.
- Disposable previews remain running. Final normal preview is port 4126;
  final Party doors are 4130 (display), 4131 (host), 4133 (player), with internal
  server 4132. Earlier temporary previews use 4116-4120 and 4122-4125. They use
  fixture libraries, not the real library; stopping processes needs approval.
- Review limitation: this is an enforcement switch, not a promise that all
  cards have downloaded assets. Broader availability guidance and the full
  Study/Listen/Party matrix remain 107c. Existing in-flight external requests
  may finish; server guards apply to new requests, browser changes require a
  reload or visible-door convergence as described in Settings.
- Next: review the diff, optionally request `/try` or `/audit current`, then
  explicitly invoke `/complete`. Do not merge or create another checkpoint
  without the user's next instruction.

## Completion verification

- Final completion `bun run test`: 174 files and 2,328 tests passed.
- Final completion isolated `bun run build` passed at
  `/private/tmp/gaq-complete-107b-0u5lxef1`, preserving repository output.
- Logs: `/private/tmp/gaq-complete-107b-tests.log` and
  `/private/tmp/gaq-complete-107b-build.log`.
- `git diff --check master...HEAD` passed. Existing unresolved P2/P3
  findings remain in the live ledger. Regular quality gates are manual.
- User explicitly authorized merging into master and pushing.
- How to try: open Settings, enable Offline mode, and confirm the page
  reloads. Play downloaded content in Study or Listen; online discovery
  should report offline mode. Disable the toggle to restore online access.
