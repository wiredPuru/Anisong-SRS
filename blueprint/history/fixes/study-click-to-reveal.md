# Fix: Click blurred Study information to reveal the current card

**Type:** Fix
**Status:** verified

## The problem

On `/study`, clicking the blurred information panel does not reveal the
answer. `StudyInfoPanel` applies the blur but has no reveal interaction,
and the page only wires `revealCurrentCard()` to the separate Reveal button.
The archived `study-reveal-before-grade.md` spec describes panel clicking
as an existing reveal path, but that path is missing from the current code.

## The fix

Make the blurred information area on `/study` a click-to-reveal target.
Use the page's existing `revealCurrentCard()` handler so the click reveals
this presentation, stops its countdown, and makes Fail/Pass available
without recording a review or advancing. Keep Hide Info enabled so the
next presentation starts blurred, including a repeated card.

Use an accessible, labeled button covering only the information panel
while blurred, with a pointer cursor and visible keyboard focus. The
reveal click must not activate the language or streak controls underneath.
Remove the target after reveal so text selection and panel controls work
normally. Keep the edit panel and countdown outside the hit target's scope;
ensure the countdown does not intercept clicks intended for the info panel.
Scope this to Study; shared Preview behavior stays as it is. Reuse existing
reveal semantics for Auto Reveal modes rather than adding separate state.

## Build steps

- [x] **1. Wire the blurred Study panel to the existing reveal action.**
  Add the conditional accessible target and token-based styling in
  `nuxt-app/app/pages/study/index.vue`, adjusting the shared panel only if
  necessary for interaction isolation. Use the same hidden-state condition
  as the existing Reveal button and honor the review/modal interaction guards.
  **Done when:** clicking anywhere over blurred information reveals the
  current answer and shows Fail/Pass, with no grade, history entry, or
  advance; underlying controls are not triggered; the next presentation
  starts blurred when Hide Info remains on.

## Completion repairs authorized 2026-09-08

The user requested repairing F-11, F-12, and F-13 (all surfaced by a
full-project `/audit` run mid-session) before the merge to master.

- [x] **Repair F-11:** force the standalone launcher and documented preview
  command to bind to IPv4 loopback, overriding inherited public host settings.
  Keep the browser URL aligned with the listener. **Done when:** live listener
  inspection shows `127.0.0.1` and a local HTTP request succeeds.
- [x] **Repair F-12:** validate the full card edit before writes and commit its
  artist, song, and card changes atomically; delete cleared files only after
  commit. **Done when:** regression tests prove rejected edits and failed DB
  writes leave all metadata and media unchanged, while valid edits succeed.
- [x] **Repair F-13:** resolve an existing bundle entry with read-only identity
  queries and skip an existing card before any metadata write or file copy.
  **Done when:** importing stale metadata for an existing card preserves current
  anime/song/artist/card data, while fresh entries still import.

All three were re-reviewed and closed by a follow-up `/audit` pass before
completion (see Findings below).

## Verify

- On `/study` with Hide Info on, click the blurred title, detail rows, and
  panel background on fresh presentations. Each should reveal the whole
  panel without grading or advancing.
- Tab to the reveal target and activate it with Enter or Space. Check that
  activation does not also grade the card via global keyboard handlers.
- After reveal, confirm text selection, language toggles, and streak
  controls still work. Clicking visible information must not grade or advance.
- Grade a revealed card and confirm the next presentation starts blurred.
  Confirm the same reset when a failed card is presented again.
- With Auto Reveal counting down, click the panel and confirm the countdown
  stops and the answer stays revealed. Check normal and expanded Study layouts.
- Confirm the existing Reveal button, hotkeys, and Hide Info-off flow work.
- Run `bun run test` and `bun run build` from `nuxt-app/`. This is UI wiring,
  verified with real browser evidence; add a focused unit test only if the
  implementation introduces independently testable pure logic.

## Implementation evidence

- Implemented step 1 in `nuxt-app/app/pages/study/index.vue`: a conditional
  accessible overlay button calls `revealCurrentCard()`, with hidden panel
  controls inert and countdown pointer events disabled. The edit panel stays
  outside the reveal target. Enter/Space retain native button activation and
  stop bubbling to global key handlers.
- `bun run test`: 51 tests passed across 8 files.
- `bun run build`: passed. `git diff --check`: passed.
- Chrome accessibility inspection showed the new Reveal card information
  button with hidden child controls absent. A subsequent inspection showed
  visible information and Fail/Pass at the same Card 1 / 184 left count,
  but concurrent user activity meant the agent could not attribute that
  transition to its own action. Full pointer, keyboard, countdown, and
  next-card checks were not independently re-driven by the agent; the user
  reviewed and approved the step directly (see Review).
