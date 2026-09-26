# Feature: One-click update - download, verify, and stage

**From build-plan:** feature 82a (parent: 82, One-click update)
**Status:** verified

## Goal

A packaged build can fetch the newer release for its own platform, prove the
download is exactly what GitHub published, and unpack it into a staging folder,
ending at "Ready - restart to update". Nothing outside the user-data directory
changes. 82b then swaps the staged files in, so 82a's job is to hand it a staged
build it can trust without re-checking anything.

## In scope

- Carry each release asset's `digest` (`sha256:<hex>`) and `size` through the
  existing lookup in `server/utils/version.ts`.
- An install-directory contract: the launcher sets `GAQ_SRS_INSTALL_DIR` to the
  binary's real folder when compiled. The server treats self-update as available
  only when it is set, so dev and `bun run launch` never offer it. Setting it by
  hand to a scratch folder is how 82a is tested in dev.
- An availability check: packaged, update available, the asset exists and has a
  digest, and the install folder is writable (probed by creating and removing a
  temp file, since `fs.access` is unreliable for this on Windows).
- A server-side job, one at a time: stream the zip to
  `<dataDir>/updates/download.zip.partial` while hashing it, then compare the
  SHA-256 and the byte count with the asset's, unpack it into
  `<dataDir>/updates/staged/`, check its layout, set the binary's executable
  bit, and write `ready.json` last.
- Routes: `POST /api/update/download` (start, or no-op if already running or
  staged) and `GET /api/update/status` (polled by the page).
- Settings > About: a "Download update" button when available, a progress bar,
  "Verifying..." / "Unpacking...", then "Ready - restart to update". The restart
  button is shown disabled with "Restart comes in the next step", and the
  feature is not released until 82b ships. On failure, an error message plus
  "Try again". The manual download link and notes (the
  direct-download-update-notice fix) stay underneath in every state.

## Out of scope

- Swapping files, restarting, `.old` cleanup, and the page reload (82b).
- Automatic or background downloads. Nothing starts without a click.
- Resuming a partial download. A failed or interrupted one starts over.
- Delta updates, signatures beyond GitHub's digest, or rollback to older
  versions.
- Updating from dev (`bun run dev`/`preview`/`launch`) unless
  `GAQ_SRS_INSTALL_DIR` is set by hand for testing.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Digest, install dir, and availability** - extend
  `ReleaseAsset` with `digest` (lowercase hex or `null`, parsed from
  `sha256:<64 hex>` and nothing else) and `size`. The launcher sets
  `GAQ_SRS_INSTALL_DIR` when `isCompiled`. Add a pure
  `selfUpdateAvailability(input)` returning `{ available: true }` or
  `{ available: false, reason }` (`not-packaged`, `up-to-date`, `no-asset`,
  `no-digest`, `not-writable`, `check-failed`), plus the writability probe
  kept separate so the pure part stays testable. *Done when:* tests cover
  digest parsing (valid, uppercase, wrong algorithm, wrong length, missing) and
  every availability reason, and `bun run test` passes.
