# Feature: User-data-directory storage relocation

**From build-plan:** feature 48a
**Status:** verified

## Goal

Make the SQLite database's on-disk location configurable via an optional
environment variable, instead of hardcoded to a path relative to the
process's working directory. This decouples "where the app's data lives"
from "how the app is launched," so the packaged-launcher sub-feature (48b)
can later point the database at an OS-appropriate user-data directory
without touching the database or query code at all. The developer workflow
(`bun run dev` / `bun run preview`) is unaffected by default - the env var
is optional and falls back to exactly today's behavior.

## In scope

- An optional `GAQ_SRS_DATA_DIR` environment variable that, when set,
  overrides the base directory the SQLite DB file lives in.
- `MediaLibrarySettings` (library paths, default download folder, stream
  cache size) lives inside that same DB as a row, so it relocates
  automatically with it - no separate change needed there.
- The existing "create the directory if missing" behavior, generalized to
  whichever base directory is in effect.

## Out of scope

- Computing the actual OS-appropriate directory (Windows/macOS/Linux
  conventions) - that belongs to 48b, which will be the first real caller
  of `GAQ_SRS_DATA_DIR`.
- The launcher entrypoint and `bun build --compile` mechanism - 48b.
- Any Settings-page UI - this is invisible infrastructure with no user-facing
  surface.
- Migrating an existing dev database to a new location - not needed; the
  dev workflow keeps today's path unless the env var is explicitly set.
- `server/plugins/db.ts`'s `migrationsFolder: "server/db/migrations"` is a
  separate relative-path resolution that a compiled binary running from a
  different working directory will need to solve - deferred to 48b, which
  is where that risk actually gets exercised.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Env-aware DB path, with a test** - extract the DB path
  resolution into a small pure function `resolveDbPath(env, cwd)` in a new
  `server/db/dataDir.ts` (returns `resolve(env.GAQ_SRS_DATA_DIR, "gaq-srs.db")`
  when the env var is set, else today's `resolve(cwd, ".data/gaq-srs.db")`
  unchanged), and call it from `server/db/client.ts` in place of the
  current inline `DB_PATH` computation. Keep the existing
  `existsSync`/`mkdirSync` directory-creation logic, now operating on
  `dirname()` of whichever path comes back. Add `server/db/dataDir.test.ts`
  covering both branches (env var set -> path inside it; unset -> today's
  project-relative path).
  *Done when:* `bun run test` passes including the new test; with
  `GAQ_SRS_DATA_DIR` unset, `bun run dev` behaves exactly as today (DB at
  `nuxt-app/.data/gaq-srs.db`, existing data untouched); with
  `GAQ_SRS_DATA_DIR` set to a scratch directory, `bun run dev` creates and
  uses `gaq-srs.db` inside that directory instead, migrations run
  automatically, and the app is fully functional against it (create a
  card, confirm it's queryable).

## Files / areas

- `nuxt-app/server/db/dataDir.ts` (new) - pure path-resolution function
- `nuxt-app/server/db/dataDir.test.ts` (new)
- `nuxt-app/server/db/client.ts` - swaps its inline `DB_PATH` computation
  for a call to `resolveDbPath()`

## Data / contracts

No schema or API change. One new optional environment variable:

- `GAQ_SRS_DATA_DIR` (absolute path to a directory) - **load-bearing**:
  48b's launcher will be the first real caller, setting it to an
  OS-appropriate user-data directory before starting the server.

## Testing

Vitest is configured (`bun run test` per `AGENTS.md`), and this step adds
genuine logic (an env-var-driven path resolver with a clear right/wrong
answer), so it gets a unit test in the same diff per the coding-standards
testing gate - not a component or integration surface, so no browser test
needed for the resolver itself.

- `dataDir.test.ts`: env var unset -> today's project-relative path; env
  var set -> path inside it.
- Manual check (per the step's done-when): `bun run dev` with and without
  `GAQ_SRS_DATA_DIR` set, confirming the DB actually lands in the expected
  location both times and the app stays functional.

## Notes for the AI

- Keep this minimal - a path-resolution change, not a rewrite of
  `client.ts`.
- Don't touch `server/plugins/db.ts`'s `migrationsFolder` - that's a
  separate, deliberately deferred concern (see Out of scope).
- Don't add Settings-page UI or document the env var in `AGENTS.md`'s
  Commands section yet - it has no real caller until 48b.
- No new error handling around a missing/unwritable `GAQ_SRS_DATA_DIR` -
  matches today's existing behavior (an unwritable `.data/` dir already
  crashes on boot unhandled); relocating where that could happen doesn't
  introduce a new failure surface.

## Build notes

Built via `/implement` on `feature/48a-user-data-dir-storage-relocation`,
one step, checkpoint-committed as `ad58a8f`. Verified with `bun run test`
(7/7) and `bun run build` (clean), plus a live manual check: started
`bun run dev` with `GAQ_SRS_DATA_DIR` pointed at a scratch directory and
confirmed the DB/WAL/SHM files landed there instead of `.data/`, that a
write through `POST /api/media-library/folders` persisted and read back
correctly against that relocated DB, and that the original
`.data/gaq-srs.db`'s mtime was untouched when the env var was unset.

This feature is scaffolding for 48b (packaged launcher), not a
user-visible change on its own - `GAQ_SRS_DATA_DIR` has no real caller yet
outside manual testing.