- Implemented the F-13 repair in `nuxt-app/server/utils/lookup.ts` (read-only
  `findAnimeByAniListId`/`findSongByAnimeAndSlot`/`getArtistById`) and
  `nuxt-app/server/utils/deckImport.ts` (`importBundle` resolves existing
  anime/song identity first, defers artist get-or-create until a song is
  actually being created, and reads the audio-filename artist back by the
  song's real `artistId`). Three new regression cases in
  `nuxt-app/server/utils/deckImport.test.ts` prove a stale reimport of an
  existing card leaves anime/artist/song/card rows unchanged, a genuinely
  new entry still creates a card, and a new theme for an already-known
  anime does not overwrite that anime's title fields.
- A follow-up `/audit current` pass independently re-verified all three
  repairs rather than just re-reading the diffs: F-11 was re-checked by
  running `bun run launch` with `HOST=0.0.0.0 NITRO_HOST=0.0.0.0` deliberately
  inherited and confirming via `lsof`/`curl` that the listener still bound
  only to `127.0.0.1`; F-12 by tracing `updateCard` end to end to confirm
  every validation precedes the transaction and cleanup follows it, then
  re-running the trigger-forced rollback test; F-13 by tracing the new
  read-then-insert path and re-running the new tests. All three closed. That
  pass also surfaced two new findings: F-14 (a pre-existing, unrelated defect
  where `bun run preview` fails to boot - left open, not in scope for this
  fix) and F-15 (a stray, unrelated `.vscode/extensions.json` edit - resolved
  by reverting it before this commit; see Findings).
- Final state: `bun run test` 62 tests passed across 10 files; `bun run
  build` passed; `git diff --check` passed.

## Review

User approved the implemented click-to-reveal step on 2026-09-08: "Looks good".
User authorized the F-11/F-12/F-13 repairs, then the merge to master, once the
repairs were closed by a follow-up `/audit` pass. Push to the remote was left
for a separate, later decision.

## Findings

### study-click-to-reveal/F-08 [P2] closed - The SRS scheduling core has no test, though the test gate is now on

**File:** nuxt-app/server/utils/study.ts:12-40 (`computeNextBoxState`)
**Found:** 2026-09-04 by /audit (scope: full; lens: tests)
**Why it matters:** Vitest was configured on 2026-09-04, which turned on the logic-test gate in `coding-standards.md`. That file names "Leitner box interval logic" as its first example of what the gate exists for. `computeNextBoxState` is the function behind it: exported, pure apart from `Date.now()`, and the single decider of every card's box, streak, and next due date. It has branches with real wrong answers - fail resets box and streak, box 1 advances only once `streak + 1 >= requiredStreak`, other boxes advance capped at `MAX_BOX`, and the interval is looked up with a `?? 0` fallback that silently makes an out-of-range box immediately due. None of it is covered. The four existing test files (`userDataDir`, `dataDir`, `version`, `versionGuard`) are all peripheral: launcher paths, packaging, and update checks. The heart of the app is the untested part, so a scheduling regression would surface as cards quietly resurfacing at the wrong time rather than as a failing check.
**Suggested fix:** Add `server/utils/study.test.ts` covering fail-resets-to-box-1, box-1 streak accumulation below and at `requiredStreak`, advancement from boxes 2-4, the `MAX_BOX` cap at 5, and the interval attached to each resulting box. Use `vi.useFakeTimers()` for `nextReviewAt`, the binding already named in `coding-standards.md`. No production change needed; the function is already shaped for this.
**Resolution:** Fixed 2026-09-04 via `/fix F-08` on `fix/study-scheduling-tests`. Added `server/utils/study.test.ts`: 11 cases covering fail-from-any-box, fail-from-box-1-with-a-streak (resets streak, not just box), sub-threshold and threshold-reaching box-1 passes, a box-2 pass, the box-5 cap, and the `nextReviewAt` interval for every box 1-5 via `vi.useFakeTimers()` pinned to a fixed instant. Verified the suite actually catches a wrong answer, not just a happy path: temporarily changed box 5's interval from 14 to 21 days in `study.ts`, confirmed the suite failed (1 of 35), then reverted and confirmed it passed again. `bun run build` passes clean. Re-reviewed 2026-09-08 by /audit: scheduling implementation and all 11 scheduling cases inspected; the full 51-test suite passes. Original coverage defect is closed.

### study-click-to-reveal/F-10 [P3] closed - The documented `CardWithDetails` shape is missing three fields the code returns

**File:** blueprint/context/project-overview.md (Data model, `CardWithDetails` block)
**Found:** 2026-09-04 by /audit (scope: full; lens: quality)
**Why it matters:** The overview documents `CardWithDetails` as the load-bearing shared shape and lists its fields explicitly, which is what a future session builds against without opening the source. The real interface (`server/utils/cards.ts:15-34`) also carries `streak` (added with the box-one-streak setting), `songTitleNative` (feature 30), and `animeCoverImageUrl` (feature 12, load-bearing for features 44 and 45). None of the three appear in the documented block. This is the same drift class corrected on 2026-09-04 for immersive mode, in a different place, and it is more likely to mislead: the block reads as an exact interface rather than prose.
**Suggested fix:** Add the three fields to the documented block, matching the client-side wire types (`nextReviewAt`/`createdAt` as `string`), and note that the server-side declaration types those two as `Date`. Related to F-09, which covers the underlying duplication rather than this instance of stale documentation.
**Resolution:** Fixed 2026-09-04 directly (no code changed, so no branch/PR - a documentation-only edit under the same latitude as the `Plan maintenance` corrections). Added `streak`, `songTitleNative`, and `animeCoverImageUrl` to the documented interface in `project-overview.md`, matching `server/utils/cards.ts:15-34` field-for-field, plus a note that the server types `nextReviewAt`/`createdAt` as `Date` while the documented block shows the post-JSON `string` wire shape. Re-reviewed 2026-09-08 by /audit: all three originally missing fields are present and match server/client types, including the Date serialization note. Original defect is closed.

### study-click-to-reveal/F-11 [P1] closed - Standalone launch does not enforce the localhost-only boundary

**File:** nuxt-app/launcher/index.ts:52
**Found:** 2026-09-08 by /audit (scope: full, partial coverage; lens: security)
**Why it matters:** The launcher sets PORT and opens a localhost URL but never sets NITRO_HOST or HOST before importing the server. The successful production build confirms the generated listener passes `process.env.NITRO_HOST || process.env.HOST` to `server.listen`, leaving the host unspecified by default and binding all interfaces. The app deliberately has no authentication. Another machine able to reach this port can call card deletion (which also deletes unreferenced media), or register a filesystem folder and read files through /api/media. This violates the documented single-user localhost-only boundary. Static launcher, generated-listener, and route evidence confirms the path; no remote access was attempted.
**Suggested fix:** Bind the standalone server explicitly to loopback before importing Nitro and align the browser URL with that address. Ensure the documented production preview path uses loopback too.
**Resolution:** Fixed 2026-09-08: launcher and preview force 127.0.0.1; launcher URL honors NITRO_PORT. Live preview and Bun launcher returned HTTP 200 and lsof confirmed loopback-only listeners despite inherited HOST/NITRO_HOST=0.0.0.0. Build and 51 tests passed. Re-reviewed 2026-09-08 by /audit (independent re-verification, not just re-reading the diff): ran `bun run launch` with `HOST=0.0.0.0 NITRO_HOST=0.0.0.0` deliberately inherited, and `lsof` showed the listener bound only to `127.0.0.1:<port>` (never `0.0.0.0` or `*`), with a live `curl` to `127.0.0.1` returning 200 - confirms `launcher/index.ts:54-55`'s unconditional (not `??=`) override actually wins over a hostile inherited environment. `scripts/preview.mjs` sets the same two env vars before importing the Nuxt CLI, unconditionally and before any server code runs, so the fix is structurally identical for that path. Original defect is closed. See the live ledger's F-14 for a separate, pre-existing (not introduced by this fix) defect discovered while re-verifying this finding: `bun run preview` does not actually boot to a listener at all in this environment.

### study-click-to-reveal/F-12 [P1] closed - Rejected card edits still persist metadata changes

**File:** nuxt-app/server/utils/cards.ts:507
**Found:** 2026-09-08 by /audit (scope: full, partial coverage; lens: quality)
**Why it matters:** updateCard writes artist reassignment/rename and song fields at lines 507-515 before validating local paths at lines 526-544 and the final source requirement at lines 551-559. A PATCH with a changed song title and a nonexistent local path returns HTTP 400 after persisting the title; a shared artist rename affects other cards too. There is no transaction or rollback. Confirmed by the reachable PATCH route and write-before-error control flow.
**Suggested fix:** Validate the entire proposed edit before writing, then commit the artist, song, and card updates in a single transaction. Keep filesystem cleanup after successful commit. Add a regression case proving a rejected edit leaves metadata unchanged.
**Resolution:** Fixed 2026-09-08: updateCard validates before mutation, groups artist/song/card writes in a SQLite transaction, and cleans up cleared media after commit. Eight in-memory SQLite regression cases cover rejected rename/reassignment, last-source rejection, rollback on final-write failure, successful edits, and cleanup timing. All 59 tests and build passed. Re-reviewed 2026-09-08 by /audit: read `cards.ts:455-577` end to end - every validation (empty name, theme-slot collision, artist-name collision, local-path existence, final-source requirement) runs and can still return an error before `db.transaction` opens at line 552, and the transaction body (rename/reassign, song fields, card fields) is the only place any of the three tables is written; `deleteFileIfUnreferenced` for cleared paths runs only after the transaction call returns, i.e. after commit. Re-ran `cardEdits.test.ts`'s eight cases, including the trigger-forced rollback case, all passing. Original defect is closed.

### study-click-to-reveal/F-13 [P1] closed - Skipped bundle entries overwrite existing metadata

**File:** nuxt-app/server/utils/deckImport.ts:54
**Found:** 2026-09-08 by /audit (scope: full, partial coverage; lens: quality)
**Why it matters:** importBundle calls upsertAnime and upsertSong before checking cardExistsForSong at line 70. Both upserts update existing rows. Reimporting an older bundle after editing a song title or artist silently replaces the current metadata with the bundled values, then reports that entry as skipped. Anime titles can also be overwritten. This contradicts the documented skip-existing behavior and can undo user edits despite zero cards being created. Confirmed by the upsert conflict-update implementations in server/utils/lookup.ts.
**Suggested fix:** Resolve existing anime/song identities with read-only queries and check for an existing card before mutating metadata. Keep duplicate entries unchanged and add a regression case with conflicting bundled metadata.
**Resolution:** Fixed 2026-09-08: added read-only `findAnimeByAniListId`/`findSongByAnimeAndSlot`/`getArtistById` lookups in `lookup.ts`; `importBundle` now resolves existing anime/song rows by identity and only falls back to `upsertAnime`/`upsertSong` (an insert, since no conflicting row exists) when genuinely new. The artist get-or-create call also moved behind the "song not found" branch so a to-be-skipped existing song can no longer spawn a stray artist row from the bundle's stale name, and the audio-filename artist name is now read back by the song's actual `artistId` rather than the bundle's name, so a reassigned artist (feature 16) is honored too. Three new regression cases in `deckImport.test.ts`: reimporting a bundle with conflicting anime/artist/song metadata for an entry whose card already exists leaves all four tables byte-for-byte unchanged and reports it skipped; a genuinely new entry still creates a card; and importing a new theme for an anime that already exists (by aniListId) does not overwrite that anime's current title fields. All 62 tests and the build pass. Re-reviewed 2026-09-08 by /audit: read `deckImport.ts:51-100` and `lookup.ts:1-24` end to end - the anime and song upserts are both now reached only through a `?? upsertX(...)` fallback whose left side is the new read-only finder, so an existing row's fields never enter an `onConflictDoUpdate` `set` clause; `getOrCreateArtist` only runs inside the `if (!songRow)` branch, so it cannot fire for an entry that resolves to an existing song. Ran the three new tests plus the full suite (62 passing) and traced the first test case by hand against the diff to confirm the assertion actually exercises the fixed path (an anime/song/card pre-seeded with different values than the bundle, then reimported). Original defect is closed.

### study-click-to-reveal/F-15 [P3] closed - An unrelated VS Code extension recommendation is mixed into this fix's working tree

**File:** .vscode/extensions.json:3
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** The working tree for this fix (`fix/study-click-to-reveal`, currently mid F-11/F-12/F-13 repair) adds `"openai.chatgpt"` to the recommended-extensions list, alongside the existing `anthropic.claude-code` entry. Nothing in `current-feature.md`'s scope (click-to-reveal, then the F-11/F-12/F-13 repairs) touches editor tooling, and `ai-interaction.md` asks for minimal, in-scope changes only. This reads as an accidental or exploratory edit that would ride along into the feature commit unnoticed.
**Suggested fix:** Drop the `openai.chatgpt` line unless it was an intentional, separate request - confirm with the user before it's included in `/complete`'s commit.
**Resolution:** Confirmed with the user during `/complete` on 2026-09-08: not intentional. Reverted `.vscode/extensions.json` to only `anthropic.claude-code`; `git diff` against the pre-session version is now empty for this file. Closed.
