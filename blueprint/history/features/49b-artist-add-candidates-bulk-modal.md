# Feature: Artist add-candidates + bulk preview modal

**From build-plan:** feature 49b
**Status:** verified

## Goal

`/cards`' unified search already finds local cards (feature 35a) and, since
feature 49a, offers Anime and Song add-candidate groups. This step adds the
third and final add-candidate group - **Artists**, backed by the existing
`/api/lookup/artist-search` - so an artist's entire animethemes.moe catalog
can be pulled in and bulk-added without a trip to `/cards/new`. Clicking an
artist result opens a modal (a new interaction shape for `/cards`, since
Anime/Song both expand inline) that generalizes `DeckAddAnimeModal.vue`
(feature 33) from one anime to an artist's many anime groups, and ports
`/cards/new`'s existing artist-mode bulk actions (Add all, Download all -
feature 37b) verbatim. Retiring `/cards/new` itself is feature 49c, later.

## In scope

- A third add-candidate group, **Artists**, in `app/pages/cards/index.vue`,
  rendered after the existing Anime and Song groups (49a) as
  `<CardAddArtistResults>` - same `query`/`has-default-download-folder`
  props and `refresh`/`preview` emits as its two siblings, same 2-character
  minimum, same generation-counter-guarded fetch pattern, no separate
  debounce (reuses `/cards`' existing one).
- Search via `GET /api/lookup/artist-search` (unchanged - already used by
  `/cards/new` and NavBar). An empty match set shows "No matching artists
  found." (matching `CardAddAnimeResults.vue`'s equivalent empty state); a
  failed search shows its own inline error without blocking the other groups
  (Local/Anime/Song), matching 49a's independent-per-group convention.
- Clicking an artist result opens a modal that resolves the full catalog via
  `POST /api/lookup/artist-import` (unchanged - already does the entire
  resolve/upsert server-side in one call, returning `{ artistName,
  animeGroups }` grouped by anime) and renders it grouped by anime title.
  - A resolve failure (artist not found, network error) shows an inline
    error inside the modal, matching `DeckAddAnimeModal.vue`'s existing
    `importError` handling.
  - A successful resolve with zero `animeGroups` (every entry's AniList
    lookup failed server-side and was skipped - a real possible outcome of
    `artist-import.post.ts`'s per-anime `continue`-on-failure loop) shows a
    "No importable anime found for this artist." state, matching
    `DeckAddAnimeModal.vue`'s existing "no themes found" pattern.
  - Already-added themes are pre-marked via `GET /api/cards/by-songs`
    immediately after resolving, before any Add button renders - the same
    safeguard every other add flow in this app already applies.
- Per-theme actions inside the modal, porting `CardAddAnimeResults.vue`'s
  theme-row treatment (not `DeckAddAnimeModal.vue`'s more minimal one - see
  Notes): an "Add" button (`POST /api/cards`); once added, an "Added" badge
  plus Preview (emits up to reuse `/cards`' existing single
  `CardPreviewModal`), Delete (`DELETE /api/cards`, reverts the row to
  addable), and per-source Download (video/audio, via the existing
  `useCardDownloads()` composable) exactly as that sibling group already
  does it. No local-video-path input - artist mode never had one, in either
  `DeckAddAnimeModal.vue` or `/cards/new.vue`'s own artist mode.
- Two bulk actions inside the modal, above the grouped list, porting
  `/cards/new.vue`'s existing `addAllArtistThemes`/`downloadAllArtistVideos`
  logic verbatim: **Add all** (sequential loop over every theme in every
  anime group, skipping any already marked "Added") and **Download all**
  (sequential, video-only, shown only once `hasDefaultDownloadFolder` is
  true and at least one added theme has a downloadable, not-yet-local
  video).
- After every individual successful add - a single "Add" click or one
  iteration inside "Add all" - emit `refresh` immediately so `/cards`' local
  list picks it up right away, matching the Anime/Song groups' per-add
  timing exactly (not batched to modal-close).
- Fix a genuine new stacking bug this step introduces: both the new modal
  and the page's existing `CardPreviewModal` register unconditional
  `window`-level `Escape` handlers (matching `DeckAddAnimeModal.vue:169-176`
  and `CardPreviewModal.vue:47-61` exactly as they exist today), so opening
  Preview from a row inside the new modal and pressing Escape once would
  close *both* in the same keystroke - silently discarding the artist
  modal's resolved catalog via its own close-triggered reset. Fix: thread
  the page's existing `previewCard !== null` state into the new component
  as a `preview-active` prop and gate its Escape handler on
  `!previewActive`, the same kind of one-handler-defers-to-another gating
  feature 36 used for `CardPreviewModal`'s own Escape vs. immersive mode.

## Out of scope

- Retiring `/cards/new` or rewiring any of its six existing entry points
  (NavBar's three query-param navigations, `/cards`' header/empty-state
  links, `/stats`'s and `/decks`'s empty-state links) - feature 49c.
- Any server-side change. `/api/lookup/artist-search`,
  `/api/lookup/artist-import`, `/api/cards`, `/api/cards/by-songs`, and
  `/api/decks/cards` (not used here - see below) all already exist and are
  reused exactly as they are.
- The pre-existing artist-import duplicate-add race already documented and
  accepted in feature 37b's own spec (a stale `by-songs` preload could in
  theory let "Add all" retry an already-carded song, which still just
  surfaces as a plain `addError` from `POST /api/cards`'s existing
  duplicate check, not a crash or silent double-card). Carried forward
  exactly as-is - not introduced or worsened here, and not fixed here
  either.
- `DeckAddAnimeModal.vue` itself is not modified - this generalizes its
  pattern into a new, separate component rather than refactoring the
  original (which stays deck-scoped, single-anime, no bulk actions, exactly
  as feature 33 left it).
- NavBar's own Artist search/result handling (feature 47, still navigates to
  `/cards/new?artistSlug=...`) and the deck-detail add flow (features 28/33)
  - unrelated surfaces, untouched.
