# Fix: Test the SRS scheduling core

**Type:** Fix
**Status:** verified
**Fixes:** F-08

## The problem

`computeNextBoxState()` in `server/utils/study.ts:12-40` is the entire Leitner
scheduling decision: given a card's current box, its box-1 streak, a pass/fail
result, and the configured streak requirement, it decides the new box, streak,
and `nextReviewAt`. It is exported, pure apart from reading `Date.now()`, and
has no test - despite the test gate being on (`AGENTS.md` declares `bun run
test`) and `coding-standards.md` naming Leitner interval logic as its first
example of what the gate is for.

Real branches, each with a wrong answer available:

- fail always resets box to 1 and streak to 0, regardless of current box
- at box 1, a pass only advances to box 2 once `streak + 1 >= requiredStreak`;
  otherwise it stays at box 1 with the incremented streak
- at any box above 1, a pass advances one box, capped at `MAX_BOX` (5)
- `nextReviewAt` is `now + INTERVAL_DAYS[box] days`, where `INTERVAL_DAYS` is
  `{1: 0, 2: 1, 3: 3, 4: 7, 5: 14}` and a missing key falls back to `?? 0`

A wrong answer here doesn't crash or fail loudly - it makes a card resurface at
the wrong time, silently, which is exactly the kind of defect a test catches
and a screenshot never will.

## The fix

Add `server/utils/study.test.ts` covering every branch above. No production
code changes - `computeNextBoxState` is already pure and already exported for
this. Use `vi.useFakeTimers()` so `nextReviewAt` assertions are exact rather
than tolerance-based, matching the Vitest binding already named in
`coding-standards.md`.

Must not break: `recordReview()` (the only caller, `study.ts:44+`) is untouched.

## Build steps

- [x] **Step 1 - Write `study.test.ts`.** Cover: fail from box 3 resets to
  box 1/streak 0; fail from box 1 with an existing streak also resets streak to
  0 (not just box); a box-1 pass below `requiredStreak` stays at box 1 with
  streak incremented; a box-1 pass that reaches `requiredStreak` advances to
  box 2 with streak reset to 0; a pass at box 2 advances to box 3; a pass at
  box 5 (`MAX_BOX`) stays at 5, not 6; the `nextReviewAt` attached to each of
  boxes 1 through 5 matches `INTERVAL_DAYS` exactly, using `vi.useFakeTimers()`
  pinned to a known instant.
  *Done when:* `bun run test` is green and the new file's case count matches
  the seven scenarios above (a `describe`/`it` per scenario, not one combined
  assertion).

## Verify

`bun run test` - the file must appear in the run and every case pass.
`bun run build` - confirms the change is test-only and nothing else moved.

## Findings

### study-scheduling-tests/F-04 [P2] closed - `extractErrorMessage` copy-pasted verbatim across five files

**File:** nuxt-app/app/composables/useStudySession.ts, nuxt-app/app/pages/cards/index.vue, nuxt-app/app/pages/cards/new.vue, nuxt-app/app/pages/decks/index.vue, nuxt-app/app/pages/settings.vue
**Found:** 2026-08-29 by /audit (scope: full; lens: quality)
**Why it matters:** The exact same 7-line `extractErrorMessage(err, fallback)` function is defined independently in five places (byte-for-byte identical in all five). This is precisely the pattern `coding-standards.md` calls out for extraction into a composable, and is the same class of defect as the already-fixed F-02 - except this specific helper was never itself consolidated even while F-02's fix was extracting `useCardDownloads()` alongside it in two of these same files. A future change (e.g. surfacing validation error arrays, not just `statusMessage`) now has to be made in five places to stay consistent.
**Suggested fix:** Extract to a small composable (e.g. `useApiError.ts` or add it to an existing shared composable) exporting `extractErrorMessage`, and have all five call sites import it instead of redefining it.
**Resolution:** Fixed 2026-09-01 via `/fix F-04` on `fix/extract-api-error-composable`. By the time this was repaired the duplication had grown to 12 files (not 5). Added `nuxt-app/app/composables/useApiError.ts` exporting `extractErrorMessage` unchanged, and deleted the local definition from all 12 call sites, relying on Nuxt's existing auto-import convention - no call-site changes needed. `bun run build` passes clean. Awaiting `/audit` re-review to close. **Closed 2026-09-04 by /audit** (scope: full; lens: all): `grep -rn "function extractErrorMessage" app/` returns exactly one definition, `app/composables/useApiError.ts:1`, and 17 files reference the helper through auto-import. The repair introduced no new duplication. Note the related but distinct F-09 (live ledger) raised the same pass against a different duplication class the repair did not cover.

### study-scheduling-tests/F-05 [P2] closed - Two delete actions have no error handling, unlike every other mutation in the app

