# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-14 [P2] open - `bun run preview` does not boot; the documented command crashes before its listener starts

**File:** nuxt-app/server/utils/dataDir.ts:16 (via nuxt-app/scripts/preview.mjs)
**Found:** 2026-09-08 by /audit (scope: current; lens: security, re-verifying F-11)
**Why it matters:** Nuxt's `preview` CLI runs the built server with its process `cwd` set to `.output` (its own banner confirms this: "Working directory: .output"). `resolveMigrationsFolder()` (`server/db/dataDir.ts:13-16`) falls back to the relative path `"server/db/migrations"` when `GAQ_SRS_MIGRATIONS_DIR` is unset, and nothing sets that variable for this path - only the launcher (`launcher/index.ts:31-33`, for a compiled binary or `bun run launch`) does. From `.output`, that relative path resolves to a directory that does not exist, so `runMigrations` throws `Can't find meta/_journal.json file` and the process exits(1) before Nitro ever opens a listener. Reproduced twice: once via `bun run preview` (the new `scripts/preview.mjs` wrapper) and once via the raw `node_modules/.bin/nuxt preview` binary with no wrapper at all - both fail identically, and `git log -- nuxt-app/package.json` shows the `preview` script has pointed at plain `nuxt preview` since the project's second commit, so this is a pre-existing gap, not a regression from this session's F-11 changes. It does mean AGENTS.md's Commands entry ("Preview production build: `bun run preview` (binds to `127.0.0.1`)") describes a command that cannot currently reach the point where its binding would even matter, and it is the one place besides the packaged launcher where someone would manually verify a production build.
**Suggested fix:** Have `scripts/preview.mjs` set `GAQ_SRS_MIGRATIONS_DIR` (and ideally `GAQ_SRS_DATA_DIR`) to an absolute path before importing the CLI, the same way `launcher/index.ts` already does, so the preview path doesn't depend on `cwd`. Add a smoke check (even just to the manual `/try` guide) that `bun run preview` actually reaches "GAQ SRS is running at ...".
**Resolution:** Re-examined 2026-09-26 by /audit (scope: full): still open. `scripts/preview.mjs` sets only `NITRO_HOST`/`HOST`, and `resolveMigrationsFolder()` (`server/db/dataDir.ts:16`) still falls back to the relative `"server/db/migrations"`.

### F-15 [P2] open - Only `onError` is scoped to the active element; `markPlayable` is not, so a detached element can retract a real failure

**File:** nuxt-app/app/components/study/StudyMediaPlayer.vue:363 (guard) vs 375 (no guard)
**Found:** 2026-09-13 by /audit (scope: current; lens: quality)
**Why it matters:** Step 1 added the right guard to the failing path - `onError()` drops any event whose `target` is not `activeEl` - but the new healing path it introduced has no equivalent. `markPlayable()` is bound to `@canplay`, `@loadeddata` and `@playing` on both elements and clears the failure unconditionally, without checking which element fired. Vue's `v-if`/`v-else-if` means only one element is mounted at a time, but a *detached* element keeps its template listeners and can still fire a late `loadeddata`/`canplay` from a load that was in flight when Vue swapped it out. Sequence: a video card is still loading, the user picks "Use audio for this card", `mediaKind` flips and the `<video>` is detached mid-load, the `<audio>` mounts with a genuinely broken source and errors (veil up, `failedKind = "audio"`), and then the detached `<video>` finishes loading and fires `loadeddata` - `markPlayable()` runs and clears a failure that is still true, leaving no veil and nothing playing. `watch(mediaKind)` pauses both elements on the swap, but pausing does not stop an in-flight load. This is the same defect class the fix exists to close, left open on the opposite path.
**Suggested fix:** Give `markPlayable` the guard `onError` already has - take the event, ignore it when `event.target !== activeEl.value` - so both directions agree on which element is allowed to speak. `onSeeked`/`settleBuffering` bindings do not need it; only the ones that mutate the failure verdict do.
**Resolution:** Re-examined 2026-09-26 by /audit (scope: full): still open. `markPlayable()` (`StudyMediaPlayer.vue:399`) still clears the failure without checking which element fired, while `onError()` (line 386) checks `el !== activeEl.value`.

### F-17 [P3] open - `onError` still infers the failed kind from `mediaKind`, which the spec asked it to stop doing

**File:** nuxt-app/app/components/study/StudyMediaPlayer.vue:370
**Found:** 2026-09-13 by /audit (scope: current; lens: quality)
**Why it matters:** The spec's own wording for this step is "Record which kind failed rather than inferring it from `mediaKind` at handler time", and the implementation does `const kind = mediaKind.value`. It is correct today only because `activeEl` is derived from `mediaKind`, so the guard immediately above it guarantees the two agree - the coupling the spec wanted removed is what makes the line safe. No current defect; it is a latent one if `activeEl` ever stops being a pure function of `mediaKind`.
**Suggested fix:** Derive it from the element that actually fired, which is already in hand: `const kind = el.tagName === "VIDEO" ? "video" : "audio"`. Same length, and it stops depending on a second source of truth.
**Resolution:** Re-examined 2026-09-26 by /audit (scope: full): still open, still `const kind = mediaKind.value` at `StudyMediaPlayer.vue:390`.

### F-19 [P2] open - LIKE wildcards in search text are not escaped, so `%` or `_` matches the whole library, including "Delete all matching"

**File:** nuxt-app/server/utils/cards.ts:93
**Found:** 2026-09-26 by /audit (scope: full; lens: quality)
**Why it matters:** `cardSearchCondition()` builds `%${trimmed}%` straight from user text, and `searchCards()` (line 88) and the deck searches (`server/utils/decks.ts:110,152,216`) do the same. A search for `%` becomes `%%%` and a search for `_` matches any non-empty title, so both return every card. `parseMatchingQuery()` (`server/utils/cardDelete.ts:28`) only rejects blank text, and `hasAnyCardsIdsFilter()`'s doc comment promises that `GET /api/cards/ids` "can never accidentally match the whole library". With `q=%` it does, and `/cards` then offers "Delete all N matching" over the full library. The count is shown and a confirm is required, so this is not silent, but the guard does not hold. Ordinary searches containing `%` or `_` (e.g. "100%") also return wrong matches.
**Suggested fix:** Add one `likeContains(text)` helper that escapes `\`, `%` and `_` and emits `LIKE ? ESCAPE '\'` (in Drizzle, a small `sql` template with an `escape` clause), use it at every `like()` site that takes user text, and unit-test it with `%`, `_`, and a backslash.
**Resolution:**

