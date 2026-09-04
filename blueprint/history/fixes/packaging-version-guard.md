# Fix: Packaging can ship a mislabeled version

**Type:** Fix
**Status:** verified

## The problem

`bun run package` compiles release binaries with no check that the version they
carry is the version they will be published as. Two distinct ways that goes
wrong:

1. **Stale build.** `package.ts` compiles from `.output/`, produced by an
   earlier `bun run build`. It only checks that `.output/server/index.mjs`
   *exists* ([package.ts:32-35](nuxt-app/scripts/package.ts#L32-L35)), not that
   it is current. Bump `package.json` to `1.3.0`, forget to rebuild, run
   `package`, and every binary silently carries `1.2.0`.
2. **Tag mismatch.** Nothing relates `package.json`'s version to the git tag the
   release is published under. Tag a `1.2.0` build as `v1.3.0` and the labels
   diverge with nothing to catch it.

This became a real failure mode with feature 54, not just untidiness. The update
checker compares the running version against the latest release tag, so a binary
baked at `1.2.0` but published as `v1.3.0` shows **"Update available - v1.3.0"
to every user of that build, permanently** - they download the update they are
already running, and the notice never clears.

## The fix

A preflight in `scripts/package.ts`, before the target loop, that fails the whole
run rather than producing mislabeled binaries. Both checks name both values in
the error, since "they don't match" without the numbers is useless at 2am.

- **Baked version vs `package.json`:** search `.output/server/` for the
  `appVersion` string baked in by `nuxt build`. Different value means a stale
  build: fail, telling the user to re-run `bun run build`.
- **Git tag vs `package.json`:** if `HEAD` carries a tag, it must equal
  `v<version>`. Mismatch fails. **No tag at `HEAD` is not an error** - tagging
  usually happens after packaging, so failing there would break the normal
  release flow. Print the version being packaged instead.

Must not break: packaging outside a git repo, or with no tags at all, still
works. A failure to *determine* the baked version (bundle layout changed in a
future Nitro) degrades to a printed warning, not a hard stop - the same
degrade-gracefully rule the rest of the project follows.

## Build steps

- [x] **Step 1 - Pure decision function plus its test.** Add
  `scripts/versionGuard.ts` exporting `checkPackagedVersion({ packageVersion,
  bakedVersion, headTag })` returning `{ ok: boolean; message: string }`, with
  no filesystem or git access. Ship `scripts/versionGuard.test.ts` in the same
  diff (the logic-test gate is on as of the vitest setup).
  *Done when:* `bun run test` passes with cases covering match, stale build
  (`baked` differs), tag mismatch, no tag present (ok), `bakedVersion: null`
  (ok, but the message says it could not be verified), and a tag written without
  the `v` prefix.

- [x] **Step 2 - Wire it into packaging.** In `scripts/package.ts`, before the
  target loop, read `package.json`'s version, grep `.output/server/` for the
  baked `appVersion`, read `HEAD`'s tag via `git tag --points-at HEAD`
  (tolerating a non-repo or missing git), and pass all three to the guard.
  Print the message; `process.exit(1)` when not ok.
  *Done when:* `bun run package` prints the version and proceeds normally in the
  current matched state; temporarily bumping `package.json` without rebuilding
  makes it exit non-zero naming both versions, and no `release/` output is
  produced; restoring the version lets it proceed again.

## Verify

- `bun run test` green (the gate).
- `bun run build` clean.
- Step 2's done-when exercised by hand: the failing case must actually stop the
  run before any target compiles, not warn and continue.

## Notes for the AI

- Keep the guard pure in Step 1 so it is testable without a repo, a build, or
  network. All the awkward I/O lives in Step 2.
- Reuse the existing `Bun.spawnSync` pattern already in `package.ts` for the git
  call; do not add a dependency.
- `package.ts` already exits non-zero on a failed target
  ([package.ts:173-175](nuxt-app/scripts/package.ts#L173-L175)); match that
  style rather than throwing.
- Do not compare against the *latest* tag in the repo - only a tag on `HEAD`.
  The latest tag is often an older release and would produce false failures.
