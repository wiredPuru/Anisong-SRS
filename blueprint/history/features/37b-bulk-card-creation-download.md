# Feature: Bulk card creation + download

**From build-plan:** feature 37b
**Status:** verified

## Goal

Turn 37a's read-only artist theme preview into something actionable: "Add
all" (plus per-row "Add") to create a `Card` per theme, and "Download all"
to pull video for every added card, reusing feature 8's existing download
machinery. This completes feature 37 (bulk artist import).

## In scope

- **Per-row "Add"** on each theme in the artist preview (37a's
  `selectedArtist.animeGroups[].themes`), creating a `Card` via the
  existing `POST /api/cards` - no new server route needed, it already
  accepts `{ songId, animethemesVideoUrl?, animethemesAudioUrl? }` exactly
  as the anime-search flow's `addCard()` already sends. `addCard`'s
  parameter type is widened from `ThemeResult` to a small structural shape
  (`{ songId, videoUrl, audioUrl }`) both `ThemeResult` and 37a's
  `ArtistThemeResult` already satisfy, so the **exact same function** is
  reused for both flows - no duplicated add logic, no new state
  dictionaries (`addedCards`/`adding`/`addError` stay keyed by `songId`,
  which is already globally unique across both flows).
- **Added-card state on artist rows** - badge, "Preview", "Delete", and
  per-source "Download video"/"Download audio" buttons with progress -
  reusing the exact same shared state (`addedCards`, `downloading`,
  `downloadProgress`, `downloadError`, `canDownload`,
  `hasAnyDownloadableSource`, `downloadMedia`, `previewCard`,
  `removeCard`) the anime flow's added-state block already uses, so an
  artist-added card behaves identically to an anime-added one everywhere
  else in the app (Preview, Delete, per-card download all keep working
  unchanged).
- **"Add all"** button above the grouped preview list: loops every theme
  across every anime group, skips any `songId` already in `addedCards`
  (so re-clicking after a partial add, or after some rows were added
  individually, doesn't create duplicate `Card` rows for the same song -
  `Card` has no DB-level uniqueness on `songId`), calls the same
  `addCard()` per theme. One theme's failure doesn't stop the rest -
  `addCard` already catches its own errors into `addError[songId]` and
  never throws, so the loop naturally continues.
- **"Download all"** button (shown only once `hasDefaultDownloadFolder` is
  true, matching the existing per-card download gating): loops every
  *added* card that has a downloadable video not yet local
  (`canDownload(card, 'video')`), calling the existing `downloadMedia()`
  **sequentially** (one at a time, not parallel) - reuses the per-row
  download progress bar that's already part of the added-state block, so
  no new progress UI is needed; the user watches each row's own bar
  advance in turn.
- Both bulk buttons disable themselves while running and are hidden/
  disabled when there's nothing to do (no themes at all for "Add all";
  no added-and-downloadable cards for "Download all").

## Out of scope

- **Bulk audio download** - "Download all" is video-only, matching the
  original feature note's own wording ("include an option to download the
  video"). Per-card audio download stays available individually via the
  existing added-state buttons, unchanged.
- **Manual local-file path entry for artist-added themes** - the
  anime-flow's per-theme "not yet added" state has a local-path text input
  for attaching an already-downloaded file before creating the card; the
  artist-flow's per-row "Add" skips this (just an "Add" button, remote
  sources only) since bulk import's whole point is speed, and a manual
  per-row path field for a list that might have 20+ rows works against
  that. A user who wants a specific local file for one artist-imported
  card can still set it afterward via `/cards`' existing row edit.
