# Feature: Full OS/arch build matrix

**From build-plan:** feature 48c
**Status:** verified

## Goal

Turn 48b's proven single-platform compile (a hand-run, manually-patched
`bun build --compile`) into a repeatable, scripted release process that
produces a working standalone executable for every target platform: Windows
x64, macOS x64, macOS arm64, and Linux x64. One command builds all four from
this single dev machine - Bun cross-compiles without needing per-OS build
runners.

## In scope

- A packaging script (`nuxt-app/scripts/package.ts`) that:
  1. Once, before the target loop: restores `.output/server/node_modules/@vue`
     and `.../node_modules/vue` from the real `node_modules/@vue` and
     `node_modules/vue` (overwriting Nitro's Node-targeted pruning, which
     drops files Bun's `--compile` bundler needs - the load-bearing fix
     documented in 48b's archive, confirmed still correct and sufficient
     in this session's own cross-compile testing). `.output/server` isn't
     target-specific, so this fix applies once, not per target.
  2. For each of the four targets: removes any existing
     `nuxt-app/release/<target-label>/` before building, so a stale binary
     or a migrations folder that shrank since the last run can't linger
     alongside fresh output; runs `bun build --compile
     --target=<bun-target> --outfile=<path>` against `launcher/index.ts`;
     copies `server/db/migrations` alongside the produced binary as a
     sibling `migrations/` folder - exactly what the launcher's own
     fallback path (`join(realDir, "migrations")`) already expects when
     it detects it's running from a compiled binary.
  3. Reports per-target success/failure; exits non-zero (and does not
     silently report overall success) if any target's compile fails.
- The four targets, matching the build-plan's exact scope (Windows, macOS
  x64/arm64, Linux - no arch split called out for Linux, so x64 only):

  | Target label | Bun `--target` value | Output binary |
  |---|---|---|
  | `windows-x64` | `bun-windows-x64` | `gaq-srs.exe` |
  | `macos-x64` | `bun-darwin-x64` | `gaq-srs` |
  | `macos-arm64` | `bun-darwin-arm64` | `gaq-srs` |
  | `linux-x64` | `bun-linux-x64` | `gaq-srs` |

  Each lands at `nuxt-app/release/<target-label>/`.
- A precondition check: if `.output/server/index.mjs` doesn't exist, the
  script fails fast with a one-line "run `bun run build` first" message -
  same pattern the launcher already uses, not a silent auto-build.