- A local-video-path input for artist-mode themes, deck attachment
  (`POST /api/decks/cards`), or anything else `DeckAddAnimeModal.vue` and
  `/cards/new.vue`'s artist mode don't already have between them.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Artist search group + resolve modal with individual
  actions** - add `app/components/card/CardAddArtistResults.vue`: artist
  search (`GET /api/lookup/artist-search`, 2-char minimum, generation
  counter, watched on the `query` prop with `{ immediate: true }` - same
  shape as `CardAddAnimeResults.vue`/`CardAddSongResults.vue`). Clicking a
  result opens an in-component modal (backdrop/panel/Escape convention
  matching `DeckAddAnimeModal.vue`) that calls `POST /api/lookup/artist-import`
  and renders the returned `animeGroups` (grouped by anime title, themes
  listed under each), pre-marking added themes via
  `GET /api/cards/by-songs`. Each theme row ports
  `CardAddAnimeResults.vue`'s theme-row markup/logic (Add -> Added badge +
  Preview + Delete + per-source Download via `useCardDownloads()`), minus
  the local-path input. Wire the new component into
  `app/pages/cards/index.vue` as a fourth block, after `<CardAddSongResults>`
  and before `<CardPreviewModal>`, with the same `@refresh="loadFirstPage"`
  / `@preview="(card) => (previewCard = card)"` pattern the other two groups
  already use.
  *Done when:* searching a real artist name (2+ characters) shows an Artists
  group with matching rows; an unmatched query shows "No matching artists
  found."; clicking a result opens a modal listing every anime/theme
  animethemes.moe has for that artist, grouped by anime; a theme that
  already has a card shows "Added" immediately, with no click needed; adding
  a new theme creates a real card, the row switches to Added with working
  Preview/Delete/Download, and the new card appears in `/cards`' own local
  list without a page reload; a resolve failure or an artist with zero
  importable anime shows its own inline state instead of a blank modal.

- [x] **Step 2 - Add all / Download all** - inside the same modal, add two
  buttons above the grouped list, porting `/cards/new.vue`'s existing
  `addAllArtistThemes`/`downloadAllArtistVideos` logic: **Add all** loops
  every theme across every anime group sequentially, skipping any already
  marked "Added" (relies on Step 1's per-theme add function, whose existing
  internal try/catch already keeps one failure from stopping the rest of
  the loop - no new error handling needed). **Download all** is shown only
  once `hasDefaultDownloadFolder` is true and at least one added theme has a
  downloadable, not-yet-local video, and sequentially downloads each such
  theme via the same `useCardDownloads()` call Step 1's per-row buttons
  already use. Both buttons self-disable while running.
  *Done when:* "Add all" on an artist with several unadded themes adds every
  one of them - each appearing in `/cards`' local list as it's added, not
  only at the end - and does nothing to themes already marked "Added";
  "Download all" is absent until a default download folder is set and at
  least one added theme is remote-video-only, then downloads each such
  theme in sequence with the existing per-row progress bar.

- [x] **Step 3 - Preview/Escape stacking fix + cross-group verification** -
  pass `:preview-active="previewCard !== null"` from
  `app/pages/cards/index.vue` into `<CardAddArtistResults>`, and gate the
  new modal's `Escape` handler on `!props.previewActive` so a stacked
  Preview modal owns the keystroke instead of both modals closing at once.
  No other new code - verify by inspection and live search that the Artists
  group is independent of Local/Anime/Song exactly as 49a's own Step 3
  verified for its two groups.
  *Done when:* with the artist modal open and a theme's Preview also open on
  top of it, pressing Escape once closes only the Preview modal, leaving the
  artist modal's resolved catalog and added-state exactly as they were;
  throttling or failing the artist search doesn't block the other three
  groups from rendering; `bun run build` passes.

