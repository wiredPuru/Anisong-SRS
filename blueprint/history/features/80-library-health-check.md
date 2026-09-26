# Feature: Library health check

**From build-plan:** feature 80
**Status:** verified

## Goal

A Settings scan that lists every card that will stall a Study session or a
Preview, says why, and offers the matching fix on that row. Two kinds of
problem:

1. **Unavailable local file.** A local video/audio path is set but
   `/api/media` cannot serve it: the file is missing on disk, or it sits
   outside every configured library folder (`media.get.ts` 404s both). The
   player prefers a local path, so the card errors instead of streaming.
   Feature 42 left this case out of scope.
2. **No playable source.** No local file is available and no remote URL is one
   the Clip source setting (feature 64) allows, so nothing can play.

The scan changes nothing. Only clicking a fix writes anything.

## In scope

- A new Settings section, **Library health** (`?section=health`), after
  Import & export in the section rail, holding a "Scan library" button and the
  results.
- `GET /api/cards/health` runs the scan over the whole library. With
  `?cardId=<id>` it re-checks one card, which a row uses after a fix.
- Per-row problems, each on its own line with the path shown for a local one:
  - "Local video file is missing" / "Local audio file is missing"
  - "Local video is outside your media library folders" (and audio)
  - "No source the Clip source setting allows"
- Per-row fixes, offered only when they can work:

  | Fix | Offered when | What it does |
  |---|---|---|
  | Re-download video / audio | that kind's local file is **missing**, its remote URL is allowed, and a default download folder is set | `PATCH /api/cards` clears the path, then `POST /api/cards/download` fetches it (existing progress readout) |
  | Clear video / audio path | that kind's local file is **missing** and the card keeps another non-null source | `PATCH /api/cards` clears the path |
  | Re-source | Clip source is not `animethemes`, and some kind has an animethemes.moe URL with its local path null or missing | clears that kind's missing local path, then `POST /api/cards/resource` swaps in an AMQ URL for this card only (60c's matching, scoped) |
  | Delete | always | `DELETE /api/cards` `{ id }` behind an inline two-step confirm, like 61b |

- After a fix finishes, the row re-checks itself: it disappears when the card
  is healthy, or updates in place with what is still wrong. A fix's error
  shows on its row and leaves the row as it was.
- Hints on the section:
  - A missing file on an external or network drive may just be unplugged:
    reconnect it and scan again before clearing anything.
  - An outside-library file still exists, so the fix is adding its folder in
    Media library. No Clear or Re-download is offered for it, because clearing
    a path deletes the file from disk (`deleteFileIfUnreferenced`), and that
    file is not a lost one.
  - With no default download folder, Re-download is hidden and a line says to
    set one in Media library.
- States: not scanned yet, scanning, scan failed (with Try again), "All N
  cards can play", and "N of M cards need attention" above the list. An empty
  library says so.

## Out of scope

- Adding a missing folder to the library, or moving files, from this screen.
- Bulk fixes ("fix all"). Every fix is one row, one click.
- Checking that a remote URL actually answers (no network probes during the
  scan), or that a local file decodes. Only existence and library membership.
- Playback mode (feature 43) edge cases, such as a video-only card under Audio
  only. The scan uses the same "any playable source" rule as the card's
  at-least-one-source validation.
- Changing the Clip source setting, 60c's bulk Re-source, or the download
  route's refusal to write over a set path.
- Running a scan automatically or on a schedule.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Pure health classifier** - `server/utils/libraryHealth.ts`
  with `localFileState(path, libraryPaths, isFile)` (returns `"ok" |
  "missing" | "outsideLibrary"`, reusing `isPathWithinLibrary`'s
  `relative()` rule against a passed-in folder list so it does not read the
  DB) and `classifyCardHealth(input)` returning the `CardHealth` contract
  below. *Done when:* `libraryHealth.test.ts` covers:
  - a healthy local card, and a healthy remote-only card under each Clip source
  - a missing local with an allowed remote (Re-download offered), with a
    blocked remote (not offered), and with no download folder (not offered)
  - a missing local that is the card's only source (no Clear) versus one with
    another source (Clear)
  - an outside-library local (reported; no Clear, no Re-download)
  - no playable source under `anisongdb` with animethemes.moe URLs
    (Re-source offered) and under `animethemes` (not offered)
  - a sibling folder sharing a prefix (`/lib` vs `/lib2`) reads as outside

  `bun run test` passes.
- [x] **Step 2 - Scan route** - `GET /api/cards/health`, optional `cardId`
  (400 when not a positive integer). One light `select` of every card's id and
  four source fields, one `statSync` per set path, the library folders and
  Clip source read once, `getCardWithDetails` only for flagged cards. A path
  that throws on `stat` counts as missing. *Done when:* on the dev server,
  `curl /api/cards/health` returns `{ checked, clipSource,
  hasDefaultDownloadFolder, issues }` with `checked` equal to the library's
  card count; temporarily renaming one downloaded file makes that card appear
  with "missing", and renaming it back clears it (the route itself writes
  nothing); `?cardId=` returns that one card or an empty `issues`; `?cardId=x`
  is 400.
