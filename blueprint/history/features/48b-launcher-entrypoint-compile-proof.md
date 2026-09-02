# Feature: Launcher entrypoint + single-platform compile proof

**From build-plan:** feature 48b
**Status:** verified

## Goal

Prove that GAQ SRS can run as a double-clickable executable - no terminal,
no Bun/Node/Nuxt install - for one platform (the current dev machine's
OS/arch) before multiplying the mechanism across the full build matrix in
48c. A new launcher computes a real OS-appropriate user-data directory,
wires it into 48a's `GAQ_SRS_DATA_DIR`, starts the already-built Nitro
server in-process, and opens the user's default browser once it's
reachable. `bun build --compile` then proves the whole chain - including
`better-sqlite3`'s native addon and the migrations folder - survives
becoming a standalone binary.

**Scope clarification on "self-contained":** `better-sqlite3` is a native
addon, and Nitro's own build already keeps it external (`.output/server/`
ships its own `node_modules/better-sqlite3` rather than bundling it into
`index.mjs`). If `bun build --compile` can't cleanly embed it, the fallback
proven in Step 5 is a compiled binary shipped alongside a small sibling
`node_modules/better-sqlite3` folder (mirroring how the migrations folder
already ships as a sibling directory) - still no separate Bun/Node/Nuxt
install or terminal commands for the end user, just not literally one
file. This is a real possibility, not a step failure, and is written into
Step 5's done-when. (Superseded in practice by the runtime-conditional
driver below - `bun:sqlite` has no native addon to bundle at all when
running under Bun, so this fallback likely won't be needed, but stays
documented in case Step 5 uncovers a different bundling issue.)