### F-20 [P2] open - `fetchNext()` has no stale-response guard, so an older `/api/study/next` answer can overwrite a newer one

**File:** nuxt-app/app/composables/useStudySession.ts:75
**Found:** 2026-09-26 by /audit (scope: full; lens: quality)
**Why it matters:** `fetchNext()` is triggered by the scope watcher, the filters watcher, `studyNewCards()`, and the page's post-review refresh, and nothing orders their responses: whichever request resolves last writes `currentCard`, `criterion`, `dueCount`, and `sessionComplete`. Applying filters while a post-review fetch is in flight, or switching decks while the previous deck's card is still loading, can leave a card on screen that is outside the active scope or filters, with a matching but stale `dueCount`. The review itself stays self-consistent, because `criterion` comes from the same response as the card, so it grades the right track for the wrong card. The codebase already has `createLatestRequest()` (`app/utils/latestRequest.ts`) for exactly this, and eleven other components and composables use it. Not reproduced at runtime; SQLite answers fast, so the race window is widest with a large list filter (up to 5000 ids).
**Suggested fix:** Hold one `createLatestRequest()` in the composable, call `start()` at the top of `fetchNext()`, and drop the result (without clearing `loading`) when `isLatest()` is false. A scope change can also `invalidate()` before it resets state.
**Resolution:**

### F-21 [P2] open - The 30s download and stream-cache timeout covers the whole body, so a slow or large clip always fails at 30 seconds

