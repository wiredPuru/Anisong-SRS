# Feature: Update checker

**From build-plan:** feature 54
**Status:** verified

## Goal

Give the app a real version number (it has none today) and tell the user when a
newer release exists, with a link to it. Nothing downloads, nothing replaces
itself: the app makes one cached, fail-quiet call to the public GitHub releases
API and, if the latest tag is newer than the running build, shows a notice.

This matters because a packaged binary someone downloaded runs that version
forever with no way of knowing a newer one shipped, and the release page is the
only distribution channel.

## Design reference

No new visual target - this is not a replication feature. Match what is already
shipped:

- The Settings "About" panel copies the existing section styling from feature
  50g (`app/pages/settings.vue`'s section rail + content pane).
- The rail indicator follows feature 50a's rail conventions in
  `app/components/nav/NavBar.vue` (icon-first, label hidden below 820px per
  feature 50h).

Use `var(--token)` from `app/assets/css/main.css` throughout; no hard-coded
colors.

## In scope

- A `version` field in `nuxt-app/package.json`, surfaced to client and server.
- The version being correct in both the developer workflow and a packaged
  binary.
- `GET /api/version` - compares the running version against the latest GitHub
  release tag, in-memory cached, host-pinned to this project's repo.
- A Settings "About" section showing the running version, the check result, and
  a manual re-check.
- A rail indicator (every page) when an update is available, linking to that
  About section.
- Fail-quiet behavior: offline, rate-limited, 404, or timed-out checks leave
  the app behaving exactly as it does now.

## Out of scope

- **Downloading or replacing the running build.** Explicitly ruled out: a
  build is an executable plus three sibling folders (`migrations/`, `public/`,
  `kuromoji/`), Windows cannot overwrite a running `.exe`, and macOS needs
  re-signing after a binary swap (see `scripts/package.ts`'s codesign step).
  Self-replacement is a separate feature if it is ever wanted.
- Release notes rendering, changelogs, or an in-app "what's new" panel. The
  notice links out to the GitHub release page, which already carries the notes.
- An update channel, manifest, or prerelease/beta opt-in. `/releases/latest`
  already excludes drafts and prereleases.
- Automating the release publish itself. Releases stay hand-published from
  `bun run package`'s zipped output.
- Notifying about anything other than the app (no dependency or migration
  checks).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Stamp a version into the app.** Add `"version": "1.2.0"` to
  `nuxt-app/package.json` (matching the current published release, so the first
  check compares like for like) and expose it through
  `runtimeConfig.public.appVersion` in `nuxt.config.ts`, read from
  `package.json` at build time so the two can never drift. No UI yet.
  *Done when:* a temporary log or `/api/_nuxt` inspection shows
  `useRuntimeConfig().public.appVersion === "1.2.0"` under `bun run dev`, and
  `grep -r "1.2.0" .output/server/index.mjs` finds it after `bun run build`,
  proving the value is baked into what the packaged binary embeds.

- [x] **Step 2 - Version comparison helper.** Add
  `server/utils/version.ts` with a pure `isNewerVersion(latest, current)` that
  strips a leading `v`, splits on `.`, and compares each part **numerically**.
  *Done when:* these all hold, checked by hand in a scratch script or the Nuxt
  devtools console: `("v1.10.0", "1.9.0") -> true` (the case a string compare
  gets wrong), `("v1.2.0", "1.2.0") -> false`, `("v1.2.0", "1.3.0") -> false`,
  `("1.2.1", "1.2.0") -> true`, and a malformed or empty tag returns `false`
  rather than throwing.

- [x] **Step 3 - `GET /api/version` route.** Add `server/api/version.get.ts`
  returning the `UpdateStatus` shape below. It calls
  `https://api.github.com/repos/wiredPuru/Anisong-SRS/releases/latest` with an
  explicit `User-Agent` header and `AbortSignal.timeout(5000)`, wraps the whole
  call in try/catch, and caches the result in a module-level variable for 6
  hours. A failure sets `checkFailed: true` and `updateAvailable: false`, and
  is cached for 10 minutes so a rate-limited or offline app does not retry on
  every page load.
  *Done when:* `curl localhost:3000/api/version` returns
  `{"current":"1.2.0","latest":"1.2.0","updateAvailable":false,...}`; a second
  call within the TTL makes no new outbound request (verified by logging the
  fetch, or by watching it stay fast); and temporarily pointing the constant at
  a nonexistent repo returns `checkFailed: true` with HTTP 200, never a 500 and
  never an unhandled rejection in the server log.

- [x] **Step 4 - Settings "About" section.** Extend `app/pages/settings.vue`'s
  `SettingsSection` union, `SECTIONS` array, and `SECTION_LABELS` with
  `about: "About"`, and add its pane: the running version, and one of "Update
  available - vX.Y.Z" (linking to `releaseUrl`, opening in a new tab),
  "You're up to date", or a quiet "Couldn't check for updates" line. Include a
  "Check again" button that refetches. Fetch via a new
  `app/composables/useUpdateCheck.ts` backed by `useState` so the result is
  fetched once per app load and shared.
  *Done when:* `/settings?section=about` shows `1.2.0` and "You're up to date";
  the section survives a reload via its `?section=` query param like the other
  five; and with the local `version` temporarily set to `0.9.0`, the same pane
  shows "Update available - v1.2.0" with a working link to the release page.

- [x] **Step 5 - Rail indicator.** In `app/components/nav/NavBar.vue`, read the
  same composable and render a small accent dot on the Settings rail link (plus
  a labelled pill at full width) only when `updateAvailable` is true, linking to
  `/settings?section=about`.
  *Done when:* with `version` temporarily at `0.9.0` the indicator shows on
  every page and navigates to the About section; at the real `1.2.0` it is
  absent entirely; below 820px the rail stays icon-only with the dot still
  visible and no layout shift; and a failed check shows nothing at all.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/package.json` | Add the `version` field (none exists today). |
| `nuxt-app/nuxt.config.ts` | Expose it as `runtimeConfig.public.appVersion`. |
| `nuxt-app/server/utils/version.ts` | New. Compare helper, repo constant, cached GitHub fetch. |
| `nuxt-app/server/api/version.get.ts` | New. The route. |
| `nuxt-app/app/composables/useUpdateCheck.ts` | New. One shared fetch for rail + settings. |
| `nuxt-app/app/pages/settings.vue` | New "About" section. |
| `nuxt-app/app/components/nav/NavBar.vue` | The update indicator. |

## Data / contracts

New response shape for `GET /api/version`:

```ts
interface UpdateStatus {
  current: string;           // "1.2.0", from runtimeConfig
  latest: string | null;     // "v1.2.0" as GitHub reports it, null if unknown
  updateAvailable: boolean;  // false whenever the check failed
  releaseUrl: string | null; // the release's html_url, null if unknown
  checkFailed: boolean;      // true on network error, timeout, 403, 404
  checkedAt: string;         // ISO timestamp of the cached result
}
```

Not load-bearing for other features - nothing else reads it. No database
change: the result is process memory only, never persisted, so there is no
migration and no `MediaLibrarySettings` field.

## Testing

No test runner is configured (`AGENTS.md` declares no `test` command), so the
logic-test gate in `coding-standards.md` is off. Verification is build output
plus manual checks, per the done-whens above.

`isNewerVersion()` in Step 2 is exactly the kind of pure logic that gate exists
for - numeric-vs-string comparison has a real wrong answer (`1.10.0` vs
`1.9.0`). If you want it covered, run `/tests` before Step 2 and it ships with
a test; otherwise verify it by hand against the five cases listed there.

Manual path once built:

1. `bun run dev`, visit `/settings?section=about` - shows `1.2.0`, "You're up
   to date", no rail indicator.
2. Set `version` to `0.9.0`, restart - About shows "Update available - v1.2.0",
   rail shows the dot on every page, link opens the GitHub release.
3. Disconnect the network, restart, load any page - no indicator, no error
   toast, About says it couldn't check, everything else works normally.
4. `bun run build` succeeds.

## Notes for the AI

- **Server-side only for the GitHub call.** Per `coding-standards.md`, anything
  touching an external API lives in `server/`. The client calls `/api/version`,
  never `api.github.com` directly - that also keeps the `User-Agent` header
  under our control.
- **The `User-Agent` header is mandatory, not optional.** GitHub rejects
  requests without one. This project has already been bitten twice: see feature
  3 (animethemes.moe 403s on Node's default) and feature 48's packaged-Windows
  AniList 403 fix.
- **Compare numerically.** A lexical string compare reports `1.9.0` as newer
  than `1.10.0`. This is the one real correctness risk in the feature.
- **Fail quiet, always.** Every failure mode - offline, DNS failure, timeout,
  403 rate limit, 404 no releases, malformed JSON - degrades to "no notice
  shown", never an error state, per the error-handling rules in
  `coding-standards.md`. The route returns HTTP 200 with `checkFailed: true`;
  it never throws.
- **Cache in module scope, not the database.** A packaged app is launched fresh
  per session, so a 6-hour in-process TTL means roughly one call per launch,
  well inside GitHub's 60-requests-per-hour unauthenticated limit.
- **Hardcode the repo as one constant** (`wiredPuru/Anisong-SRS`) in
  `server/utils/version.ts`. Note the repo name differs from the local
  directory name (`GAQ_SRS`); do not derive it from the folder.
- **No auth token.** The repo is public and unauthenticated access is
  sufficient. Do not add a token setting.
- **The check runs in dev too**, deliberately, so the feature is verifiable
  without packaging a binary. It is not gated to compiled builds.
- Use `useState` in the composable (the existing app-wide state pattern, as
  used by `pendingCardPreview`) so the rail and Settings share one fetch rather
  than each firing their own.
