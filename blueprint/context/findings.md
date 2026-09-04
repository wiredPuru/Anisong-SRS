# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-08 [P2] fixed - The SRS scheduling core has no test, though the test gate is now on

**File:** nuxt-app/server/utils/study.ts:12-40 (`computeNextBoxState`)
**Found:** 2026-09-04 by /audit (scope: full; lens: tests)
**Why it matters:** Vitest was configured on 2026-09-04, which turned on the logic-test gate in `coding-standards.md`. That file names "Leitner box interval logic" as its first example of what the gate exists for. `computeNextBoxState` is the function behind it: exported, pure apart from `Date.now()`, and the single decider of every card's box, streak, and next due date. It has branches with real wrong answers - fail resets box and streak, box 1 advances only once `streak + 1 >= requiredStreak`, other boxes advance capped at `MAX_BOX`, and the interval is looked up with a `?? 0` fallback that silently makes an out-of-range box immediately due. None of it is covered. The four existing test files (`userDataDir`, `dataDir`, `version`, `versionGuard`) are all peripheral: launcher paths, packaging, and update checks. The heart of the app is the untested part, so a scheduling regression would surface as cards quietly resurfacing at the wrong time rather than as a failing check.
**Suggested fix:** Add `server/utils/study.test.ts` covering fail-resets-to-box-1, box-1 streak accumulation below and at `requiredStreak`, advancement from boxes 2-4, the `MAX_BOX` cap at 5, and the interval attached to each resulting box. Use `vi.useFakeTimers()` for `nextReviewAt`, the binding already named in `coding-standards.md`. No production change needed; the function is already shaped for this.
**Resolution:** Fixed 2026-09-04 via `/fix F-08` on `fix/study-scheduling-tests`. Added `server/utils/study.test.ts`: 11 cases covering fail-from-any-box, fail-from-box-1-with-a-streak (resets streak, not just box), sub-threshold and threshold-reaching box-1 passes, a box-2 pass, the box-5 cap, and the `nextReviewAt` interval for every box 1-5 via `vi.useFakeTimers()` pinned to a fixed instant. Verified the suite actually catches a wrong answer, not just a happy path: temporarily changed box 5's interval from 14 to 21 days in `study.ts`, confirmed the suite failed (1 of 35), then reverted and confirmed it passed again. `bun run build` passes clean. Awaiting `/audit` re-review to close.

### F-10 [P3] fixed - The documented `CardWithDetails` shape is missing three fields the code returns

**File:** blueprint/context/project-overview.md (Data model, `CardWithDetails` block)
**Found:** 2026-09-04 by /audit (scope: full; lens: quality)
**Why it matters:** The overview documents `CardWithDetails` as the load-bearing shared shape and lists its fields explicitly, which is what a future session builds against without opening the source. The real interface (`server/utils/cards.ts:15-34`) also carries `streak` (added with the box-one-streak setting), `songTitleNative` (feature 30), and `animeCoverImageUrl` (feature 12, load-bearing for features 44 and 45). None of the three appear in the documented block. This is the same drift class corrected on 2026-09-04 for immersive mode, in a different place, and it is more likely to mislead: the block reads as an exact interface rather than prose.
**Suggested fix:** Add the three fields to the documented block, matching the client-side wire types (`nextReviewAt`/`createdAt` as `string`), and note that the server-side declaration types those two as `Date`. Related to F-09, which covers the underlying duplication rather than this instance of stale documentation.
**Resolution:** Fixed 2026-09-04 directly (no code changed, so no branch/PR - a documentation-only edit under the same latitude as the `Plan maintenance` corrections). Added `streak`, `songTitleNative`, and `animeCoverImageUrl` to the documented interface in `project-overview.md`, matching `server/utils/cards.ts:15-34` field-for-field, plus a note that the server types `nextReviewAt`/`createdAt` as `Date` while the documented block shows the post-JSON `string` wire shape. Awaiting `/audit` re-review to close.