**File:** nuxt-app/server/utils/mediaDownload.ts:87 (also server/utils/streamCache.ts:78)
**Found:** 2026-09-26 by /audit (scope: full; lens: performance)
**Why it matters:** Both `fetch` calls pass `signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)` (30,000ms). That signal stays attached to the response body stream, so it aborts the body `reader.read()` loop too, not just the wait for headers. Any clip that takes more than 30s end to end is aborted and its partial file deleted. On the download path that shows "Download timed out."; on the stream-cache path the player gets a 502 for a clip that was actually still arriving. A 1080p OP/ED webm is commonly 30-80MB, which needs a sustained 8-21 Mbps to finish in 30s. Retrying cannot succeed either, because each attempt starts over. The comment at `StudyMediaPlayer.vue:221` already describes waiting "up to DOWNLOAD_TIMEOUT_MS" for the whole download. Confirmed from the code path; not measured against a real slow link.
**Suggested fix:** Split the budget: keep a short timeout for the response headers, then enforce an idle timeout between body chunks (reset on every `read()`), not a wall clock for the whole transfer. Keep it in the shared `mediaDownload.ts` so both callers get it.
**Resolution:**

### F-22 [P2] open - Security-relevant pure logic ships without tests: the library path guard, byte-range parsing, filename sanitizing, and deck card copy

**File:** nuxt-app/server/utils/mediaLibrary.ts:149 (also server/utils/rangedFile.ts:22, server/utils/mediaDownload.ts:10, server/utils/decks.ts:390)
**Found:** 2026-09-26 by /audit (scope: full; lens: tests)
**Why it matters:** The test gate has been on since feature 54, and the suite is large (74 files, 1143 tests, all passing), but no test imports `isPathWithinLibrary`, `serveRangedFile`'s range parser, or `sanitizeSegment`/`buildDownloadBaseName`, and nothing covers `copyCardsFromDecks` (feature 73, built after the gate was on). The first three are the only things between `/api/media?path=` and an arbitrary file read, and between remote metadata and the file name written to disk. Their edge cases are the kind a later refactor silently breaks: a sibling folder sharing a prefix (`/lib` vs `/lib2`), a `..`-prefixed file name, suffix ranges (`bytes=-500`), an end past EOF, and titles made only of stripped characters. `copyCardsFromDecks` computes `alreadyInDeck` by subtraction and has self-copy and missing-source paths that nothing asserts.
**Suggested fix:** Add `mediaLibrary.test.ts` cases for `isPathWithinLibrary` (inside, equal to root, sibling-prefix, `..` escape, relative input). Extract the range parse from `serveRangedFile` into a pure `parseByteRange(header, size)` and test it. Add `mediaDownload.test.ts` for `sanitizeSegment`/`buildDownloadBaseName`, and a `decks.test.ts` case for `copyCardsFromDecks` covering overlap with existing members, a missing source, and copying a deck into itself.
**Resolution:**

### F-23 [P3] open - Four route pages have grown to about 2000 lines each, mixing several features' state in one script block

**File:** nuxt-app/app/pages/stats/index.vue:1 (also app/pages/decks/index.vue, app/pages/study/index.vue, app/pages/cards/index.vue)
**Found:** 2026-09-26 by /audit (scope: full; lens: quality)
**Why it matters:** `stats` (2098 lines, 647 of script, about 565 of template), `decks` (2074, 785 script), `study` (2036, 1010 script), and `cards` (1914, 616 script) each own the state of many unrelated features. `study/index.vue` alone holds typed answers, scoring, Auto Reveal, filters, history, and session log wiring. `coding-standards.md` asks for "one job per component" and composables for reusable stateful logic. No defect today, but it is where features 79+ will land. Every change has to be read against a 1000-line script, and the recent feature/fix history keeps touching these files.
**Suggested fix:** Not a rewrite. When a feature next touches one of these pages, move one cohesive slice out with it: study's Auto Reveal and typed-answer round state into composables, and stats' self-contained sections (health, forecast, rhythm, trouble cards) into `components/stats/` the way `StatsActivityHeatmap.vue` already is.
**Resolution:**
