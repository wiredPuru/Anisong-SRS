# Feature: Anime + Song add-candidates on /cards

**From build-plan:** feature 49a
**Status:** verified

## Goal

`/cards`' own search box already finds local cards by song/artist/anime title
(feature 35a). This step extends it to also search AniList (by anime) and
animethemes.moe (by song) in parallel, so a card can be found *or added* from
one search box - without a trip to the separate `/cards/new` page. This is
the first of feature 49's three sub-features; the Artist add-candidate group
(49b) and retiring `/cards/new` itself (49c) come later. `/cards/new` and
every existing entry point to it (NavBar's dropdown, the empty-state links on
`/cards`, `/stats`, `/decks`) are untouched by this step - this is purely
additive.

## In scope

- Extend `/cards`' existing debounced search (`app/pages/cards/index.vue`) to
  also fire, in parallel with the existing local list fetch, once the query
  is 2+ characters (matching NavBar's existing minimum):
  - `GET /api/lookup/anilist-search` (Anime add-candidates)
  - `GET /api/lookup/song-search` (Song add-candidates)
- Render two new result groups below the local card list, in this fixed
  order: **local cards** (unchanged, feature 35a), then **Anime**, then
  **Songs**. All three always run together - no gating on local results
  being empty (this is ordering only, matching feature 47's parallel
  approach, not the older gated behavior it replaced).
- **Anime group**: each result is a row with the anime's title(s). Clicking
  one expands it inline (no navigation, no modal) into a theme-picker:
  - Calls `POST /api/lookup/import` with the `aniListId` to resolve/upsert
    the anime and list its themes (same call `/cards/new`'s anime mode
    already makes).
  - Pre-marks any theme that already has a card as "Added", via
    `GET /api/cards/by-songs`, *before* rendering the Add buttons - the same
    safeguard feature 4's fix added to `/cards/new` so a click can't 400
    against a song that's already a card. An anime can show a mix of
    "Added" and addable themes (e.g. you have OP1 but not OP2/ED1).
  - Each addable theme gets a local-video-path input + "Add" button ->
    `POST /api/cards`, matching `/cards/new`'s existing per-theme add UI.
- **Song group**: each result adds in one click, no picker step (matching
  `/cards/new`'s song mode exactly): `POST /api/lookup/song-import` (upserts
  anime/artist/song, returns `existingCard` if one already exists) then, only
  if no `existingCard`, `POST /api/cards`.
- After any successful add (Anime or Song group), refresh the local list
  (re-run the same `loadFirstPage()` the search box already calls) so the
  new card appears there too, and flip that result to an "Added" state in
  its own group rather than removing the row.
- Newly-added cards get the same inline download action already used
  elsewhere (`useCardDownloads()`), consistent with `/cards`' existing rows.
- Independent loading/error/empty states per group (a slow or failed AniList
  lookup must not block the Songs group or the local list from rendering),
  matching this project's established "never just the happy path" convention.

## Out of scope

- The **Artist** add-candidate group and its bulk preview modal - feature
  49b.
- Deleting `/cards/new`, or touching any of its six existing entry points
  (NavBar's three query-param navigations, `/cards`' own header/empty-state
  links, `/stats`'s and `/decks`'s empty-state links) - feature 49c.
- NavBar's own search dropdown and its narrower `/api/search` (song-title
  only) - unrelated to this change, not touched.
- The deck-detail add flow (feature 33) - its own separate, deck-scoped
  local+AniList search, unrelated to this change.