- `"package": "bun run scripts/package.ts"` added to `package.json`.
- `nuxt-app/release/` added to `.gitignore` (compiled binaries are tens of
  MB each and platform-specific; they don't belong in git).
- AGENTS.md's Commands section documents the two-step release flow: `bun
  run build` then `bun run package`, where the artifacts land, and that a
  binary must ship together with its sibling `migrations/` folder (matching
  how `launch` is already documented there for the single-machine case).

## Out of scope

- Code-signing / notarization (macOS Gatekeeper, Windows SmartScreen) -
  already explicitly deferred by the build-plan entry itself. Unsigned
  binaries will show an OS security warning on first run; that warning is
  expected, not a bug.
- Windows executable metadata (`--windows-icon`, `--windows-hide-console`,
  version info) and any other cosmetic `--compile` flags - none of this
  can be verified from a macOS dev machine, and it's polish, not the
  packaging mechanism itself.
- GitHub Actions or any other CI automation of the release build - the
  build-plan item asks for "a build script and documented release
  process," not automatic checks; `/ci` remains the separate, explicit
  path for that if wanted later.
- `-baseline` (pre-AVX2) or `-musl` build variants - the standard glibc/AVX2
  target per platform is the scope; these are edge-case runtime variants
  nothing in the plan calls for.
- A GUI installer, DMG/MSI packaging, or auto-update mechanism.
- Verifying the Windows/Linux/macOS-x64 binaries by actually *running*
  them - this dev machine is macOS arm64, so only that target gets a full
  end-to-end run. The other three are verified by compile success plus
  confirming the produced file is a valid executable for its target
  platform (`file` reports the expected format: PE32+ for Windows, Mach-O
  for macOS x64, ELF for Linux x64) - see Testing.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Packaging script for all four targets** -
  `nuxt-app/scripts/package.ts`: the target table above, the `@vue`/`vue`
  restore (once, before the target loop), the per-target `bun build
  --compile` invocation and sibling `migrations/` copy, the
  `.output/server/index.mjs` precondition check, and a clear pass/fail
  summary line per target. Add the `package` script to `package.json`, add
  `release/` to `.gitignore`, and document the `build` -> `package` release
  flow (commands + artifact location + "ship the binary with its
  `migrations/` folder") under Commands in `AGENTS.md`.
  *Done when:* after `bun run build`, running `bun run package` produces
  `nuxt-app/release/<target-label>/` for all four targets, each containing
  the named binary plus a sibling `migrations/` folder, with no manual
  file-copying step outside the script; a target compile failure prints
  which target failed and makes the script exit non-zero rather than
  reporting overall success.

- [x] **Step 2 - Verify every produced binary, and regression-check the
  existing build** - for the native target (`macos-arm64`), copy its
  `release/macos-arm64/` output to a scratch directory outside the repo and
  run it directly, confirming (as 48b's own proof did): the DB is created
  at the real OS-appropriate user-data directory, migrations run, the
  server responds, and the default browser opens. For the other three
  targets, run `file` on the produced binary and confirm it reports the
  correct target format (PE32+ for `windows-x64`, Mach-O x86_64 for
  `macos-x64`, ELF x86-64 for `linux-x64`). Finish with `bun run build`
  (this branch has no test command configured - see Testing) to confirm
  the new script doesn't regress the app build.

  **Discovered mid-step, not foreseen by the spec:** the first standalone
  run surfaced a real bug in every compiled binary, including the
  `macos-arm64` target 48b itself already "proved" - the page's root HTML
  loaded (curl on `/` returned 200, which is all 48b's own proof checked),
  but every static asset (`_nuxt/*.js`, `_nuxt/*.css`, `favicon.ico`)
  404'd, because Nitro resolves its public-asset directory at request time
  from `globalThis._importMeta_.url` (set to the entry module's own real
  `import.meta.url` on import) - which `bun build --compile` collapses to
  Bun's virtual bundle root (`/$bunfs/root/<binary>`) instead of a real
  disk path. Root-caused by reading Nitro's generated
  `.output/server/index.mjs`/`chunks/nitro/nitro.mjs`, confirmed absent in
  the uncompiled `bun run launch` path (assets serve fine there - real
  `import.meta.url` resolves correctly for a real dynamic `import()`).
  Fixed in `launcher/index.ts`: after importing the server (which has
  already set the wrong compiled-bundle URL by then), overwrite
  `globalThis._importMeta_` with a fake path under the binary's own real
  directory (`<realDir>/server/index.mjs`, mirroring the dev tree's own
  `.output/server/index.mjs` next to `.output/public/`) - only when
  compiled, since the uncompiled path already resolves this correctly on
  its own and doesn't have a `public/` folder shipped next to it anyway.
  `scripts/package.ts` now also copies `.output/public` to a sibling
  `release/<target>/public/` folder, same pattern as `migrations/`.
  Re-verified end to end after the fix: static assets and data-backed
  routes (`/cards`, `/decks`, `/api/cards`) all returned 200 from the
  standalone binary, and the real user-data-directory DB file's mtime
  updated during the run, confirming the SQLite driver and migrations
  still work from the compiled binary too.

  *Done when:* the macOS arm64 binary is proven working end-to-end from a
  standalone scratch directory, **including static assets and data-backed
  routes actually loading, not just the root document** - met, after the
  fix above; the other three binaries pass their format check - met;
  `bun run build` still passes - met.

## Files / areas

- `nuxt-app/scripts/package.ts` (new)
- `nuxt-app/package.json` - new `package` script
- `nuxt-app/.gitignore` - `.output` already lives here (not the root
  `.gitignore`), so `release` joins it in the same "Nuxt dev/build
  outputs" block
- `AGENTS.md` - documents the release flow under Commands
- `nuxt-app/launcher/index.ts` - **not originally planned** (see Step 2's
  "Discovered mid-step"): overwrites `globalThis._importMeta_` after
  importing the server, only when compiled, so Nitro's public-asset
  resolution survives being bundled into a single-file executable

## Data / contracts

No schema or API change. No new environment variables - the script builds
directly against 48a/48b's existing `GAQ_SRS_DATA_DIR`/
`GAQ_SRS_MIGRATIONS_DIR` mechanism and the launcher's existing
compiled-binary detection; nothing about that contract changes here.

**Load-bearing for anything later that automates this (e.g. a future
`/ci` release workflow):** the four target labels and their Bun
`--target` strings, and the fixed `release/<target-label>/{binary,
migrations/}` output layout - a later CI script should read this
structure rather than reinvent it.

## Testing

No test runner covers this class of behavior (a build/packaging script,
not pure logic with a right/wrong answer) - same category as 48b's Steps
4-5. Verified via direct evidence per the done-whens above: the script's
own pass/fail output across all four targets, `file` format checks for
the three non-native binaries, a full standalone run for the native one
(including static assets and data-backed API routes, not just the root
document - see Step 2), and a `bun run build` regression pass.

**Note:** this branch has no `test` command configured in `AGENTS.md` -
that setup exists only as pre-existing, uncommitted work-in-progress on
`master` (Vitest config + one test file), unrelated to this feature, which
was stashed before branching so it wouldn't bleed into this diff. It's
still on the stash list, untouched, for whoever continues that separately.

## Notes for the AI

- The `@vue`/`vue` restore is the one non-obvious, already-diagnosed fix
  (see 48b's archive, "Step 5" and "Load-bearing for 48c" sections) -
  don't rediscover it from scratch or reach for `--external` instead,
  which was already tried and ruled out in 48b (compiles but can't
  resolve against a compiled binary's virtual filesystem).
- Cross-compilation itself needs no special handling beyond `--target`:
  this session confirmed directly (via `bun build --compile
  --target=bun-linux-x64` and `--target=bun-windows-x64` from this macOS
  arm64 machine) that Bun downloads the target's toolchain on first use
  and produces a correctly-formatted binary (`.exe` is appended
  automatically for Windows targets) - no Windows or Linux machine is
  needed to build those binaries.
- Keep the script minimal and orchestration-only: no retry logic, no
  parallel compiles, no progress bars - a plain sequential loop with clear
  per-target output is enough, consistent with how the launcher itself
  (48b) stayed deliberately minimal.
- Don't touch `launcher/index.ts`, `userDataDir.ts`, or the DB driver -
  48b already proved and locked that mechanism; this feature only
  packages it for every target.

## Build notes

Built via `/implement` on `feature/48c-full-os-arch-build-matrix` in one
session (2026-09-02), one checkpoint commit: `f54d248` (both steps
together).

Step 1 went as planned: the packaging script, cross-compile mechanism, and
`@vue`/`vue` restore fix all worked on the first real run for all four
targets, confirmed via `file` format checks and clean sibling
`migrations/` folders. Live-tested both failure paths (missing `.output`,
a bad target string) before trusting the done-when.

Step 2 surfaced the real story of this feature: 48b's own "proven"
single-platform binary turned out to only have been proven at the level of
"the root document loads," never checked for whether its actual page
(JS/CSS/data) worked. The very first standalone run of the packaged
`macos-arm64` binary showed every static asset 404ing. Root-caused by
reading Nitro's generated output directly (`globalThis._importMeta_.url`,
set from the entry module's real `import.meta.url`, collapses to Bun's
virtual bundle root once compiled) rather than guessing; ruled out the
Nitro `bun` preset as a fix first (it shares the same asset-resolution
code path as `node-server`, just swaps the HTTP listener). Fixed by
overwriting `globalThis._importMeta_` in the launcher immediately after
the server import completes (the asset handler reads it fresh per-request,
not at import time, so a post-import overwrite is enough) and shipping
`.output/public` as a new sibling `public/` folder next to the binary,
matching the migrations folder's existing pattern. Re-verified end to end
including data-backed API routes, not just static assets, before trusting
it fixed.

One process-management mishap along the way: an earlier manual test binary
was left running on a port reused by a later verification run, causing a
confusing `EADDRINUSE`/stale-response false read. Diagnosed via `lsof`,
killed, confirmed no lasting effect, and re-ran clean.

Verified via `bun run package` (all four targets, twice - once pre-fix to
confirm the bug, once post-fix to confirm the repair), `file` format
checks, a full standalone run of the native binary (static assets +
data-backed routes, DB file mtime), and `bun run build` (clean) at every
checkpoint. `bun run test` was not run - this branch has no test command
configured (see Testing).

## Findings

No findings were opened, resolved, or archived against this feature.
