# Feature: Clip source setting - import-time clip filtering

**From build-plan:** feature 64b (parent: 64. Clip source setting)
**Status:** verified

## Goal

64a made every fetch route (`stream`, `prefetch`, `download`) refuse a clip
whose host the Clip source setting excludes, but nothing upstream of that
knows about the setting: anime, song, and artist import, and deck import,
all still return and store clip URLs from whichever provider happened to
answer, including ones the current setting will never let play. 64b makes
those four places drop an excluded URL before it reaches a result or a
stored `Card`, and tells the user why a theme has no addable clip instead of
letting them hit 64a's `403` after clicking Add.

## In scope

- A shared pure filter, `filterClipUrls(videoUrl, audioUrl, clipSource)`, in
  `server/utils/clipSource.ts` - drops whichever of `videoUrl`/`audioUrl`
  `isClipUrlAllowed` rejects, and reports `clipBlocked: true` only when the
  pair had at least one URL before filtering and neither survived (a theme
  the provider genuinely has no clip for is not "blocked" - there was
  nothing to block).
- Applying it in the four places that resolve or store clip URLs at
  import time: `POST /api/lookup/import` (anime), `GET
  /api/lookup/song-search` + `POST /api/lookup/song-import` (song),
  `POST /api/lookup/artist-import` (artist), and `importBundle` in
  `server/utils/deckImport.ts` (deck import). Every theme/result shape that
  currently carries `videoUrl`/`audioUrl` gains `clipBlocked: boolean`.
- Surfacing `clipBlocked` in the three theme-picking components that have no
  local-file fallback - `CardAddSongResults.vue`, `CardAddArtistResults.vue`,
  `DeckAddAnimeModal.vue` - as a disabled Add action plus a one-line note
  naming the Clip source setting and linking to `/settings`, matching the
  existing "set a default download folder" hint pattern.
- Surfacing the same note (without disabling Add) in
  `CardAddAnimeResults.vue`, which keeps its local-video-path input as a
  genuine way to add a blocked theme anyway - see the resolved decision
  below.
- `POST /api/lookup/song-import` re-filters the `videoUrl`/`audioUrl` it
  receives in its request body rather than trusting the search result the
  client echoes back, so a setting change between search and click can't
  smuggle a now-excluded URL into a `Card` row.

## Out of scope

- Runtime behaviour for cards that already hold a stored, now-excluded URL -
  Study/Preview skipping it and the 60c re-source action honouring the
  setting - that is 64c.
- Rewriting or deleting a URL already stored on an existing `Card`. This
  sub-feature only changes what gets stored on a *new* card going forward.
- `server/api/lookup/source-refresh.post.ts` (the 60c re-source action) -
  64c's job, not this one.
- Any change to `resolveThemes()`'s provider-merge logic in
  `themeSource.ts`, or to `resolveArtistThemes()`/`searchSongEntries()`'s
  provider preference. Filtering is applied after they run, at the route
  boundary, the same layering 64a used for `clipSourceGuard.ts` on top of
  `parseAllowedStreamUrl`.
- Changing the wording or status code of `createCard`'s existing "Card needs
  at least one video or audio source" error. Deck import already surfaces
  that message per-entry in its `errors` array; a manifest entry that loses
  its only source to filtering (and bundles no local audio) falls into that
  existing path unchanged.

## Resolved decision: why the Anime flow doesn't disable Add

`CardAddAnimeResults.vue` is the one theme-picking surface with a
local-video-path input (feature 49a), so a blocked remote clip doesn't mean
the theme is unaddable - typing a local path and clicking Add still works
today, filtering or not. Disabling Add there would remove a capability the
user already has. The other three surfaces (`CardAddSongResults.vue`,
`CardAddArtistResults.vue`, `DeckAddAnimeModal.vue`) have no such input -
for them, `clipBlocked` with no surviving URL genuinely means "nothing to
add," so Add disables. All four show the same note either way, so the user
always knows *why* - only whether Add is clickable differs, and only
because one of the four has another way to finish the job.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Filter helper (pure logic + test)** - add `filterClipUrls`
  to `server/utils/clipSource.ts`, extend `clipSource.test.ts`. *Done when:*
  `bun run test` passes cases: both URLs null -> `clipBlocked: false`; one
  allowed + one blocked -> the allowed one survives, `clipBlocked: false`;
  both blocked under the current mode -> both null, `clipBlocked: true`;
  covering all three `ClipSource` modes against an AMQ host and an
  animethemes.moe host.
