# Current Feature

## Title

Extract duplicated `extractErrorMessage` into a shared composable

## Type

Fix

## Status

Verified

## Fixes

F-04

## The problem

The exact same 7-line `extractErrorMessage(err, fallback)` helper is defined
independently in every file that needs to turn a caught `$fetch` error into a
user-facing message, instead of living in one shared place. At the time F-04
was raised (2026-08-29) this was 5 files; re-checking today it has grown to
**12 files**, all byte-for-byte identical:

- `nuxt-app/app/composables/useStudySession.ts:29`
- `nuxt-app/app/pages/cards/index.vue:191`
- `nuxt-app/app/pages/cards/new.vue:50`
- `nuxt-app/app/pages/decks/index.vue:332`
- `nuxt-app/app/pages/settings.vue:17`
- `nuxt-app/app/pages/stats/index.vue:72`
- `nuxt-app/app/components/card/CardPreviewModal.vue:159`
- `nuxt-app/app/components/deck/DeckAddAnimeModal.vue:50`
- `nuxt-app/app/components/settings/SettingsBoxOneStreakControl.vue:16`
- `nuxt-app/app/components/settings/SettingsNewCardLimitControl.vue:21`
- `nuxt-app/app/components/settings/SettingsPlaybackModeControl.vue:8`
- `nuxt-app/app/components/settings/SettingsStreamCacheSizeControl.vue:16`

This is exactly the pattern `coding-standards.md` calls out for extraction
into a composable, and the same class of defect F-02 already fixed once for
`useCardDownloads()` - except this helper was never itself consolidated, even
in files F-02 touched. Any future change (e.g. surfacing validation error
arrays, not just `statusMessage`) has to be made in 12 places to stay
consistent, and it will keep growing every time a new page/component adds its
own error handling by copying an existing one.

## The fix

Add `nuxt-app/app/composables/useApiError.ts` exporting `extractErrorMessage`
exactly as it exists today (same signature, same body - a pure refactor, no
behavior change):

```ts
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}
```

Delete the local `function extractErrorMessage(...)` definition from each of
the 12 files above. No call site changes - Nuxt auto-imports composables from
`app/composables/` (the same reason `useCardDownloads()` and `useAmbientGlass()`
are already called with no explicit import elsewhere in this codebase), so
every existing `extractErrorMessage(err, "...")` call keeps working unchanged
once the local definition is removed.

Must not break: every existing error message shown across `/cards`,
`/cards/new`, `/decks`, `/settings`, `/stats`, `CardPreviewModal`,
`DeckAddAnimeModal`, and the three Settings sub-controls - behavior is
identical before and after, this only removes duplication.

## Build steps

- [x] **Step 1 - extract to `useApiError.ts` and remove the 12 duplicates** -
  create the composable, then delete the local `extractErrorMessage`
  function from each of the 12 files listed above (leaving their own
  call sites untouched). *Done when:* `grep -rn "^function extractErrorMessage"
  nuxt-app/app` returns nothing, `grep -rln "extractErrorMessage(" nuxt-app/app`
  still lists the same 12+1 files as call sites, `bun run build` passes with
  no type errors, and manually triggering one error path in the running app
  (e.g. Settings - remove a folder while offline, or any existing error
  case) still shows its message exactly as before.

## Verify

- Run `bun run build` (typecheck + build) - must pass clean.
- `grep -rn "function extractErrorMessage" nuxt-app/app` returns exactly one
  match, in `useApiError.ts`.
- Spot-check 2-3 pages in the browser (e.g. `/settings`, `/cards`) that an
  error state still renders its message correctly - no runtime
  "extractErrorMessage is not defined" or similar.

## Findings

### extract-api-error-composable/F-06 [P3] closed - Stray untracked duplicate files (` 2` suffix) keep recurring after merges

**File:** (recurs with new filenames each time - most recently blueprint/history/features/18-per-scope-quiz-mode-preference 2.md, nuxt-app/server/api/study/scope-setting.get 2.ts, nuxt-app/server/api/study/scope-setting.patch 2.ts, nuxt-app/server/db/migrations/0007_handy_green_goblin 2.sql, nuxt-app/server/db/migrations/meta/0007_snapshot 2.json, nuxt-app/server/utils/studyScopeSettings 2.ts)
**Found:** 2026-08-29 by /audit (scope: full; lens: quality)
**Why it matters:** An earlier batch of 10 was deleted during feature 18's Step 1 after one blocked `bun run db:generate`. A fresh batch of 6 appeared by the time feature 19a's `/implement` started - same shape every time: untracked, byte-identical duplicates of files just touched by the previous feature's merge. Deleting them is a recurring tax, not a one-time cleanup, and the actual source (some local tool/process, not this session's own workflow) is still unidentified.
**Suggested fix:** Same as before (delete on sight, harmless to do so) - but this time actually track down what's generating them, since deleting the symptom each session hasn't stopped it from recurring. Worth checking editor/IDE auto-save, a file-watcher, or a sync tool with a "keep both copies" conflict-resolution habit.
**Resolution:** Re-deleted the latest batch of 6 (2026-08-29, during feature 19a's `/implement` Step 1) on the strength of the same-session precedent already approved for the identical situation in feature 18. Reopened rather than left `fixed`, since the underlying cause is still unaddressed and it will keep coming back. Recurred again (2026-08-29, during feature 30's `/implement` Step 1) - a fresh pair (`29-stats-refresh-and-clear 2.md`, `clear.post 2.ts`), byte-identical duplicates of the two files feature 29's merge had just touched. Deleted on sight, same precedent. Root cause found the same session: `nuxt-app/.data/` (gitignored, holds the live SQLite dev database) contained **30 numbered duplicate database files** (`gaq-srs 2.db` through `gaq-srs 30.db`/`-shm`/`-wal`), matching iCloud Drive's "keep both copies" conflict-resolution signature - the project lived under `~/Documents`, which iCloud Drive syncs by default on macOS, and SQLite's WAL mode's frequent small writes to `.db`/`.db-shm`/`.db-wal` triggered its conflict heuristics. Closed 2026-09-01 per user confirmation: the project has since moved to `/Users/lu/Developer/GAQ_SRS`, outside `~/Documents`/iCloud Drive sync entirely (independently verified this session - the working directory is no longer under `$HOME/Documents`). Root cause is gone; no code fix was ever needed.
