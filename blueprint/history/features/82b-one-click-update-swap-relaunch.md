# Feature: One-click update - swap and relaunch

**From build-plan:** feature 82b (parent: 82, One-click update)
**Status:** verified

## Goal

Turn 82a's staged build into the running app. "Restart to update" in Settings >
About replaces the install folder's binary and its three sibling folders with
the staged ones, restores the old ones if any part fails, starts the new
version once the old process has exited without opening a second browser tab,
and reloads the open page once the new version answers. The old files are kept
as `.old` until the new version has started, then deleted.

## In scope

- A swap helper that copies each staged item into the install folder as
  `<name>.new` first (the data dir and install dir can be on different volumes,
  so a plain rename can fail with `EXDEV`), then renames `<name>` to
  `<name>.old` and `<name>.new` to `<name>`, one item at a time. The running
  binary is renamed, never overwritten, which Windows allows. Any failure puts
  every already-swapped item back and removes the `.new` copies. On success the
  staging folder is deleted.
- The binary that is replaced is the running one, `basename(process.execPath)`,
  so a user who renamed it keeps their name and shortcuts. The staged binary
  (`ready.json`'s `binaryName`) is what goes in under that name.
- `POST /api/update/restart`: packaged only (`GAQ_SRS_INSTALL_DIR` set), requires
  a valid `ready.json` newer than the running version, runs the swap, responds,
  then starts the relaunch helper and exits.
- A relaunch helper that waits for the old process to exit before starting the
  new binary, so the port is free. It is a small OS shell command, not the new
  binary, so waiting never depends on the new version's code: `/bin/sh` with
  positional arguments on macOS/Linux, PowerShell with the values passed through
  environment variables on Windows (no path is ever spliced into a command
  string). The child gets `GAQ_SRS_SKIP_BROWSER=1`.
- Launcher: no browser is opened when `GAQ_SRS_SKIP_BROWSER=1`. After the
  server answers (compiled only), the four `.old` and any stray `.new` items
  are deleted, best effort. Cleanup waits until the new server is reachable so
  a new build that cannot start leaves the `.old` files for manual recovery.
- Settings > About: "Restart to update" becomes a working button. After a
  click it shows "Restarting...", polls `GET /api/version` about once a second
  until `current` differs from the version before the click, then reloads the
  page. After 60 seconds without an answer it shows "The app didn't come back
  after restarting. Open it again from its folder." A swap failure shows the
  error; the manual download link stays underneath in every state.

## Out of scope

- Rolling back to the `.old` build from the UI, or keeping more than one old
  build.
- Recovering automatically when the new binary cannot start (the `.old` items
  stay for a manual fix).
- Downgrades, or restarting when nothing newer is staged.
- Code-signing beyond what `bun run package` already does.
- Restarting from dev (`bun run dev`/`preview`/`launch`); only a hand-set
  `GAQ_SRS_INSTALL_DIR` enables it for testing, pointed at a scratch folder.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Swap with restore** - `server/utils/selfUpdateSwap.ts`:
  `swapInstall({ installDir, stagedDir, items, ops })`, where `items` maps each
  staged name to its install name (`{ from: "gaq-srs", to: "<running binary>" }`
  plus the three folders) and `ops` defaults to `node:fs/promises`
  (`cp`, `rename`, `rm`, `chmod`) so failures can be injected. Removes stray
  `.new`/`.old` first, copies every item to `.new`, sets the binary's
  executable bit, swaps, and on any failure restores and cleans up. Returns
  `{ ok: true } | { ok: false, error }`. *Done when:* tests on real temp
  folders cover a full swap (new content in place, `.old` holds the old
  content, staging deleted), a copy failure (install folder unchanged, no
  `.new` left), a failure on the third rename (first two items restored, no
  `.new` left), and a renamed running binary; `bun run test` passes.
- [x] **Step 2 - Launcher: skip browser, clean up leftovers** - a pure
  `updateLeftovers(installDir, binaryName)` in `launcher/updateCleanup.ts`
  lists the `.old`/`.new` paths for the binary and the three folders;
  `removeUpdateLeftovers` deletes them best effort. The launcher skips
  `openBrowser` when `GAQ_SRS_SKIP_BROWSER=1` and, when compiled, calls the
  cleanup after `waitForServer` succeeds. *Done when:* tests cover the path
  list (including a renamed binary and `.exe`) and that cleanup removes only
  those paths; `bun run test` and `bun run build` pass.
- [x] **Step 3 - Restart route and relaunch** - a pure
  `relaunchCommand(platform, pid, binaryPath)` returning
  `{ command, args, env }` (sh on darwin/linux, PowerShell on win32); the
  restart logic in `selfUpdate.ts` (validate, swap, then relaunch after the
  response is sent) and `POST /api/update/restart` returning
  `{ ok: true } | { ok: false, error }`. *Done when:* `relaunchCommand` tests
  show no path or pid inside a command string; and end to end, a packaged
  build labelled 1.3.0 running from a scratch install folder (scratch data dir,
  spare port, `GAQ_SRS_SKIP_BROWSER=1`) with a packaged build labelled 1.5.0
  hand-staged with a valid `ready.json` restarts on `POST /api/update/restart`:
  the old process exits, `GET /api/version` then reports 1.5.0 on the same
  port, the install folder holds the new files, and the `.old` items are gone
  once the new server answers.
- [x] **Step 4 - Settings UI** - enable the button in `SettingsSelfUpdate.vue`
  and add the Restarting, reload, timeout, and swap-error states via
  `useSelfUpdate.ts`. *Done when:* screenshots at 1400px and 390px show the
  enabled Ready state and the Restarting state, and the same end-to-end setup
  as step 3, driven from the button, lands on the reloaded About panel showing
  the new version.

## Files / areas

- `nuxt-app/server/utils/selfUpdateSwap.ts` (+ test) - swap and restore.
- `nuxt-app/server/utils/selfUpdate.ts` (+ test) - restart and
  `relaunchCommand`.
- `nuxt-app/server/api/update/restart.post.ts` - new route.
- `nuxt-app/launcher/updateCleanup.ts` (+ test), `nuxt-app/launcher/index.ts`.
- `nuxt-app/app/composables/useSelfUpdate.ts`,
  `nuxt-app/app/components/settings/SettingsSelfUpdate.vue`.

## Data / contracts

- 82a's contracts stand unchanged: `GAQ_SRS_INSTALL_DIR`, the staging layout,
  `ready.json`, and `SelfUpdateStatus` (no new state; restarting is client-side).
- `POST /api/update/restart` takes no body and returns
  `{ ok: true } | { ok: false, error: string }`. On `ok: true` the process exits
  shortly after responding.
- `GAQ_SRS_SKIP_BROWSER=1` - set by the relaunch; the launcher opens no browser.
- Install folder during and after an update: `<name>.new` exists only mid-swap;
  `<name>.old` exists from the swap until the new version's server answers.
- No database change.

## Testing

`bun run test` is configured:

- Step 1: `swapInstall` against real temp folders with injected failures.
- Step 2: `updateLeftovers` and `removeUpdateLeftovers`.
- Step 3: `relaunchCommand` per platform. The restart itself is integration,
  proved end to end with two local packaged builds.
- Step 4: UI, proved by screenshots and the end-to-end run.

Manual path: package the app with `package.json` temporarily at 1.3.0 and copy
`release/<target>/` to a scratch folder; package again at 1.5.0 and copy that
target into `<scratch data>/updates/staged/` with a `ready.json`; restore
`package.json`. Start the 1.3.0 binary with `GAQ_SRS_DATA_DIR=<scratch data>`,
`PORT=3124`, `GAQ_SRS_SKIP_BROWSER=1`, open Settings > About, and click "Restart
to update".

## Notes for the AI

- Windows cannot be tested here. The rename order (running `.exe` renamed, not
  overwritten) and PowerShell's `Wait-Process` are the Windows-specific parts;
  say so in the review packet.
- The swap runs in the old process, which keeps running from its renamed
  binary; nothing after the swap may read the install folder.
- Keep failures quiet and on the About panel, as in 82a.
- Code comments only for the why (EXDEV, rename-not-overwrite, cleanup after
  the server answers); no em dashes.

## As built

- Completed 2026-09-26 by Continuous Mode.
- `server/utils/selfUpdateSwap.ts`: `swapInstall` with injectable `SwapOps`;
  tests cover a full swap, a renamed running binary, leftover cleanup, a copy
  failure, and rename failures at two points of the swap.
- `server/utils/selfUpdate.ts`: `relaunchCommand` (tested, including running
  the sh script for real), `installStagedUpdate` (swap, no relaunch), and
  `relaunchAndExit` (spawns the detached helper 500ms after the response and
  exits). `POST /api/update/restart` calls both.
- `launcher/updateCleanup.ts`: `updateLeftovers` and `removeUpdateLeftovers`;
  the launcher skips the browser on `GAQ_SRS_SKIP_BROWSER=1` and cleans up
  after `waitForServer` when compiled.
- End-to-end evidence on macOS arm64: builds packaged with `package.json`
  temporarily at 1.3.0 and 1.5.0 (restored to 1.4.0 after, and the original
  v1.4.0 `release/` output restored, its arm64 zip still matching GitHub's
  digest). The 1.3.0 build ran from a scratch install folder on port 3124
  with a scratch data dir; with 1.5.0 hand-staged, `POST /api/update/restart`
  returned `{ ok: true }`, the old pid exited, 1.5.0 answered on the same port
  about 2 seconds later, and the `.old` items and staging were gone. Driven
  from the button in a real browser (playwright-cli, 390px), the page showed
  "Restarting..." and reloaded itself onto 1.5.0 with no console errors.
  A read-only install folder returned "The update could not be copied into
  the app's folder." and left the install untouched and running.
- Screenshots: Ready and Restarting at 1400px and 390px, plus the reloaded
  About panel at 390px.
- Not tested: Windows (running `.exe` rename, PowerShell `Wait-Process`,
  directory renames with open handles) and Linux.