- [x] **Step 2 - Download and verify** - `server/utils/selfUpdate.ts` holds the
  job state and streams the asset to `download.zip.partial`, hashing as it
  goes. It uses an idle timeout (no bytes for 30s), not a whole-body one, since
  F-21 is that exact bug and these zips are 40-60MB. It refuses a URL whose
  host is not `github.com` before fetching (the URL only ever comes from the
  server's own cached lookup, never from the client), follows GitHub's
  redirect, and fails on a digest or size mismatch, deleting the partial
  file. Add the two routes. The job ends after verifying in this step,
  leaving the verified `download.zip` for step 3.
  *Done when:* with `GAQ_SRS_INSTALL_DIR` pointed at a scratch folder and the
  dev server reporting an older version, `POST /api/update/download` and then
  polling `GET /api/update/status` show `downloading` with growing byte counts,
  then `verifying` with no error and a `download.zip` whose SHA-256 matches
  the asset's `digest`; a test with a forced wrong digest ends at `failed` with the
  partial file gone. A pure `digestMatches` / progress helper has tests.
- [x] **Step 3 - Unpack and stage** - add `fflate` and unpack into a fresh
  `updates/staged/`, removing any older staging first. A pure
  `safeEntryPath(root, entryName)` rejects absolute paths, drive letters,
  and `..` segments (zip-slip). A pure `checkStagedLayout(fileList, platform)`
  requires the platform's binary (`gaq-srs` or `gaq-srs.exe`),
  `migrations/meta/_journal.json`, `public/`, and `kuromoji/dict/`. `chmod
  0o755` the binary (fflate does not keep Unix modes), delete the zip, and
  write `ready.json` last. On restart, the status route reads an existing
  `ready.json`, so "Ready" survives a relaunch. A staged version that is not
  newer than the running one is deleted rather than offered. *Done when:*
  status reaches `ready`, `updates/staged/` holds the four items with
  `ready.json`, the binary is executable, and `safeEntryPath` /
  `checkStagedLayout` have tests including a zip-slip entry and a missing
  folder.
- [x] **Step 4 - Settings UI** - extend About with the states above,
  polling `GET /api/update/status` about once a second only while a job is
  running, and never showing the button when unavailable (the reason goes in a
  small hint only for `not-writable`, since the others are normal).
  *Done when:* screenshots at 1400px and 390px wide show the idle, downloading,
  ready, and failed states, and the manual link still shows in each.

## Files / areas

- `nuxt-app/launcher/index.ts` - set `GAQ_SRS_INSTALL_DIR` when compiled.
- `nuxt-app/server/utils/version.ts` (+ test) - asset digest and size.
- `nuxt-app/server/utils/selfUpdate.ts` (+ test) - availability, job, download,
  unpack, layout check.
- `nuxt-app/server/api/update/download.post.ts`,
  `nuxt-app/server/api/update/status.get.ts` - new routes.
- `nuxt-app/app/composables/useSelfUpdate.ts` - client state and polling.
- `nuxt-app/app/pages/settings.vue` - About panel states.
- `nuxt-app/package.json` - `fflate` dependency.

## Data / contracts

Load-bearing for 82b, so lock them here:

- **`GAQ_SRS_INSTALL_DIR`** - absolute path of the folder holding the running
  binary and its `migrations/`, `public/`, `kuromoji/` siblings. Set only by a
  compiled launcher. Its absence means "not packaged".
- **Staging layout** - `<GAQ_SRS_DATA_DIR>/updates/staged/` holds exactly what
  the release zip unpacks to (flat: binary plus the three folders), plus
  `ready.json`. 82b trusts a staging folder only when `ready.json` exists.
- **`ready.json`** -
  `{ version: string, assetName: string, sha256: string, binaryName: string, stagedAt: string }`.
- **`SelfUpdateStatus`** (server copy in `selfUpdate.ts`, client copy in
  `useSelfUpdate.ts`, same field order per F-09):

  ```ts
  interface SelfUpdateStatus {
    state: "unavailable" | "idle" | "downloading" | "verifying" | "unpacking" | "ready" | "failed";
    reason: "not-packaged" | "up-to-date" | "no-asset" | "no-digest" | "not-writable" | "check-failed" | null;
    version: string | null;
    receivedBytes: number;
    totalBytes: number | null;
    error: string | null;
  }
  ```

  Until step 3 adds unpacking, a verified job simply stays at `verifying`
  with `error: null`; no temporary extra state is added.
- `ReleaseAsset` gains `digest: string | null` and `size: number | null`. It
  stays server-only; `UpdateStatus` does not change.
- No database change.

## Testing

`bun run test` is configured, so each logic step ships its tests:

- Step 1: `parseDigest`, `selfUpdateAvailability` (every reason).
- Step 2: digest and size comparison. Download itself is integration, proved
  against the real v1.4.0 asset with a scratch `GAQ_SRS_INSTALL_DIR`.
- Step 3: `safeEntryPath` (zip-slip, absolute, drive letter, normal nested
  path), `checkStagedLayout` (each platform, each missing item).
- Step 4: UI, proved by screenshots and the build.

Manual path: run the dev server with an older `package.json` version (not
committed) and `GAQ_SRS_INSTALL_DIR` set to a scratch folder, open Settings >
About, click "Download update", and watch it reach "Ready". To check a failure,
make the expected digest wrong in a test run and confirm the page shows the
error and "Try again".

## Notes for the AI

- The server decides what to download. The client sends no URL, version, or
  path, so a request cannot point the job anywhere else.
- Keep failures quiet, like feature 54: an error is a message on the About
  panel, never a thrown page error, and the manual link always stays.
- Everything is written under `<dataDir>/updates/`. The install folder is only
  touched by the writability probe (a uniquely named temp file removed
  immediately).
- Streams, not buffers, for the download. Unpacking may hold the zip in memory
  (about 60MB), which is acceptable for a local desktop app; use fflate's async
  `unzip` so the event loop stays responsive.
- In dev, `GAQ_SRS_DATA_DIR` is usually unset; use the same `.data/`
  fallback `resolveDbPath` uses so staging lands in `nuxt-app/.data/updates/`
  (already gitignored).
- Code comments only for the why (Windows rename rule, F-21 idle timeout,
  fflate dropping modes); no em dashes.

## As built

- Completed 2026-09-26 via Autopilot, then completed locally by Continuous Mode.
- The About panel's states live in `components/settings/SettingsSelfUpdate.vue`
  rather than inline in `settings.vue` (already about 2000 lines, F-23); the page
  only mounts it under "Update available".
- `selfUpdate.ts` also exports `resolveUpdatesDir`, `isAllowedAssetUrl`,
  `verifyDownload`, `binaryNameFor`, `parseReadyManifest`, `downloadAndVerify`,
  and `unpackAndStage` (the last two take a fetch or platform override so they
  are unit-tested against real temp folders).
- `version.ts` exports `getReleaseLookup`, `ReleaseLookup`, `USER_AGENT`, and
  `pickPlatformAsset` for the job.
- fflate's async `unzip` was confirmed working under Node, Bun, and a compiled
  (ad-hoc re-signed) Bun binary, with the event loop still ticking.
- Evidence: `bun run test` (1244 passing), `bun run build`, a real v1.4.0
  macOS arm64 download (42,069,500 bytes, digest `f456e96...`) staged in a
  scratch data dir with `NUXT_PUBLIC_APP_VERSION=1.3.0` and a scratch
  `GAQ_SRS_INSTALL_DIR`; Ready survived a restart, and restarting as 1.4.0
  deleted the stale staging. Screenshots of idle, downloading, ready, and
  failed at 1400px and 390px (failed forced by making `updates` a file).
- Testing the version override needs no `package.json` edit:
  `NUXT_PUBLIC_APP_VERSION` overrides `runtimeConfig.public.appVersion`.