- [x] **Step 2 - Anime import filtering + CardAddAnimeResults note** -
  `import.post.ts` runs each theme's URLs through `filterClipUrls` before
  building its response, adds `clipBlocked` to `ThemeResult`;
  `CardAddAnimeResults.vue` shows the note under a blocked theme, Add stays
  enabled. *Done when:* with `clipSource` set to `"animethemes"`, `POST
  /api/lookup/import` for an anime whose only available clip is on an AMQ
  host returns that theme with `videoUrl: null, audioUrl: null,
  clipBlocked: true`; set to `"both"`, the same call returns the URL and
  `clipBlocked: false`. In the browser, `/cards` -> search -> Anime group ->
  expand shows the note on the blocked theme, Add card still works with a
  local path typed in.
- [x] **Step 3 - Song search/import filtering + CardAddSongResults note** -
  `song-search.get.ts` filters each result and adds `clipBlocked`;
  `song-import.post.ts` re-filters the body's `videoUrl`/`audioUrl` before
  storing; `CardAddSongResults.vue` disables Add and shows the note when
  `clipBlocked && !videoUrl && !audioUrl`. *Done when:* the same
  curl-against-dev-server check as Step 2 against `/api/lookup/song-search`;
  POSTing `/api/lookup/song-import` with a body claiming an excluded URL
  (setting changed since search) still returns `videoUrl: null`. In the
  browser, `/cards` -> search -> Songs group shows a disabled Add + note on
  a blocked result; switching the setting to allow it and re-searching
  re-enables Add.
- [x] **Step 4 - Artist import filtering + CardAddArtistResults note** -
  `artist-import.post.ts` filters each theme entry's URLs and adds
  `clipBlocked`; `CardAddArtistResults.vue` gets the same disabled-Add +
  note treatment as Step 3, and its `addAllThemes()` bulk loop skips a
  `clipBlocked` theme with no surviving URL (same reachability as the
  per-row disable - "Add all" must not report a predictable skip as a
  failure). *Done when:* same curl check against `/api/lookup/artist-import`;
  browser check via `/cards` -> search -> Artists group -> artist modal,
  including that "Add all" with a blocked theme present reports it neither
  added nor failed, just not attempted.
- [x] **Step 5 - DeckAddAnimeModal note** - same disabled-Add + note
  treatment in `DeckAddAnimeModal.vue`, reusing the `clipBlocked` field
  Step 2's route change already returns (no server change in this step).
  *Done when:* in the browser, a manual deck's "Add new anime" flow shows
  the disabled Add + note on a theme blocked under the current setting.
- [x] **Step 6 - Deck import filtering** - `importBundle` in
  `deckImport.ts` runs a manifest entry's
  `animethemesVideoUrl`/`animethemesAudioUrl` through `filterClipUrls`
  before calling `createCard`. *Done when:* `POST /api/decks/import`
  against a hand-built bundle directory (`manifest.json` with one entry
  whose only URL is on a host the current setting excludes, no bundled
  audio file) reports that entry under `errors` with `createCard`'s
  existing "needs at least one source" message instead of creating a card;
  an entry whose URL is on an allowed host still imports and its `Card`
  holds that URL.

## Files / areas