## Files / areas

- `app/components/card/CardAddArtistResults.vue` (new) - search rows +
  resolve-and-bulk-add modal, kept in one file matching how
  `CardAddAnimeResults.vue` already keeps its own inline theme-picker
  alongside its search in one file rather than splitting into two
  components. Folder stays singular `card/` (matching `CardAddAnimeResults`,
  `CardAddSongResults`, `CardPreviewModal`) - required for Nuxt's
  prefix-stripping auto-import to register it as `<CardAddArtistResults>`
  rather than double-prefixing.
- `app/pages/cards/index.vue` - one new template block (Step 1) plus one new
  prop binding, `preview-active` (Step 3).

No server-side files change - `/api/lookup/artist-search`,
`/api/lookup/artist-import`, `/api/cards`, `/api/cards/by-songs`, and
`DELETE /api/cards` all already exist and are used as-is.

## Data / contracts

None new. Reuses existing response shapes unchanged:

- `ArtistCandidate` (`{ id, name, slug }`) from
  `GET /api/lookup/artist-search`.
- `ArtistImportResult` from `POST /api/lookup/artist-import`:
  `{ artistName: string; animeGroups: { anime: { id, aniListId,
  animethemesId, titleEnglish, titleRomaji, titleNative }; themes: {
  songId, themeSlot, songTitle, videoUrl, audioUrl }[] }[] }`.
- `CardWithDetails`, `GET /api/cards/by-songs`, `POST /api/cards`,
  `DELETE /api/cards` - identical to every other add-candidate group.

This project has no shared `app/types/` module (confirmed still true as of
49a) - define local interfaces in the new component rather than importing
or introducing a shared types file, matching `CardAddAnimeResults.vue`,
`CardAddSongResults.vue`, `cards/new.vue`, and `DeckAddAnimeModal.vue`, each
of which already redeclares the same shapes independently.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command), so this
rides on browser and build evidence, matching 49a - this is a UI/integration
feature (search, modal, network calls), not new pure logic.

Manual/browser verification path:

- Search an artist with a small, known catalog (2+ characters) -> confirm
  an Artists group appears with matching rows, independent of whatever the
  Local/Anime/Song groups show for the same query.
- Open a result whose catalog includes a theme you already have a card for
  -> confirm that theme shows "Added" immediately, other themes stay
  addable.
- Add one theme individually -> confirm Preview/Delete/Download appear on
  that row and the card shows up in `/cards`' local list without reloading.
- Click "Add all" -> confirm every not-yet-added theme across every anime
  group gets added, previously-added ones are untouched, and the local list
  grows incrementally.
- With a default download folder set, click "Download all" -> confirm only
  video-remote, not-yet-local, added themes download, sequentially, with
  the existing progress bar.
- Open a theme's Preview from inside the artist modal, then press Escape
  once -> confirm only Preview closes, the artist modal stays open with its
  state intact.
- Search an artist slug that fails to resolve (or throttle the network) ->
  confirm the modal shows an inline error/empty state and the other three
  search groups keep working.
- `bun run build` must pass.

## Notes for the AI

- Reuse `/cards`' *existing* debounce driving `searchQuery` - do not add a
  second independent debounce for the artist fetch, matching 49a's own
  instruction for the Anime/Song groups.
- The 2-character minimum matches the other two add-candidate groups and
  NavBar's own search convention.
- Preview + Delete on an added row is a deliberate choice to match
  `CardAddAnimeResults.vue`'s (49a, the freshest sibling) fuller per-row
  treatment rather than `DeckAddAnimeModal.vue`'s more minimal
  Added-badge-only one - both are defensible reads of "the same bulk
  actions `/cards/new`'s artist mode has today" (which itself already has
  Preview/Delete on artist-mode rows), but flagging the call explicitly
  since it's the one place this spec adds a little more than the bare
  build-plan line names.
- If the combined search-rows-plus-modal file grows unwieldy, splitting the
  modal into its own child component (e.g. `CardAddArtistModal.vue`, taking
  `selectedArtist`/`open` as props) is an acceptable implementation-time
  call, not a requirement of this spec - `CardAddAnimeResults.vue` sets the
  one-file precedent, but that file is already 557 lines before this
  feature adds anything.
- Match `DeckAddAnimeModal.vue`'s backdrop/panel/z-index/Escape CSS
  conventions for the new modal, with the one deliberate deviation being
  the `previewActive`-gated Escape in Step 3.
- Keep `/cards/new.vue`, `NavBar.vue`, and the deck-detail add flow
  completely unchanged - still out of scope until 49c.
- "Added" is a persistent badge state, not a row removal, matching every
  other add flow in this app.
