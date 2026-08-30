# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-04 [P2] open - `extractErrorMessage` copy-pasted verbatim across five files

**File:** nuxt-app/app/composables/useStudySession.ts, nuxt-app/app/pages/cards/index.vue, nuxt-app/app/pages/cards/new.vue, nuxt-app/app/pages/decks/index.vue, nuxt-app/app/pages/settings.vue
**Found:** 2026-08-29 by /audit (scope: full; lens: quality)
**Why it matters:** The exact same 7-line `extractErrorMessage(err, fallback)` function is defined independently in five places (byte-for-byte identical in all five). This is precisely the pattern `coding-standards.md` calls out for extraction into a composable, and is the same class of defect as the already-fixed F-02 - except this specific helper was never itself consolidated even while F-02's fix was extracting `useCardDownloads()` alongside it in two of these same files. A future change (e.g. surfacing validation error arrays, not just `statusMessage`) now has to be made in five places to stay consistent.
**Suggested fix:** Extract to a small composable (e.g. `useApiError.ts` or add it to an existing shared composable) exporting `extractErrorMessage`, and have all five call sites import it instead of redefining it.
**Resolution:**

### F-05 [P2] open - Two delete actions have no error handling, unlike every other mutation in the app

**File:** nuxt-app/app/pages/settings.vue:38-41 (`removeFolder`), nuxt-app/app/pages/cards/index.vue:157-160 (`removeCard`)
**Found:** 2026-08-29 by /audit (scope: full; lens: quality)
**Why it matters:** Both functions are a bare `await $fetch(...)` followed by `await refresh()`, with no `try`/`catch` and no inline error display - unlike every other mutation in the app (`addFolder`, `setDefaultDownloadFolder`, `importDeck`, `saveEdit`, `downloadMedia`, and `deleteDeck`/`createDeck`/`renameDeck` on `decks/index.vue`, all of which wrap the call and surface a `*Error` ref on failure). If either `DELETE` call fails - a network hiccup, or the row already being gone - the user gets an unhandled promise rejection and no feedback, breaking the established pattern this app otherwise applies consistently.
**Suggested fix:** Wrap both in the same `try { ... } catch (err) { ...Error.value = extractErrorMessage(err, "Failed to remove ..."); }` shape already used by every sibling mutation on each of these pages, with a matching inline error element in the template.
**Resolution:**

### F-06 [P3] open - Stray untracked duplicate files (` 2` suffix) keep recurring after merges

**File:** (recurs with new filenames each time - most recently blueprint/history/features/18-per-scope-quiz-mode-preference 2.md, nuxt-app/server/api/study/scope-setting.get 2.ts, nuxt-app/server/api/study/scope-setting.patch 2.ts, nuxt-app/server/db/migrations/0007_handy_green_goblin 2.sql, nuxt-app/server/db/migrations/meta/0007_snapshot 2.json, nuxt-app/server/utils/studyScopeSettings 2.ts)
**Found:** 2026-08-29 by /audit (scope: full; lens: quality)
**Why it matters:** An earlier batch of 10 was deleted during feature 18's Step 1 after one blocked `bun run db:generate`. A fresh batch of 6 appeared by the time feature 19a's `/implement` started - same shape every time: untracked, byte-identical duplicates of files just touched by the previous feature's merge. Deleting them is a recurring tax, not a one-time cleanup, and the actual source (some local tool/process, not this session's own workflow) is still unidentified.
**Suggested fix:** Same as before (delete on sight, harmless to do so) - but this time actually track down what's generating them, since deleting the symptom each session hasn't stopped it from recurring. Worth checking editor/IDE auto-save, a file-watcher, or a sync tool with a "keep both copies" conflict-resolution habit.
**Resolution:** Re-deleted the latest batch of 6 (2026-08-29, during feature 19a's `/implement` Step 1) on the strength of the same-session precedent already approved for the identical situation in feature 18. Reopened rather than left `fixed`, since the underlying cause is still unaddressed and it will keep coming back. Recurred again (2026-08-29, during feature 30's `/implement` Step 1) - a fresh pair (`29-stats-refresh-and-clear 2.md`, `clear.post 2.ts`), byte-identical duplicates of the two files feature 29's merge had just touched. Deleted on sight, same precedent. Likely root cause found the same session: `nuxt-app/.data/` (gitignored, holds the live SQLite dev database) contains **30 numbered duplicate database files** (`gaq-srs 2.db` through `gaq-srs 30.db`/`-shm`/`-wal`, spanning 2026-08-28 through 2026-08-29, growing roughly once per dev-server run) alongside the real `gaq-srs.db`. This is the exact signature of iCloud Drive's "keep both copies" conflict resolution - the project lives under `~/Documents`, which iCloud Drive syncs by default on macOS, and SQLite's WAL mode does frequent small writes to `.db`/`.db-shm`/`.db-wal` that iCloud's sync heuristics can misread as concurrent conflicting edits. Not yet deleted (left for the user - unlike the small git-tracked case, this is 30 files of real local dev data and worth a deliberate look, not an unattended cleanup). Suggested next step if confirmed: exclude `nuxt-app/.data/` from iCloud sync (right-click -> "Remove Download" won't help; use System Settings -> iCloud Drive -> Desktop & Documents Folders, or move the whole project outside `~/Documents`), not a code fix.

### F-07 [P3] unverified - Furigana HTML rendered via `v-html` from AniList-sourced title text, escaping behavior unverified

**File:** nuxt-app/app/components/study/StudyInfoPanel.vue:56
**Found:** 2026-08-29 by /audit (scope: full; lens: security)
**Why it matters:** `<span v-html="jpHtml" />` renders the response of `/api/furigana`, which wraps `animeTitleNative` (sourced from AniList) in ruby-annotation HTML via the `kuroshiro` library. Whether `kuroshiro` HTML-escapes the original text before wrapping it (as opposed to passing it through verbatim into the generated markup) hasn't been verified against its actual behavior - only inspected at the call-site level. Real-world risk is low regardless: this is a single-user local app (any injected script would only run in the user's own browser against their own already-trusted data), and AniList is a reasonably trusted upstream, not an arbitrary user-input channel.
**Suggested fix:** Either confirm `kuroshiro`'s output is safe for the range of characters AniList titles can contain (check its source/docs, or test with a title containing `<`/`>`/`&`), or replace `v-html` with a small manual ruby-markup renderer that escapes the base text itself and only trusts the furigana reading positions.
**Resolution:**
