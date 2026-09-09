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
**Resolution:**