- Any server-side/API changes - every endpoint this uses already exists and
  is unchanged; this is a client-side (Vue) feature only.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Anime add-candidates group** - added
  `app/components/card/CardAddAnimeResults.vue`: a `query` prop watched with
  `{ immediate: true }` (no separate debounce timer - driven entirely by
  `/cards`' existing debounced `searchQuery`), a 2-char minimum, and a
  generation counter guarding against out-of-order responses (same pattern
  as `NavBar.vue`'s existing search). Clicking a result calls
  `POST /api/lookup/import`, pre-marks already-added themes via
  `GET /api/cards/by-songs` (porting feature 4's exact safeguard), and
  renders per-theme Add/Preview/Delete/Download - ported near-verbatim from
  `/cards/new.vue`'s anime-mode template and script. Wired into
  `app/pages/cards/index.vue` with `@refresh="loadFirstPage"` and
  `@preview` reusing the page's existing single `CardPreviewModal` (no
  second modal instance).
  Verified: `bun run build` passes; `/cards` renders (200). Live AniList
  search/import could not be exercised - AniList's own API was down for the
  duration of this build (`"The AniList API has been temporarily disabled
  due to severe stability issues"`, confirmed via direct curl to
  `graphql.anilist.co` with the correct header, independent of this app -
  animethemes.moe worked fine from the same environment, ruling out a local
  network/sandbox block).
- [x] **Step 2 - Song add-candidates group** - added
  `app/components/card/CardAddSongResults.vue`: same `query`-prop/debounce/
  generation-counter pattern as Step 1, `GET /api/lookup/song-search`,
  one-click add (`POST /api/lookup/song-import` -> `POST /api/cards` only if
  no `existingCard`) - ported from `/cards/new.vue`'s song mode. Wired below
  the Anime group with the same `@refresh`/`@preview` pattern.
  Verified: `bun run build` passes. `GET /api/lookup/song-search?q=Kirameki`
  returned real animethemes.moe results live (this leg doesn't touch
  AniList). Posted one real result straight to `/api/lookup/song-import`
  (the exact body the component sends) and got the identical `AniList
  lookup failed with status 403` as Step 1 - confirms the request reaches
  the right code path and fails only at the same external wall
  (`song-import.post.ts` calls `fetchAnimeFromAniList` unconditionally,
  even for the "already added" check), not a bug in the request shape.
- [x] **Step 3 - Cross-group polish** - no new code; verified by inspection
  and live data that the three groups are independent. Confirmed in the
  template that `<CardAddAnimeResults>`/`<CardAddSongResults>` are siblings
  of the local list's `v-if="initialPending"`/`v-else-if="initialError"`/
  `v-else` chain, not nested inside it. Fired all four underlying endpoints
  concurrently with the same query: local cards (200), anime add-candidates
  (500, AniList down), song add-candidates (200), by-songs pre-marking
  (200) - one failing while three succeed, confirming independence at the
  data layer; Vue's per-component reactive state gives the same guarantee
  at the render layer. "Added card is fully equivalent to one added
  elsewhere" holds by construction: `@refresh` reloads `/cards`' local list
  fresh from the server, so a newly-added card becomes an ordinary row with
  the same Edit/Preview/Delete/Decks/Download every other row has - not a
  special case. The download-action wiring named in this step's original
  "done when" was already included in Steps 1 and 2 (inherent to porting
  the existing row template), not deferred here.

## Files / areas

- `app/pages/cards/index.vue` - wire the two new group components into the
  existing search area; add the local-list-refresh callback.
- `app/components/card/CardAddAnimeResults.vue` (new) - Anime group +
  inline theme-picker. Folder is singular `card/` (matching
  `CardPreviewModal`'s existing folder), required for Nuxt's
  prefix-stripping auto-import to register it as `<CardAddAnimeResults>`
  rather than double-prefixing - see feature 11's note on this.
- `app/components/card/CardAddSongResults.vue` (new) - Song group,
  one-click add.

No server-side files change - `/api/lookup/anilist-search`,
`/api/lookup/song-search`, `/api/lookup/import`, `/api/lookup/song-import`,
`/api/cards`, and `/api/cards/by-songs` all already exist and are used as-is.

## Data / contracts

None new. Reuses existing response shapes unchanged:

- `AniListAnime` (`{aniListId, titleRomaji, titleEnglish, titleNative,
  coverImageUrl}`) from `/api/lookup/anilist-search` and `/api/lookup/import`.
- The raw animethemes song-search entry shape from `/api/lookup/song-search`,
  and `/api/lookup/song-import`'s `{songId, videoUrl, audioUrl,
  existingCard}` response.

This project has no shared `app/types/` module yet - `/cards/new.vue` and
`/decks/index.vue` each already define their own local copies of these same
interfaces rather than importing a shared one. Match that existing pattern:
define local interfaces in the two new components rather than introducing a
shared types file as a side effect of this feature.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command), so this
rides on browser and build evidence, not unit tests - consistent with this
being a UI/integration feature (search, network calls, DOM rendering), not
new pure logic.

**Known gap:** AniList's API was down for the entire build
(`"temporarily disabled due to severe stability issues"`, a real outage
confirmed independent of this app/environment - see Step 1/2 notes above),
so the actual "click a result, see it added" path for both new groups was
never exercised in a live browser - only up to the point where AniList
itself fails, reproduced identically outside the app via curl. Recommended
before considering this fully proven:

- Once AniList is reachable again, search a title you already have a card
  for -> confirm it appears in Local, and the Anime group's expanded theme
  list correctly pre-marks that theme "Added" while leaving other themes
  addable.
- Search a title you have no card for -> confirm the Anime group lets you
  add a theme, and it immediately shows up in the Local group.
- Search a song/theme title directly -> confirm the Songs group adds it in
  one click and it appears in Local.
- Throttle/fail one lookup (e.g. disconnect network mid-search) -> confirm
  the other groups still render instead of the whole search area breaking
  (the AniList outage during this build already demonstrated this for the
  Anime group specifically).
- `bun run build` must pass (confirmed throughout).

## Notes for the AI

- Reuse the *existing* debounce/timer already driving `/cards`' local search
  - do not add a second independent debounce for the two new fetches, to
    avoid the groups flickering out of sync with each other.
- The 2-character minimum for the Anime/Song fetches matches NavBar's
  existing convention; the local list's own search keeps its current
  no-minimum behavior unchanged.
- "Added" is a persistent badge state, not a row removal, matching
  `/cards/new`'s existing convention for added rows.
- Keep `/cards/new`, NavBar, and the deck-detail add flow completely
  unchanged in this step - they're explicitly out of scope until 49c.