- `nuxt-app/server/utils/clipSource.ts`, `nuxt-app/server/utils/clipSource.test.ts`
- `nuxt-app/server/api/lookup/import.post.ts`
- `nuxt-app/server/api/lookup/song-search.get.ts`
- `nuxt-app/server/api/lookup/song-import.post.ts`
- `nuxt-app/server/api/lookup/artist-import.post.ts`
- `nuxt-app/server/utils/deckImport.ts`
- `nuxt-app/app/components/card/CardAddAnimeResults.vue`
- `nuxt-app/app/components/card/CardAddSongResults.vue`
- `nuxt-app/app/components/card/CardAddArtistResults.vue`
- `nuxt-app/app/components/deck/DeckAddAnimeModal.vue`

## Data / contracts

- Load-bearing:
  ```ts
  function filterClipUrls(
    videoUrl: string | null,
    audioUrl: string | null,
    clipSource: ClipSource,
  ): { videoUrl: string | null; audioUrl: string | null; clipBlocked: boolean };
  ```
- `ThemeResult` (anime import, shared by `CardAddAnimeResults.vue` and
  `DeckAddAnimeModal.vue`'s own hand-duplicated copy), `SongSearchResult`,
  and the artist-import theme entry shape each gain `clipBlocked: boolean`
  server- and client-side, per the F-09 by-hand-duplication convention in
  `coding-standards.md`.
- No schema or migration changes - `clipSource` itself is 64a's column,
  read-only here via the existing `getClipSource()`.

## Testing

- Test runner is configured (Vitest). Step 1 ships `filterClipUrls` tests
  in `clipSource.test.ts`, alongside the existing `isClipUrlAllowed` cases.
- Steps 2-4 and 6 are route/integration surfaces: verify with `curl` (or a
  small script) against the dev server, checking response bodies and, for
  Step 6, the created `Card` rows - not new unit tests, matching how 64a
  verified its route steps.
- Steps 2-5's UI halves are components: browser evidence (screenshot or
  description of the note + disabled/enabled Add state) at desktop width.
- Final gate: `bun run test` and `bun run build` in `nuxt-app/`.

## Notes for the AI

- Reuse `isClipUrlAllowed` inside `filterClipUrls` - don't re-implement the
  host check. `getClipSource()` is the one place that reads the stored
  setting; every route in scope here already imports it or can via
  `mediaLibrary.ts`, same as `clipSourceGuard.ts` does.
- Host matching stays exact-or-subdomain on `URL.hostname`, `https:` only,
  inherited unchanged from `isClipUrlAllowed` - nothing in this feature
  touches that logic.
- `clipBlocked` means "the provider(s) offered a clip here and the current
  setting rejected all of it" - not "no clip exists." A theme with no
  remote URL at all from either provider (a real gap, unrelated to the
  setting) keeps today's behaviour: `clipBlocked: false`, no note, same as
  before this feature.
- Keep the note's wording generic across all four components ("blocked by
  your Clip source setting", linking to `/settings`) rather than naming the
  specific excluded host - `coding-standards.md` already establishes the
  `NuxtLink to="/settings"` hint pattern in `CardAddSongResults.vue`'s
  download-folder message; match it.
- `CardAddAnimeResults.vue`'s `addAllThemes()` bulk loop is deliberately
  **not** changed to skip blocked themes - unlike the Artist flow, its
  per-row Add stays clickable (the local-path fallback), so a blocked theme
  attempted via "Add all" without a filled-in local path failing is the
  same, already-existing "no source provided" outcome as any other theme
  with no source, not a new inconsistency to close.
- `song-import.post.ts`'s re-filter is a defense-in-depth check, not a
  behavior users will normally trigger - the common path is already clean
  because Step 3 filters at search time. Don't add a second user-facing
  error message for it; a silently-dropped URL there just means the create
  call downstream may hit the existing "needs at least one source" error,
  same as any other themeless add attempt.
- No em dashes in code comments or copy; use `-` for separators, matching
  the rest of the codebase's inline hint text.
- Server routes only touch settings/clip-source logic through
  `mediaLibrary.ts`/`clipSource.ts`; components stay presentation-only and
  call routes with `$fetch`. No hard-coded colors; scoped styles on
  `var(--token)`, reusing the existing `.inline-error`/hint class patterns
  already in each component rather than inventing a new one per file.
