# Fix: Windows packaged binary fails to start (migrations not found)

**Type:** Fix
**Status:** verified

## The problem

The standalone Windows executable (build item 48c) flashed a console window
and exited instead of starting the server. The real error, captured by
running it from an open PowerShell window instead of double-clicking it:

```
error: Can't find meta/_journal.json file
    at readMigrationFiles (B:\~BUN\root\gaq-srs.exe:5548:11)
    at migrate (...)
    at runNitroPlugins (...)
```

Root cause was in `nuxt-app/launcher/index.ts`. The launcher needs to tell
whether it's running as a compiled `bun build --compile` binary (in which case
disk lookups like the migrations folder must resolve relative to
`process.execPath`, the real on-disk exe location) or as a plain script (where
`import.meta.url` already resolves correctly). It made that call by checking
whether `scriptDir` starts with `/$bunfs`, the prefix Bun uses for its virtual
embedded-bundle filesystem on macOS/Linux.

Bun uses a different prefix on Windows - a virtual drive, `<drive>:\~BUN\...`
(confirmed directly from the stack trace above: `B:\~BUN\root\gaq-srs.exe`).
The existing check never matched that, so on Windows `isCompiled` evaluated to
`false`, `realDir` stayed as the fake virtual path, and every subsequent disk
lookup (starting with the migrations folder) pointed at a path that didn't
exist - hence "Can't find meta/_journal.json file".

macOS and Linux binaries were unaffected; only Windows hit this.

## The fix

Broadened the compiled-binary detection in `nuxt-app/launcher/index.ts` to
also match Bun's Windows virtual-bundle marker, without hardcoding a drive
letter (not guaranteed to always be `B:`):

```ts
const isCompiled = scriptDir.startsWith("/$bunfs") || /~BUN[\\/]/i.test(scriptDir);
```

Left the macOS/Linux path unaffected (still matched via the original
`/$bunfs` check) and the uncompiled dev/preview path unaffected (`isCompiled`
stays `false`, `realDir` stays `scriptDir`).

## Build steps

- [x] Update the `isCompiled` check in `nuxt-app/launcher/index.ts` to match
  both Bun virtual-bundle prefixes.
  **Done when:** `bun run build && bun run package` succeeds for all four
  targets, and running the rebuilt `release/macos-arm64/gaq-srs` against a
  clean `GAQ_SRS_DATA_DIR` starts the server and answers `HTTP 200` (real
  migrations applied, not a stale/cached DB).

## Verify

- Automated: `bun run build && bun run package` - all 4 targets succeeded.
- Manual (macOS): ran the rebuilt `release/macos-arm64/gaq-srs` against a
  fresh `GAQ_SRS_DATA_DIR`, got `HTTP 200` from `localhost:3000` with real
  migrations applied and no errors in the log.
- Manual (Windows): not yet re-verified on a real Windows machine as of this
  merge - the user hit the exact error this fixes on the pre-fix build, but
  hasn't retested the rebuilt binary. Flagged as a follow-up in the completion
  packet.
