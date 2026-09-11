# Clear loading and live progress feedback

**Type:** Fix
**Status:** verified

## The problem

Bare `Loading...` states on Home, Cards, Decks, Study, Stats, and Settings
do not explain what is being fetched or how long it has been waiting.
Search, theme loading, artist catalog loading, and Completed-list imports
can wait on external services with no intermediate feedback. Artist import
and MAL ID resolution process multiple anime server-side but return only a
final result. Download bytes already stream to the client, but bulk actions
only say `Downloading...`, and a transfer awaiting its first byte says `0.0 MB`.
Users cannot distinguish measured progress from a request that is still waiting.

## The fix

Use consistent, compact activity feedback in the existing Akiba Neon design:

- Name the operation, such as `Loading your cards`, `Fetching themes for
  Cowboy Bebop`, or `Fetching your MyAnimeList Completed list`.
- Show elapsed seconds while pending. After 15 seconds without a result or
  measured progress update, say `Still waiting for a response` (or `No new
  progress reported`) without claiming the server is frozen or healthy.
- Show real stages and completed/total counts for multi-item work. Totals
  appear only once known. Do not simulate percentages, ETAs, or provider
  fallback stages with timers.
- Keep terminal errors and existing retry actions visible. Do not automatically
  repeat writes or label a timer/spinner as proof that the server is progressing.
- Reset feedback for each request; ignore stale responses after a selection or
  search changes. Clean up timers/readers on completion and unmount. Use polite
  accessible status announcements for stage changes, not every elapsed second;
  respect reduced motion and keep narrow layouts usable.

Scope is existing loading/search/import and bulk add/download feedback. No new
job dashboard, background queue, schema, dependencies, or changes to scheduling,
lookup identity, metadata fallback, download selection, or import semantics.
Preserve the pre-existing edit in `StudyCardEditPanel.vue` and the unrelated
`anilist-fallback-proposal.md` file.

## Build steps

- [x] **1. Explain ordinary loading and waiting states.** Add a small shared
  activity component/composable, then use it for existing page loading states,
  nav and card searches, and theme/catalog/list loading surfaces. Include the
  operation label, elapsed time, and slow-response wording. Keep layouts and
  existing error/empty states intact.
  **Done when:** a delayed Cards load and theme lookup identify what is loading,
  tick elapsed time, change wording after 15 seconds, and clear on success or
  failure; quick successive searches cannot display the previous search's status.

- [x] **2. Report actual catalog and list-import progress.** Add opt-in streamed
  progress to artist catalog import and Completed-list routes, preserving their
  existing JSON mode for other callers. Reuse the existing newline-delimited
  download-stream convention with typed stage/progress/done/error events.
  Instrument actual provider list-page completion where available, artist anime
  processing, and MAL ID resolution. Show `Processed 12 of 48 anime` only from
  completed work, with skipped/unavailable entries accounted for separately.
  Update each selected list source independently as it completes or fails;
  preserve deduplication and successful results from the other source.
  **Done when:** a controlled multi-anime import visibly advances before its
  final response, a waiting upstream request remains honestly indeterminate,
  and a failed/truncated stream becomes an error rather than indefinite loading
  or false success. Existing partial-success behavior remains intact.

- [x] **3. Clarify single and bulk add/download progress.** Use existing byte
  events to distinguish waiting for data, transferring, and awaiting completion.
  Keep unknown-size transfers in bytes rather than a percentage. In the Anime,
  Artist, and imported-list result groups, show bulk completed/total work and
  the current song/media kind for add-all and download-all. Count eligible
  operations consistently, distinguish failed items, and show a final summary.
  **Done when:** a multi-file run advances its completed count, displays current
  transfer bytes/percentage, reports failures without counting them as success,
  and stops its timer on completion or error. Existing Study/Preview download
  controls continue to work.

## Verify

- Add colocated tests for elapsed/stale/reset state, progress event parsing
  (chunk boundaries, terminal errors, truncated streams), and batch accounting.
  Test source-independent list completion and preserved merged results.
- Run `bun run test` and `bun run build` from `nuxt-app/` for each reviewed step.
- Use a controlled delayed response to observe initial, progressing, waiting,
  success, empty, and failure states in the browser. Verify timers disappear
  after navigation, closing a modal, or changing a query. Check a narrow viewport
  and accessible status behavior. Do not install Playwright.
- Exercise import/download writes against an isolated test library, preserving
  the user's cards and media. Confirm no automatic retries or duplicate writes.

## Handoff

Review this spec, then `/implement` starts Step 1 on
`fix/loading-progress-feedback`. Each step remains a separate reviewable diff.

## Step 1 implementation evidence

Implemented on `fix/loading-progress-feedback` and approved by the user with
"continue". Step 2 is now in progress. No commit made.

- `bun run test`: 16 files, 119 tests passed.
- `bun run build`: passed.
- `git diff --check`: passed.
- Headless Chrome with controlled client responses: Cards and theme lookup
  show the operation immediately and waiting text at 15 seconds; success/empty
  results and a controlled failure clear the activity indicator; an older search
  response cannot overwrite a newer search. Requests that could write metadata
  were mocked, so the browser check did not import into the user's library.