**Discovered mid-build (Steps 1-2 were done and verified before this came
up):** `better-sqlite3` crashes Bun's own runtime with a native NAPI panic
- confirmed via an isolated repro, not fixed by upgrading Bun (1.1.8 ->
1.4.0, different panic, same root cause), and confirmed via upstream
`oven-sh/bun` issues (#24956, #16050, #19328, #23757, #23243) as a known,
still-open compatibility gap, not a version-specific bug. This blocks the
launcher's in-process server import (Step 4) and the compile proof (Step
5) outright, since a `bun build --compile` binary runs on Bun's own
engine. Investigation also found that `bun run dev` and `bun run preview`
already run the actual server under a real spawned `node` child process
(confirmed via process tree / Nitro's own preview log), never Bun's
engine - which is why this was never hit before. That means the fix must
be **runtime-conditional** (`better-sqlite3` under Node, `bun:sqlite`
under Bun), added here as a new Step 3, not a blanket driver swap - a
blanket swap would break the currently-working `dev`/`preview` paths,
since `bun:sqlite` doesn't resolve under Node at all.

## In scope

- `resolveUserDataDir(platform, env, homeDir)` - a pure resolver for the
  OS-appropriate user-data directory (Windows/macOS/Linux conventions).
- Making `server/plugins/db.ts`'s hardcoded `migrationsFolder` path
  environment-aware via a new optional `GAQ_SRS_MIGRATIONS_DIR`, mirroring
  48a's `GAQ_SRS_DATA_DIR` pattern exactly - defaults to today's behavior
  when unset.
- A runtime-conditional SQLite driver in `server/db/client.ts`: keeps
  `better-sqlite3` under Node (today's `dev`/`preview`, untouched), uses
  `bun:sqlite` only when actually running under Bun's own engine (the new
  launcher). See "Discovered mid-build" above.
- A new launcher entrypoint (`nuxt-app/launcher/index.ts`) that: computes
  and sets `GAQ_SRS_DATA_DIR` and `GAQ_SRS_MIGRATIONS_DIR` from real
  `process.platform`/`os.homedir()` values, sets `PORT`, imports the built
  Nitro server (`.output/server/index.mjs`) in-process, polls until it's
  reachable, then opens the user's default browser to it via a small
  per-OS shell-out (`open` / `start` / `xdg-open`).
- Compiling that launcher via `bun build --compile` for the current dev
  machine's OS/arch only, and running the resulting standalone binary from
  a directory outside the repo to prove it doesn't depend on the project's
  working directory.

## Out of scope

- The full Windows/macOS-arm64/macOS-x64/Linux build matrix, and a
  reusable/documented packaging script for it - 48c.
- Code-signing/notarization - already deferred to 48c.
- Any change to `bun run dev` / `bun run preview` - the launcher is a
  wholly separate, new entrypoint; the existing developer workflow is
  untouched.
- Port-conflict handling (the launcher uses a fixed default port, same as
  `bun run preview` does today) - not core to proving the mechanism.
- A first-run onboarding UI (e.g., a native prompt for a media library
  folder before the browser opens) - the app's existing `/settings` page
  already handles that once the browser opens.
- Auto-restart or crash recovery for the in-process server - out of scope
  for a proof step.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - OS-appropriate user-data directory resolver, with a
  test** - `nuxt-app/launcher/userDataDir.ts` exporting
  `resolveUserDataDir(platform: NodeJS.Platform, env: NodeJS.ProcessEnv,
  homeDir: string): string`: Windows (`win32`) -> `<env.APPDATA ||
  homeDir/AppData/Roaming>/gaq-srs`; macOS (`darwin`) -> `<homeDir>/Library/
  Application Support/gaq-srs`; everything else (Linux) ->
  `<env.XDG_DATA_HOME || homeDir/.local/share>/gaq-srs`. Add
  `userDataDir.test.ts` covering all three platform branches plus both
  env-var-unset fallbacks (`APPDATA` unset on Windows, `XDG_DATA_HOME`
  unset on Linux).
  *Done when:* `bun run test` passes including the new tests.

- [x] **Step 2 - Env-aware migrations folder, mirroring 48a** - extract a
  `resolveMigrationsFolder(env: { GAQ_SRS_MIGRATIONS_DIR?: string })`
  pure function into `server/db/dataDir.ts` (alongside `resolveDbPath`):
  returns `env.GAQ_SRS_MIGRATIONS_DIR` when set, else today's
  `"server/db/migrations"` unchanged. `server/plugins/db.ts` calls it for
  `migrationsFolder`. Add matching cases to `dataDir.test.ts`.
  *Done when:* `bun run test` passes; with the env var unset, `bun run dev`
  behaves exactly as today; with `GAQ_SRS_MIGRATIONS_DIR` pointed at a
  copy of the migrations folder placed elsewhere (and `GAQ_SRS_DATA_DIR`
  set to a fresh scratch dir, from 48a), `bun run dev` still migrates and
  boots correctly against that copy.

- [x] **Step 3 - Runtime-conditional SQLite driver** - `server/db/client.ts`:
  restructure `db` construction into an async `createDb()` that branches
  on `process.versions.bun` (truthy only under Bun's own engine). Under
  Node, dynamically import `better-sqlite3` + `drizzle-orm/better-sqlite3`
  + `drizzle-orm/better-sqlite3/migrator` exactly as today (same pragmas).
  Under Bun, dynamically import `bun:sqlite` + `drizzle-orm/bun-sqlite` +
  `drizzle-orm/bun-sqlite/migrator` instead (pragmas via `sqlite.exec(...)`,
  `bun:sqlite`'s equivalent of `better-sqlite3`'s `.pragma()`). Each
  branch closes over its own correctly-typed instance and returns both
  `db` and a matching `runMigrations(migrationsFolder)` function, so
  `server/plugins/db.ts` never needs to pick a migrator itself or fight a
  union type - it just calls `runMigrations(resolveMigrationsFolder(process.env))`.
  *Done when:* `bun run test` still passes (regression); `bun run build`
  succeeds (verifies Nitro's bundler tolerates the `bun:sqlite` specifier
  - the previously-unverified unknown); `bun run dev` and `bun run
  preview` both still work exactly as before (create/read a card through
  each); a minimal Bun-native smoke test (a throwaway script run via `bun
  run`, deleted once proven) confirms `bun:sqlite` actually opens a real
  database and runs a migration without the NAPI panic.

- [x] **Step 4 - Launcher entrypoint (uncompiled)** - `nuxt-app/launcher/index.ts`:
  sets `GAQ_SRS_DATA_DIR` (via Step 1's resolver + real `process.platform`/
  `os.homedir()`), sets `GAQ_SRS_MIGRATIONS_DIR` (resolved relative to the
  launcher's own location), sets `PORT` if unset, dynamically imports the
  built `.output/server/index.mjs` (a literal relative path, so Bun's
  bundler can trace and embed it later in Step 5), polls
  `http://localhost:<port>/` on a short retry loop until it responds (or
  fails clearly after a generous timeout), then opens the default browser
  via a small per-OS shell-out. Add a `"launch": "bun run launcher/index.ts"`
  script to `package.json` and document it under Commands in `AGENTS.md`.
  *Done when:* after `bun run build`, running `bun run launch` starts the
  server (confirmed reachable via `curl`), creates the DB at the real
  OS-appropriate user-data directory (not `.data/`), and opens the
  system's default browser to the running app.

- [x] **Step 5 - Compile and prove it standalone** - `bun build --compile`
  the launcher for the current OS/arch into a single binary, then run the
  resulting executable directly from a scratch directory outside the repo.

  **Resolved 2026-09-02, after being blocked on 2026-09-01.** Four
  attempts on 2026-09-01 all failed for variations of one root cause:
  `.output/server/node_modules` (Nitro's own Node-targeted dependency
  pruning) is missing files Bun's bundler needs - `@vue/shared`'s (and
  siblings') conditional `exports` map resolves to `./index.js` under
  Bun's bundler but to `./dist/shared.cjs.prod.js` under Node/Nitro's own
  resolution, and only the latter survived pruning. The fix, found on
  2026-09-02: `./index.js` **is** a real, legitimate part of the published
  package (confirmed against `nuxt-app/node_modules/@vue/shared/index.js`,
  a tiny CJS re-export wrapper) - Nitro's pruning just decided it wasn't
  needed for Node's own resolution path and dropped it. A real `bun
  install` *inside* `.output/server/` (attempt 2, 2026-09-01) didn't fix
  this because it preserved the existing pruned structure rather than
  doing a genuine clean reinstall. The actual fix: replace
  `.output/server/node_modules/@vue` and `.../node_modules/vue` with the
  full, richly-installed copies from `nuxt-app/node_modules` before
  compiling - not a package patch, just restoring files Nitro pruned.
  With that in place, the **default** `bun build --compile` (no
  `--external` needed) bundled all 338 modules successfully.

  Compiling then surfaced one more real bug (not a Bun limitation): the
  launcher's own `existsSync()`-based guards used `dirname(fileURLToPath(import.meta.url))`,
  which resolves to Bun's virtual bundle filesystem ("/$bunfs/...") inside
  a compiled binary, not a real disk path - and that virtual root itself
  reports as existing via `fs.existsSync` (Bun's own fs shim for embedded
  assets), so a naive `existsSync(scriptDir)` check to detect "am I
  compiled" silently picked the wrong (virtual) directory. Fixed by
  checking the `/$bunfs` prefix directly and falling back to
  `dirname(process.execPath)` (the executable's real on-disk location)
  for anything that needs a genuine sibling path on disk - the migrations
  folder, specifically, since SQL files are read via `fs` at runtime, not
  imported, so `--compile` never embeds them. The server import itself
  needed no such handling - Bun's bundler resolves it from its own
  already-compiled module graph, not a runtime disk check.

  Confirmed end to end from `/tmp/gaq-standalone-test/` (compiled binary +
  a copied sibling `migrations/` folder, nothing else - no repo, no
  `.output`, no `node_modules` nearby): DB created at the real
  `~/Library/Application Support/gaq-srs/gaq-srs.db`, all migrations ran,
  server reachable via `curl`, real browser window opened. `bun:sqlite`
  bundled with zero native-addon dependencies, so the `better-sqlite3`
  sibling-folder fallback this step's done-when originally anticipated
  was never needed.

  **Load-bearing for 48c:** the full build matrix must restore
  `.output/server/node_modules/@vue` and `/vue` from the real install
  before every platform's compile - this was done by hand for 48b's
  single-platform proof and needs to become a real, scripted step there.

  *Done when:* the standalone binary creates the DB at the correct
  OS-appropriate user-data directory, migrations run automatically, the
  server is reachable, and the default browser opens to a working app -
  **met**, via `bun:sqlite` with no native-addon fallback needed.

## Files / areas

- `nuxt-app/launcher/userDataDir.ts` (new)
- `nuxt-app/launcher/userDataDir.test.ts` (new)
- `nuxt-app/launcher/index.ts` (new)
- `nuxt-app/server/db/dataDir.ts` - adds `resolveMigrationsFolder`
- `nuxt-app/server/db/dataDir.test.ts` - new cases for it
- `nuxt-app/server/db/client.ts` - runtime-conditional driver + exported
  `runMigrations()`
- `nuxt-app/server/plugins/db.ts` - calls `runMigrations(resolveMigrationsFolder(...))`
- `nuxt-app/package.json` - new `launch` script
- `AGENTS.md` - documents the `launch` command

## Data / contracts

No schema or API change. One new optional environment variable, pairing
with 48a's:

- `GAQ_SRS_MIGRATIONS_DIR` (absolute path to a directory) - **load-bearing**:
  the launcher is its first real caller.

**Load-bearing for 48c:** `resolveUserDataDir`'s exact per-OS directory
conventions (Windows/macOS/Linux paths) become the contract the full build
matrix packages against - don't change them casually once this ships.

## Testing

Vitest is configured (`bun run test` per `AGENTS.md`). Steps 1 and 2 add
genuine logic (pure, environment-driven resolvers with a clear right/wrong
answer), so both ship unit tests in the same diff per the coding-standards
testing gate.

Step 3 (the runtime-conditional driver) is verified by regression evidence
(existing test suite, `dev`/`preview` both manually re-checked) plus a
throwaway Bun-native smoke test proving `bun:sqlite` itself works - not a
permanent unit test, since there's no meaningful pure logic here beyond a
one-line runtime check.

Steps 4 and 5 are integration/proof steps (a real server process, a real
browser launch, a real compiled binary) - no test runner covers that
class of behavior in this project. Verified via `bun run build` plus
direct evidence: `curl`/`fetch` against the running server, inspecting
where the DB file actually landed, and running the compiled binary
standalone. This project has no Playwright installed, so - consistent
with how feature 47 verified its own non-UI integration behavior - the
actual browser window opening is confirmed by the shell-out command
executing successfully, not by driving a browser.

## Notes for the AI

- Step 4/5 verification will genuinely open a real browser window on the
  dev machine (the shell-out is the literal behavior being proved) - this
  is expected, not a bug in the verification approach.
- Step 3's `bun:sqlite` branch and `better-sqlite3` branch must each only
  be reachable through their own dynamic `import()` - never a static
  top-level import of `bun:sqlite`, which would break the file being
  loaded under Node at all (module-not-found).
- Use a non-default port during your own verification runs if anything
  else might already be listening on the usual one (e.g. a leftover `bun
  run dev`), to avoid a false-positive "reachable" result.
- Don't add port-conflict retry logic, crash recovery, or a first-run UI -
  see Out of scope. Keep the launcher minimal: env setup, start, poll,
  open browser.
- If `.output/server/index.mjs` doesn't exist when `bun run launch` is
  run, a clear one-line error ("run `bun run build` first") is enough -
  no need for elaborate guidance.
- Step 5's fallback (sibling `node_modules/better-sqlite3`) turned out
  unnecessary - `bun:sqlite` has no native addon, so it was never invoked.
- **Required before any `bun build --compile` of the launcher:** restore
  `.output/server/node_modules/@vue` and `.../node_modules/vue` from
  `nuxt-app/node_modules` (Nitro's own pruned copies are missing files
  Bun's bundler needs - see Step 5). Not yet a script; 48c's job.

## Build notes

Built via `/implement` on `feature/48b-launcher-compile-proof` across two
sessions (2026-09-01 and 2026-09-02), 4 commits: `bc7bedc` (Steps 1-3,
checkpointed together), `5cd1b03` (Step 4), `30b68d5` (documentation of
the Step 5 blocker before pausing the first session), `133cca3` (Step 5's
actual resolution and completion on resume).

Step 5 was the real story of this feature: a genuine, well-diagnosed Bun
compiler limitation (Nitro's Node-targeted dependency pruning drops files
Bun's `--compile` bundler needs from `@vue/shared` and siblings'
conditional exports maps) blocked the first session entirely after four
distinct attempts, each ruled out for a specific, verified reason
(exports-map mismatch, confirmed not a pruning artifact via a real `bun
install`, compiled binaries can't self-dispatch to run sibling files,
`--external` compiles but can't resolve against a compiled binary's
virtual filesystem even with a real sibling `node_modules` on disk). The
session paused there deliberately rather than guessing further, and the
next session's fix - restoring the pruned packages from the real install
before compiling - was found by directly comparing the pruned and
full installs rather than more trial and error. One contained mishap
along the way (day 1): a process-self-spawn test recursively forked
itself; killed immediately, confirmed fully cleaned up, no lasting effect.

Verified via `bun run test` (14/14) and `bun run build` (clean) after
every step, plus direct end-to-end evidence for the integration-heavy
steps: real dev-server/preview runs, a real compiled binary executed from
a directory completely outside the repo, and (multiple times, expected
per the spec's own notes) a real browser window opening on the dev
machine as literal proof of the launcher's own behavior.