- [x] **Step 3 - Card-scoped re-source** - `listSourceRefreshCandidates` and
  `refreshCardSources` take an optional `cardIds` filter (unchanged when
  omitted, so 60c's Settings action behaves as before). New
  `POST /api/cards/resource` `{ cardId }` runs it for that card with a no-op
  progress reporter and returns `{ updated: boolean }`; an AniList or
  AnisongDB outage is a 503 with a readable message. *Done when:*
  `cardSourceRefresh.test.ts` gains cases proving the filter limits both the
  candidate list and the provider calls to that card's anime, and that no
  filter matches today's behavior; `bun run test` passes.
- [x] **Step 4 - Settings section, read-only** - the Library health section
  with Scan, every state in In scope, and the result rows (cover thumbnail,
  song title, anime and slot, one line per problem, the hints), no fix buttons
  yet. *Done when:* in a browser, with one file renamed away, Scan lists that
  card with its path and "missing"; the other states show (renamed back: "All
  N cards can play"); `bun run build` passes and the console is clean.
- [x] **Step 5 - Fix actions** - the four fixes on each row, driven by
  `CardHealth`, each disabling the row's buttons while it runs, then
  re-checking the row via `?cardId=`. Re-download reuses `useCardDownloads`'
  progress text. *Done when:* in a browser:
  - a renamed-away file with an allowed remote: Re-download shows progress,
    the file lands in the download folder, and the row disappears
  - Clear on a missing path with another source: the row disappears, or stays
    with the remaining problem
  - Re-source on a remote-only animethemes.moe card under `anisongdb`: the row
    disappears when a match exists, or shows "No faster source found"
  - Delete asks to confirm, then removes the card and the row
  - a fix that fails shows its error on the row and leaves the row (a
    Re-source while AniList or AnisongDB is unreachable). When a failed fix
    still left the card healthy (Re-download cleared the stale path, then the
    download failed, so the card streams again), the row goes and its error
    moves to a notice above the list. Note: with exactly one library folder,
    that folder is the default download folder even when the setting is empty,
    so clearing the setting does not make Re-download fail.

  `bun run test` and `bun run build` pass.

## Files / areas

- `nuxt-app/server/utils/libraryHealth.ts` + `libraryHealth.test.ts` - new,
  pure classifier (server).
- `nuxt-app/server/api/cards/health.get.ts` - new scan route (server).
- `nuxt-app/server/utils/cardSourceRefresh.ts` + its test - optional
  `cardIds` filter (server).
- `nuxt-app/server/api/cards/resource.post.ts` - new card-scoped re-source
  (server).
- `nuxt-app/app/components/settings/SettingsLibraryHealth.vue` - new section
  body (client).
- `nuxt-app/app/pages/settings.vue` - the `health` section key, label, and
  mount.

## Data / contracts

No schema change and no stored state. One new response shape, declared
server-side in `libraryHealth.ts` and copied by hand into the component, in
the same field order (coding standards, F-09):

```ts
type LocalFileState = "ok" | "missing" | "outsideLibrary";
type MediaKind = "video" | "audio";

interface CardHealth {
  localIssues: { kind: MediaKind; problem: "missing" | "outsideLibrary"; path: string }[];
  noPlayableSource: boolean;
  redownload: MediaKind[];
  clear: MediaKind[];
  resource: boolean;
}

interface CardHealthRow {
  card: CardWithDetails;
  health: CardHealth;
}

// GET /api/cards/health[?cardId=]
interface LibraryHealthResponse {
  checked: number;
  clipSource: ClipSource;
  hasDefaultDownloadFolder: boolean;
  issues: CardHealthRow[];
}
```

A card is listed only when `localIssues` is non-empty or `noPlayableSource`
is true. `POST /api/cards/resource` returns `{ updated: boolean }`.

## Testing

- Test gate is on (`bun run test`). Step 1's classifier and Step 3's scoping
  are pure or injected-dependency logic and ship with tests.
- Steps 2, 4, and 5 are route and UI wiring and ride on curl output, browser
  evidence (`playwright-cli` or a manual pass), and `bun run build`.
- Break a card for evidence by renaming one downloaded file in the library
  folder, and rename it back afterwards. Never edit the database by hand, and
  never delete a real card except the one Step 5's Delete check targets (use a
  throwaway card added for it).

## Notes for the AI

- Server owns every decision about what is wrong and which fix applies; the
  component only renders `CardHealth`.
- Reuse the existing mutation routes. The only new write route is
  `POST /api/cards/resource`, and it goes through `refreshCardSources`, not a
  new matcher: 60a's rule that songs pair by title, never slot, still holds.
- The existing download route still refuses to write over a set path.
  Re-download clears first rather than loosening that check.
- Clearing a path deletes its file when no other card references it. That is
  why outside-library paths get no Clear, and why the unplugged-drive hint
  exists.
- `isClipUrlAllowed` is the one host-to-provider map; do not add another.
- No `project-plan.md` change: this gathers existing clear, download,
  re-source, and delete actions behind one scan.
- No em dashes in code comments or docs.
