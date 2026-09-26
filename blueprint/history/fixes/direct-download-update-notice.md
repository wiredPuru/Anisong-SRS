# Direct-download update notice

**Type:** Fix

**Status:** verified

## The problem

The update notice (feature 54) only links to the GitHub release page. From
there the user has to read the notes, work out which of the four zips
(`gaq-srs-<windows-x64|macos-x64|macos-arm64|linux-x64>.zip`) matches their
machine, and download it. The server already knows its own OS and CPU
(`process.platform`, `process.arch`), and GitHub's `releases/latest` response
already carries the release notes (`body`) and the assets list, both of which
`getReleaseLookup()` (`server/utils/version.ts`) currently ignores.

## The fix

- **Server.** `getReleaseLookup()` also reads `body` and `assets[]`
  (`name`, `browser_download_url`). A pure `platformAssetName(platform, arch)`
  maps `win32/x64`, `darwin/x64`, `darwin/arm64`, `linux/x64` to the zip name
  `bun run package` produces, and returns `null` for anything else.
  `UpdateStatus` gains `downloadUrl` (the matching asset's URL, or `null` when
  there is no match) and `releaseNotes` (`string | null`). Only the cached
  lookup stores the notes and assets; picking the asset happens per call,
  the same way `updateAvailable` is recomputed per call. Every malformed field
  degrades to `null`; the check stays fail-quiet.
- **Notes rendering.** A pure `parseReleaseNotes(md)` (`app/utils/`) turns the
  small Markdown subset the releases use (`**Heading**` lines, `- ` bullets,
  paragraphs, inline `` `code` `` and `**bold**`) into structured blocks the
  template renders as normal elements. No `v-html` and no Markdown dependency:
  the notes come from the network, so they are never injected as HTML.
- **Settings > About.** While an update is available: a primary "Download
  vX.Y.Z for <platform label>" link to `downloadUrl`, a secondary "Release page"
  link, and the parsed notes under it (scrollable if long). When `downloadUrl`
  is `null` (unknown platform, or a release missing that zip), keep today's
  single link to the release page.
- **Rail dot.** Unchanged; it still points at Settings.
- **Client type.** Add the two fields to `UpdateStatus` in
  `app/composables/useUpdateCheck.ts`, same order as the server copy (F-09).

Must not break: the fail-quiet contract (HTTP 200, `checkFailed`), the
6h/10min cache TTLs, `isNewerVersion`, and About rendering when settings fail
to load.

## Build steps

1. [x] **Server: notes + per-platform asset.** Extend `UpdateStatus` and the
   lookup in `server/utils/version.ts`, add `platformAssetName`, and cover
   the mapping, asset matching (present, missing, malformed `assets`), and the
   notes pass-through in `version.test.ts`.
   Done when `bun run test` passes and `GET /api/version` returns
   `downloadUrl` and `releaseNotes` fields.
2. [x] **Client: notes parser + About UI.** Add `parseReleaseNotes` with a
   test beside it, update the client `UpdateStatus`, and render the download
   link, release-page link, and notes in `app/pages/settings.vue` using
   `main.css` tokens.
   Done when, with an update available, About shows the right platform's
   download link and readable notes, and falls back to the single release
   link when `downloadUrl` is `null`.

## Verify

- `bun run test` and `bun run build` pass.
- Temporarily run with an older `appVersion` (for example by setting
  `package.json` to `1.3.0` in a scratch dev run, not committed) so v1.4.0
  reads as newer. Settings > About should show "Download v1.4.0 for macOS
  (Apple Silicon)" pointing at `gaq-srs-macos-arm64.zip`, plus the v1.4.0
  notes with headings and bullets.
- Offline or with GitHub unreachable, About still says "Couldn't check for
  updates." with no error state.