- **Parallel/concurrent bulk downloads** - sequential only, both to keep
  the existing per-row progress UI meaningful (one active bar at a time
  makes sense; N simultaneous bars sharing one "Download all" button
  wouldn't clearly attribute progress) and to avoid saturating the user's
  own bandwidth with many large simultaneous video downloads.
- **Deduplicating against cards that already exist from a prior session**
  (added client-side state (`addedCards`) resets on page reload, so
  revisiting `/cards/new` and re-importing the same artist could
  technically re-add already-existing songs) - this is a pre-existing gap
  the anime-search flow already has today (unaffected, unchanged by this
  feature); not introduced or worsened here, and not fixed here either.
- Any change to 37a's search/resolve flow, or the anime-search flow's own
  code paths - purely additive on top of the existing per-row template
  shape.

## Build steps

- [x] **Step 1 - client: per-row "Add" on the artist preview**
  - Widened `addCard`'s parameter type from `theme: ThemeResult` to
    `theme: { songId: number; videoUrl: string | null; audioUrl: string |
    null }` - a structural subset both `ThemeResult` and `ArtistThemeResult`
    already satisfy, no call-site changes needed for the anime flow.
  - Artist preview's per-theme row gained the same two-state block the
    anime flow's `theme-row` has: added state renders the existing markup
    verbatim (badge, Preview, Delete, per-source download buttons/
    progress); not-added state is a single "Add" button (no local-path
    input).
  - Verified live: simulated the exact request `addCard()` sends against a
    real theme (Lynn / Sabagebu! ED1) via `POST /api/cards` - created a
    correctly-attributed card, confirmed via `GET /api/cards?q=...`,
    deleted the test card afterward.

- [x] **Step 2 - client: "Add all"**
  - Added `addingAllForArtist` and `addAllArtistThemes()`: sequential
    `for...of` loop over every theme across every anime group, skipping
    any `songId` already in `addedCards`, calling `addCard(theme)` for the
    rest.
  - Added the "Add all" button above the grouped list.
  - Verified live against a real 21-anime, 35-theme catalog (Yuu
    Serizawa): added two themes sequentially with distinct card IDs, then
    deliberately re-added the first theme's `songId` a second time to
    confirm the server has **no** protection against duplicate cards per
    song - proving the client-side `addedCards` skip check is load-bearing,
    not decorative. All 3 test cards deleted afterward.

- [x] **Step 3 - client: "Download all"**
  - Added `downloadingAllForArtist`, `hasDownloadableAddedVideos()` (gates
    button visibility), and `downloadAllArtistVideos()`: sequential loop
    skipping themes with no added card or no downloadable/not-yet-local
    video, calling the existing `downloadMedia(songId, 'video')`.
  - Added the "Download all" button, shown only when
    `hasDefaultDownloadFolder` is true and something is eligible.
  - Verified live end-to-end: created a real test card, streamed a full
    57.4MB video through the actual `POST /api/cards/download` endpoint,
    confirmed the file landed at the configured default folder and the
    card's `localVideoPath` was set. Deleted the card afterward and
    confirmed feature 17's existing cleanup correctly removed the
    downloaded file too - no leftover test data or files.

## Files / areas

- `nuxt-app/app/pages/cards/new.vue` - `addCard`'s parameter type widened;
  the artist preview's per-row rendering gains the added/not-added states;
  two new bulk actions (`addAllArtistThemes`, `downloadAllArtistVideos`)
  and their buttons. No other file changes - `POST /api/cards` and the
  download machinery (`useCardDownloads`, `/api/cards/download`) are
  reused unchanged.

## Data / contracts

No new types or routes. Reuses `POST /api/cards` (feature 4) and the
existing download pipeline (feature 8) exactly as the anime-search flow
already does. `ArtistImportResult`/`ArtistThemeResult` (locked in 37a) are
consumed, not changed.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command). Every
change in this feature is UI wiring reusing already-existing, already-
working functions (`addCard`, `downloadMedia`, `removeCard`) - no new pure
logic to isolate. Verified against real infrastructure (the actual DB,
filesystem, and download endpoint) rather than mocks, with every test
artifact cleaned up afterward, plus `bun run build` at every step.
