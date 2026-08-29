# Rollback: Feature 18 - Per-scope quiz-mode preference

**Type:** Rollback
**Status:** verified
**Target feature:** 18 - Per-scope quiz-mode preference
**Target archive:** `blueprint/history/features/18-per-scope-quiz-mode-preference.md`
**Target commit:** `e3a91b09abbab90d4568d379fbd7edc32d058140`
**Target parent:** `6e1d0f90e1995a388a8266a8919852451d7d345c`
**Reason:** Feature 18's `forcedMode` mechanism let `StudyMediaPlayer`'s
`mediaKind` change after playback had already started, causing two audio
streams to play at once on `/study`. A targeted fix (commit `18bdea8`) tried
to patch this by pausing the outgoing element on a `mediaKind` change, but
the user confirmed by ear that it did not resolve the overlap. Rather than
keep patching a mechanism that's still misbehaving, remove it.

## Goal

Restore `/study` and `/decks` to their pre-feature-18 behavior (no per-scope
quiz-mode preference, no `forcedMode`) while preserving Blueprint history and
the later, unrelated work built on top (pagination, global search, and the
now-unnecessary fix).

## Scope

### Reverse

- Product paths and behavior introduced or changed by the target commit
  (below).

### Preserve

- The original feature 18 archive.
- Later build-plan and project-plan changes (including the `project-plan.md`/
  `project-overview.md` edits made specifically to document this feature's
  data model - those become stale prose describing a removed feature, which
  is expected and corrected separately, not part of this rollback).
- Blueprint context, adapter skills, this rollback spec, and prototypes.
- Feature 19a (pagination) and 19b (global search) - confirmed compatible
  below, not cascaded.
- The fix commit's `watch(mediaKind, ...)` in `StudyMediaPlayer.vue` - stays
  in place (see Later-change risk). It becomes practically inert once
  `forcedMode` is gone, but removing it is a separate cleanup call, not part
  of this rollback's scope.

### Out of scope

- Cascading rollbacks of 19a or 19b.
- Rewriting `project-plan.md`/`project-overview.md` to remove the stale
  feature-18 references - a follow-up `/overview` regeneration once this
  lands, not part of the rollback itself.
- Removing the fix commit's now-vestigial `watch(mediaKind, ...)` - harmless
  to leave, a separate decision.

## Product paths

- `nuxt-app/app/components/study/StudyMediaPlayer.vue` (modified - removes
  the `forcedMode` prop and the `hasAudioSource`/forced-mode branches in
  `mediaKind`)
- `nuxt-app/app/pages/decks/index.vue` (modified - removes the two "Quiz
  mode" selectors and their fetch/patch logic)
- `nuxt-app/app/pages/study/index.vue` (modified - removes `scopeMode`
  fetch/pass-through)
- `nuxt-app/server/api/study/next.get.ts` (modified - reverts to its
  pre-feature-18 inline scope validation, since `parseStudyScope` goes away)
- `nuxt-app/server/api/study/scope-setting.get.ts` (added by the target -
  deleted on reverse)
- `nuxt-app/server/api/study/scope-setting.patch.ts` (added by the target -
  deleted on reverse)
- `nuxt-app/server/db/migrations/0007_handy_green_goblin.sql` (added by the
  target - deleted on reverse)
- `nuxt-app/server/db/migrations/meta/0007_snapshot.json` (added by the
  target - deleted on reverse)
- `nuxt-app/server/db/migrations/meta/_journal.json` (modified - the
  migration-0007 journal entry is removed)
- `nuxt-app/server/db/schema.ts` (modified - removes the
  `studyScopeSetting` table definition)
- `nuxt-app/server/utils/cards.ts` (modified - removes `parseStudyScope`
  and its `getAnimeLabel`/`getArtistLabel` import)
- `nuxt-app/server/utils/studyScopeSettings.ts` (added by the target -
  deleted on reverse)

**A live-database note, not a "product path" the standard reverse patch
handles:** the target commit's migration created a real `study_scope_setting`
table in `nuxt-app/.data/gaq-srs.db`. Reverting the migration *files* removes
them from Drizzle's tracked history, but Drizzle's migration runner only
ever applies forward - it will not retroactively drop a table just because
its migration file disappeared. Left alone, the table would sit in the live
database, orphaned and unreferenced by any code, which risks a future
`CREATE TABLE study_scope_setting` migration colliding with it if this
feature (or a same-named one) is ever rebuilt. Build step 2 below drops it
directly. This destroys only that table's own rows (a handful of per-scope
playback-preference settings this exact feature created) - not cards, decks,
review history, or anything else. Losing that table's own data is the
expected effect of rolling back the feature that created it, not incidental
collateral damage, so it isn't the "destructive data migration" the Out of
scope section above means to rule out.