- At 390x844, the Cards loading state had scroll width 390 and no horizontal
  overflow. Screenshots: `/tmp/gaq-loading-cards.png` and
  `/tmp/gaq-loading-themes.png`. The live status excludes the elapsed counter.
- Timer tests cover request reset, delayed timer delivery, inactive/SSR state,
  and scope disposal. The component adds no animation.
- Review diff and per-file notes: `/tmp/gaq-loading-step-1-review.md`.
- Regular audit, check, and try-guide gates are all manual. No standalone
  `/audit`, `/check`, or `/try` run. Steps 2 and 3 are still unimplemented.

## Step 2 implementation evidence

Implemented on `fix/loading-progress-feedback` and approved by the user with
"continue". Step 3 is now in progress. No commit made.

- `bun run test`: 21 files, 142 tests passed.
- `bun run build` and `git diff --check`: passed.
- Isolated built server with temporary DB and mocked providers: all three
  import routes emitted progress before completion and retained identical
  JSON/final-result shapes. First event arrived in 2-10ms; MAL and artist work
  took approximately 6.6s and 5.2s. Validation errors still returned HTTP 400.
- Browser observed real list page updates, processed anime counts, independent
  AniList completion while MAL waited, preserved AniList results on MAL failure,
  artist catalog progress, closed-modal cleanup, and a visible truncated-stream
  error. At 390x844, document scroll width remained 390.
- Review diff and per-file notes: `/tmp/gaq-loading-step-2-review.md`.
- Verification used `/tmp/gaq-step2-isolated-data`, not the user's library.
  The temporary server was stopped. Real provider availability was not tested.
- Regular audit, check, and try-guide gates remain manual. Step 3 is pending.

## Step 3 implementation evidence

Implemented on `fix/loading-progress-feedback`; the user moved to `/complete`
without further review comments. No commit made prior to `/complete`.

- `bun run test`: 23 files, 153 tests passed.
- `bun run build` and `git diff --check`: passed.
- `useCardDownloads.ts` now distinguishes three phases from the same byte
  events already streamed by `/api/cards/download`: `waiting` (no progress
  event yet), `transferring` (bytes arriving, percentage or raw MB when the
  total is unknown), and `finishing` (every expected byte arrived but the
  server hasn't confirmed completion). A stale `{loaded:0,total:0}` seed was
  removed so "waiting" is real, not a fake 0%. New shared
  `components/DownloadProgress.vue` renders `waiting` via the existing
  `ActivityStatus` (elapsed timer, "Still waiting for a response" past 15s)
  and switches to the byte progress bar once real data arrives; it replaced
  the duplicated inline markup at all 7 existing single-download call sites
  (`/cards`, `/decks`, the Artist/Anime/Song/imported-list result groups,
  `DeckAddAnimeModal`) plus the Study/Preview playback-failure download
  fallback in `StudyMediaPlayer.vue`.
- New `useBulkMediaProgress.ts` runs a pre-counted list of steps sequentially
  and tracks completed/total/failed/current-label, used by the three bulk
  group components (`CardAddAnimeResults`, `CardAddArtistResults`,
  `CardImportListResults`) for both "Add all" and "Download all": total is
  the real eligible-operation count computed up front (one operation per
  still-needed video/audio download, not per card), current label names the
  song and media kind in flight, and a failure is counted via the existing
  per-item error state without stopping the run or being reported as
  success. Progress and any prior summary reset when the modal/accordion
  reopens for a different artist or anime.
- Isolated dev server (`GAQ_SRS_DATA_DIR` in the session scratchpad, an
  isolated library/download folder, port 3100 to avoid the user's real
  instance) driven with a small one-off headless-Chrome/CDP script (no
  Playwright): searching and adding "Cowboy Bebop" showed
  `Adding 0 of 2 - Ask DNA` while running and `Added 2 of 2` once done;
  clicking "Download all" showed `Downloading 0 of 4 - Ask DNA (video)`
  advancing through `Downloading 1 of 4 - Ask DNA (audio)` and
  `Downloading 2 of 4 - Gotta Knock a Little Harder (video)` as each
  finished, with the per-item label showing the `ActivityStatus` waiting
  text (elapsed seconds) before bytes arrived and a real percentage
  (0% -> 99%) once they did. Real files landed in the isolated download
  folder; the user's own library and cards were untouched.
- At a 390x844 emulated viewport, `document.documentElement.scrollWidth`
  stayed at 390 with the bulk progress line active
  (`Downloading 0 of 3 - Ask DNA (video)`) and a screenshot confirmed no
  layout break.
- Review diff: `gaq-loading-step-3-review.diff` (this session's scratchpad
  directory).
- Not exercised live: the "finishing" phase (all bytes received, awaiting
  the server's `done` event) is real per `downloadPhase()`'s unit tests, but
  every real download in the browser check finished that gap in under a
  second, too fast to screenshot; unit tests are the evidence there.
- Regular audit, check, and try-guide gates remain manual. This was the
  spec's last build step.