**File:** nuxt-app/app/pages/settings.vue:38-41 (`removeFolder`), nuxt-app/app/pages/cards/index.vue:157-160 (`removeCard`)
**Found:** 2026-08-29 by /audit (scope: full; lens: quality)
**Why it matters:** Both functions are a bare `await $fetch(...)` followed by `await refresh()`, with no `try`/`catch` and no inline error display - unlike every other mutation in the app (`addFolder`, `setDefaultDownloadFolder`, `importDeck`, `saveEdit`, `downloadMedia`, and `deleteDeck`/`createDeck`/`renameDeck` on `decks/index.vue`, all of which wrap the call and surface a `*Error` ref on failure). If either `DELETE` call fails - a network hiccup, or the row already being gone - the user gets an unhandled promise rejection and no feedback, breaking the established pattern this app otherwise applies consistently.
**Suggested fix:** Wrap both in the same `try { ... } catch (err) { ...Error.value = extractErrorMessage(err, "Failed to remove ..."); }` shape already used by every sibling mutation on each of these pages, with a matching inline error element in the template.
**Resolution:** Fixed 2026-09-01 via `/fix F-05` on `fix/delete-action-error-handling`. `removeFolder` now uses a shared `removeFolderError` ref (matching `addError`/`defaultFolderError`, already single-shared refs on that same page). `removeCard` now uses a per-card `removeCardError` reactive record (matching `downloadError`'s existing per-card keying on that same page, since deletes can fire concurrently from different rows). Both wrap their `$fetch` call in `try`/`catch` and render an inline error reusing existing `.add-error`/`.edit-error` styling; `.card-actions` gained `flex-wrap` plus a `flex-basis: 100%` error line so it only affects layout when an error is actually present. `bun run build` passes clean. Awaiting `/audit` re-review to close. **Closed 2026-09-04 by /audit** (scope: full; lens: all): both handlers now wrap their `$fetch` in try/catch and assign through `extractErrorMessage` (`settings.vue:72-80`, `cards/index.vue:339-351`), and both errors render (`settings.vue:201`, `cards/index.vue:567`). `removeCard`'s per-card keying still holds after feature 50c moved the action into the inspector rail, where the error renders against `selectedCard`. Re-checked specifically because feature 54 edited `settings.vue`; that edit did not disturb the repair.

### study-scheduling-tests/F-07 [P3] closed - Furigana HTML rendered via `v-html` from AniList-sourced title text, escaping behavior unverified

**File:** nuxt-app/app/components/study/StudyInfoPanel.vue:56
**Found:** 2026-08-29 by /audit (scope: full; lens: security)
**Why it matters:** `<span v-html="jpHtml" />` renders the response of `/api/furigana`, which wraps `animeTitleNative` (sourced from AniList) in ruby-annotation HTML via the `kuroshiro` library. Whether `kuroshiro` HTML-escapes the original text before wrapping it (as opposed to passing it through verbatim into the generated markup) hasn't been verified against its actual behavior - only inspected at the call-site level. Real-world risk is low regardless: this is a single-user local app (any injected script would only run in the user's own browser against their own already-trusted data), and AniList is a reasonably trusted upstream, not an arbitrary user-input channel.
**Suggested fix:** Either confirm `kuroshiro`'s output is safe for the range of characters AniList titles can contain (check its source/docs, or test with a title containing `<`/`>`/`&`), or replace `v-html` with a small manual ruby-markup renderer that escapes the base text itself and only trusts the furigana reading positions.
**Resolution:** Fixed 2026-09-01 via `/fix F-07` on `fix/escape-furigana-html`. Verified directly against the installed `kuroshiro` package that it does not escape at all - `<script>alert(1)</script>` passed through completely unescaped, only kanji spans get wrapped in `<ruby>`. Also found a second instance of the same class of bug while investigating: `StudyInfoPanel.vue` also rendered raw, unprocessed title text (not run through kuroshiro) via the same `v-html` span whenever Furigana was off or the fetch failed - a routine state, not just an edge case. Fixed both: `toFuriganaHtml()` now HTML-escapes input before calling `kuroshiro.convert()` (verified this does not break kanji/ruby detection for real Japanese text); `StudyInfoPanel.vue` now only ever uses `v-html` for genuine kuroshiro output (gated on new `animeJpIsHtml`/`songJpIsHtml` flags), rendering plain fallback text via auto-escaped interpolation instead. `bun run build` passes clean. Awaiting `/audit` re-review to close. **Closed 2026-09-04 by /audit** (scope: full; lens: all): `toFuriganaHtml` escapes `&`, `<`, `>`, `"`, and `'` before `kuroshiro.convert` (`furigana.ts:85-96`), and the two `v-html` bindings that remain (`StudyInfoPanel.vue:217,227`) are each gated on an `IsHtml` flag set true only inside the `/api/furigana` success branch (`:117-118`); the initial, no-furigana, and `catch` paths all set it false and fall through to `{{ }}` interpolation (`:95-125`). No unescaped path into `v-html` remains, and no other `v-html` exists in `app/`.