## Later-change risk

**Classification:** Overlap, likely compatible

| Later commit | Shared path or contract | Required handling |
| ------------ | ----------------------- | ----------------- |
| `29361ac` feat: add pagination to cards and decks lists (19a) | `server/utils/cards.ts` - 19a inserted a new `PAGE_SIZE` import and a `Paginated<T>` interface *immediately after* the single import line this rollback removes (`import { getAnimeLabel, getArtistLabel } from "./decks.ts";`) | The one real mechanical conflict risk in this whole rollback. `git apply --reverse --3way` may resolve this via context matching, or may flag a conflict on that import line specifically. If it conflicts: resolve by hand-removing only feature 18's single added import line, leaving 19a's `PAGE_SIZE` import and `Paginated<T>` interface completely untouched. Nothing in 19a calls `parseStudyScope` or otherwise depends on feature 18's behavior - this is a pure line-adjacency issue, not a functional dependency. |
| `29361ac` feat: add pagination to cards and decks lists (19a) | `app/pages/decks/index.vue` - both commits edit this file, but in non-adjacent regions (19a: the top-level/detail `useFetch` blocks and their `watch`, plus a `<Pager>` insertion late in the template; feature 18: a separate scope-mode fetch block after `extractErrorMessage`, plus two "Quiz mode" `<select>` insertions at different template points) | Expected to apply cleanly - no shared lines. |
| `18bdea8` fix: stop overlapping audio when a scope's forced mode swaps the player mid-play | `app/components/study/StudyMediaPlayer.vue` - the fix added a `watch(mediaKind, ...)` block well downstream (near `activeEl`) of where feature 18 changed `mediaKind` itself (near the `props` declaration) | No shared lines - applies cleanly. Preserve the fix's watcher as-is (see Preserve/Out of scope above) rather than also reverting it. |
| `9847aaf` feat: add global search to the nav bar (19b) | `server/utils/cards.ts` - 19b added `like` to the same `drizzle-orm` import line feature 18 didn't touch, plus a `searchCards` function in a separate region | Different specific lines than feature 18 changed - expected to apply cleanly. |

No later commit calls `parseStudyScope`, either scope-setting endpoint, or
anything from `studyScopeSettings.ts` - confirmed by searching the codebase
at `HEAD`. This is overlap in shared files, not a functional dependency.

## Build steps

- [x] **Step 1 - Reverse the target commit's product diff** - apply with the
  Type: Rollback guard in `/implement` (resolve the one flagged import-line
  conflict in `cards.ts` by hand if it occurs, per the table above; stop and
  report anything else that conflicts rather than guessing). *Done when:*
  the reverse patch applies to exactly the product paths listed above,
  every protected Blueprint path is untouched, and `git diff --cached`
  matches this scope.

- [x] **Step 2 - Drop the orphaned `study_scope_setting` table from the live
  database** - `nuxt-app/.data/gaq-srs.db`, e.g. via `sqlite3
  nuxt-app/.data/gaq-srs.db "DROP TABLE IF EXISTS study_scope_setting;"`.
  *Done when:* the table no longer exists in the live database (`sqlite3
  nuxt-app/.data/gaq-srs.db ".tables"` doesn't list it), and the app still
  boots cleanly (`bun run dev`, no migration errors - confirms the reverted
  journal and the live database now agree).

- [x] **Step 3 - Run project checks and the observable removal path** -
  `bun run build`; confirm the routes and UI listed under Verification
  below are actually gone, and that unaffected study behavior still works.

## Verification

- **Build:** `bun run build` (from `nuxt-app/`, per `AGENTS.md` Commands)
- **Tests:** not configured (`AGENTS.md` Commands has no `test` entry)
- **Removed behavior:** `GET`/`PATCH /api/study/scope-setting` both 404
  (route no longer exists); `/decks` shows no "Quiz mode" selector next to
  either "Study all decks" or an Artist/Anime deck's "Study this deck";
  `StudyMediaPlayer` has no `forcedMode` prop for anything to pass.
- **Regression path:** `/study?type=all` still loads a due card and plays
  it normally - core study/playback behavior, entirely unaffected by this
  rollback, still works exactly as before feature 18 ever existed.

## Notes for the AI

- Stop on any patch conflict outside the one specifically flagged above
  (the `cards.ts` import line), or on any sign of an unplanned dependency -
  don't guess past it.
- Do not delete `blueprint/history/features/18-per-scope-quiz-mode-preference.md`.
  It stays as the permanent record that this feature was built, then
  rolled back.
- Do not broaden this rollback to also revert the fix commit's watcher, or
  to touch 19a/19b's own code beyond what's needed to resolve the one
  flagged import-line conflict.
- Step 2's `DROP TABLE` targets only `study_scope_setting` - never run a
  broader statement against the live database.
