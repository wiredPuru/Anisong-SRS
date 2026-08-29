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

### F-06 [P3] open - Stray untracked duplicate files (` 2` suffix) causing dev-server import warnings

**File:** blueprint/history/features/13b-card-assignment 2.md, blueprint/history/fixes/card-download-progress-and-refresh 2.md, nuxt-app/app/composables/useCardDownloads 2.ts, nuxt-app/server/api/decks/cards.delete 2.ts, nuxt-app/server/api/decks/cards.post 2.ts, nuxt-app/server/api/decks/memberships.get 2.ts, nuxt-app/server/db/migrations/0006_faulty_joystick 2.sql, nuxt-app/server/db/migrations/meta/0006_snapshot 2.json
**Found:** 2026-08-29 by /audit (scope: full; lens: quality)
**Why it matters:** Eight untracked files, byte-identical duplicates of already-committed files, have accumulated across this session (first two appeared before this session started; six more appeared after the feature 13b merge). They're not in any commit and don't affect production behavior, but `useCardDownloads 2.ts` is confirmed actively causing "Duplicated imports" warnings in the dev server on every boot (observed repeatedly this session). Left untouched throughout the session pending the user's own call on deleting them.
**Suggested fix:** Delete all eight (user decision, not this audit's to make) and figure out what's generating them - the timing (appearing right after merges) suggests some tool or process in the local environment, not anything this session's workflow wrote.
**Resolution:**

### F-07 [P3] unverified - Furigana HTML rendered via `v-html` from AniList-sourced title text, escaping behavior unverified

**File:** nuxt-app/app/components/study/StudyInfoPanel.vue:56
**Found:** 2026-08-29 by /audit (scope: full; lens: security)
**Why it matters:** `<span v-html="jpHtml" />` renders the response of `/api/furigana`, which wraps `animeTitleNative` (sourced from AniList) in ruby-annotation HTML via the `kuroshiro` library. Whether `kuroshiro` HTML-escapes the original text before wrapping it (as opposed to passing it through verbatim into the generated markup) hasn't been verified against its actual behavior - only inspected at the call-site level. Real-world risk is low regardless: this is a single-user local app (any injected script would only run in the user's own browser against their own already-trusted data), and AniList is a reasonably trusted upstream, not an arbitrary user-input channel.
**Suggested fix:** Either confirm `kuroshiro`'s output is safe for the range of characters AniList titles can contain (check its source/docs, or test with a title containing `<`/`>`/`&`), or replace `v-html` with a small manual ruby-markup renderer that escapes the base text itself and only trusts the furigana reading positions.
**Resolution:**
