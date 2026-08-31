# Feature: Artist search + theme resolution

**From build-plan:** feature 37a
**Status:** verified

## Goal

Add a "search by artist" mode to `/cards/new`, alongside the existing
"search by anime" flow. Given an artist name, find them on animethemes.moe,
resolve every anime they have themes in via AniList, and show a read-only
preview of every song/theme found, grouped by anime. No `Card` rows are
created yet - that's feature 37b's job, built on top of this preview.

This is the first of feature 37's two sub-features (bulk artist import).

## In scope

- **animethemes.moe artist search** - `server/lib/animethemes.ts` gains
  `searchArtistsOnAnimeThemes(query)`, using `artistPagination(search:
  $search, first: 10) { data { id name { main } slug } }` (verified live
  against the real API: `search: "Kotoko"` returns KOTOKO plus a few loose
  matches like group members - it's a fuzzy match, so this returns
  candidates for the user to pick from, exactly like the existing AniList
  anime search does, not an auto-pick of the first result).
- **`GET /api/lookup/artist-search?q=...`** - thin wrapper returning
  `{ results: { id, name, slug }[] }`, mirroring
  `anilist-search.get.ts`'s shape.
- **animethemes.moe theme resolution** - `animethemes.ts` gains
  `fetchArtistThemesBySlug(slug)`, using the artist's `performances -> song
  -> animethemes -> anime -> resources(site: ANILIST, first: 1)` relation
  chain (verified live: `artist(slug: "kotoko")` returns 28 performances,
  every one resolving to a real AniList id via `resources.nodes[0]
  .externalId`). Returns a flat list of theme entries, each carrying its
  anime's AniList id, romaji title (for display before the AniList
  round-trip), theme slot, song title (romaji + native), and video/audio
  URLs (`animethemeentries(first: 1) { videos(first: 1) { nodes { link
  audio { link } } } }`, same shape `fetchAnimeThemesByAniListId` already
  uses).
- **`POST /api/lookup/artist-import`** - body `{ artistSlug: string }`.
  Dedupes the resolved theme entries by anime AniList id, then for each
  unique anime: `fetchAnimeFromAniList` + `upsertAnime` (same pipeline
  `import.post.ts` already uses for a single picked anime), then for every
  theme entry on that anime: `getOrCreateArtist(artistName)` +
  `upsertSong` (using the confirmed searched-artist name directly - no
  "Unknown Artist" fallback needed, since the artist is already known from
  the search step, unlike the anime-search flow where the artist is only
  discovered per-theme). Returns a grouped-by-anime shape (locked contract
  below) that 37b will consume to add the actual "Add" controls.
  - **Per-anime failure isolation, not per-import.** If `fetchAnimeFromAniList`
    fails for one of the unique anime (returns `null`, or throws - e.g. a
    404, a rate limit, or a network error), skip only that anime's themes
    and continue with the rest - this intentionally differs from
    `import.post.ts`'s single-anime flow, which throws for the one anime
    it's given. A 20-anime bulk import can't abort entirely because one
    entry doesn't resolve. (Verified live: re-running the import tripped
    AniList's real rate limit mid-build, which throws rather than
    returning `null` - the first implementation only caught the `null`
    case and crashed the whole request; fixed with a try/catch around the
    AniList call.)
  - **Themes with no linked AniList anime are silently skipped** (not shown,
    not an error) - matches the app's existing degrade-gracefully
    convention (a missing local file, a failed lookup) rather than
    surfacing a per-theme error in a bulk preview.
- **Client: mode toggle on `/cards/new`** - "By anime" / "By artist" toggle
  buttons above the search form (same toggle-button pattern `/decks` already
  uses for Artist/Anime/Created). Switching modes clears both flows' state.
  The existing anime-search flow (search form, results, `selectedAnime`,
  `themes-section`) is completely untouched code - only conditionally
  rendered now.
- **Client: artist search form + candidate list** - same shape as the
  existing anime search (input, "Search" button, result rows with a
  "Select" button), listing `{ name, slug }` candidates.
- **Client: read-only theme preview, grouped by anime** - after selecting an
  artist, call `artist-import` and render one section per anime (title +
  its theme rows: song title, theme slot). No "Add"/download controls yet -
  that's 37b, built directly on top of this same preview list.

## Out of scope

- Creating any `Card` row, or any per-row/bulk "Add" control - all of 37b.
- Bulk video download - 37b, reuses feature 8's existing download
  machinery once cards exist.
- `memberPerformances` (themes where the searched name appears only as a
  member of a *different* credited group/artist) - only the artist's own
  direct `performances` are resolved. A future feature if this turns out to
  matter in practice.
- Pagination on the resolve query - `performances` is a plain list field
  (not a paginated connection per the live schema), so a very prolific
  artist's full catalog comes back in one response. Not engineered around
  for this feature; revisit only if it proves to be a real problem.
- Any change to the existing anime-search flow's code paths, UI, or API
  routes - purely additive.
- Deduplicating against cards that may already exist for some of these
  songs (e.g. an anime already added via the regular flow) - moot for 37a
  (no cards created here at all); 37b inherits `upsertSong`'s existing
  idempotent-on-`(animeId, themeSlot)` behavior for free, same as the
  anime-search flow already relies on.

## Build steps

- [x] **Step 1 - server: artist search**
  - `server/lib/animethemes.ts`: added `AnimeThemesArtistCandidate` and
    `searchArtistsOnAnimeThemes(query)`, posting the
    `artistPagination(search: $search, first: 10) { data { id name { main }
    slug } }` query with the same `USER_AGENT` header and error-handling
    shape as `fetchAnimeThemesByAniListId`.
  - `server/api/lookup/artist-search.get.ts`: reads `q`, 400s if
    missing/blank, calls `searchArtistsOnAnimeThemes`, returns `{ results }`.
  - Verified live: `GET /api/lookup/artist-search?q=Kotoko` returned real
    candidates including KOTOKO/kotoko; blank/missing `q` both 400.

- [x] **Step 2 - server: artist theme resolution + import**
  - `server/lib/animethemes.ts`: added `ArtistThemeEntry`/
    `ArtistThemesResult` and `fetchArtistThemesBySlug(slug)`, posting the
    verified nested `artist(slug:).performances -> song -> animethemes ->
    anime -> resources(site: ANILIST)` query (also carries the anime's own
    `animethemesId`, needed so `upsertAnime` doesn't clobber an existing
    anime's real value with `null`). Skips any theme with no linked AniList
    anime.
  - `server/api/lookup/artist-import.post.ts`: validates `artistSlug`,
    404s if the artist isn't found, dedupes entries by AniList anime id,
    then per unique anime resolves via AniList, upserts `Anime`, and
    upserts a `Song` per theme. Per-anime AniList failures (including
    thrown exceptions, not just `null`) are caught and skip just that
    group.
  - Verified live against the real KOTOKO catalog: 23 anime groups from 28
    themes, correct grouping (Kannazuki no Miko's OP1+ED1 under one group),
    idempotent re-import (identical `songId`s), and a second artist
    ("Lynn") to confirm it wasn't a one-artist fluke.

- [x] **Step 3 - client: mode toggle + artist search UI**
  - `cards/new.vue`: added `searchMode` ref, a `.toggle`/`.toggle-btn`
    pair (CSS copied from `/decks`' established pattern) gating the
    existing anime-search markup vs. a new parallel artist-search form,
    `artistSearch()` mirroring `search()`, and `setSearchMode()` to reset
    both flows on switch.
  - Verified: `bun run build` passes; SSR confirms the toggle renders with
    the anime-search flow showing by default and completely unchanged.

- [x] **Step 4 - client: read-only artist theme preview**
  - Added `selectedArtist`/`artistImporting`/`artistImportError` and
    `selectArtist(candidate)` mirroring `selectAnime()`. Wired the
    candidate row's "Select" button. Rendered `animeGroups` as one
    `.theme-list` section per anime, reusing existing CSS, no action
    buttons (that's 37b).
  - Verified: `bun run build` passes; SSR clean; re-confirmed the
    `POST /api/lookup/artist-import` contract end-to-end.

## Files / areas

- `nuxt-app/server/lib/animethemes.ts` - two new exported functions/types
  (`searchArtistsOnAnimeThemes`, `fetchArtistThemesBySlug`); existing
  `fetchAnimeThemesByAniListId` untouched.
- `nuxt-app/server/api/lookup/artist-search.get.ts` - new.
- `nuxt-app/server/api/lookup/artist-import.post.ts` - new.
- `nuxt-app/app/pages/cards/new.vue` - mode toggle, artist search state +
  UI, artist theme preview. Existing anime-search script/template
  untouched, just conditionally rendered.

## Data / contracts

Load-bearing for 37b:

```ts
interface ArtistImportResult {
  artistName: string;
  animeGroups: {
    anime: {
      id: number;
      aniListId: number;
      animethemesId: number | null;
      titleEnglish: string;
      titleRomaji: string;
      titleNative: string;
    };
    themes: {
      songId: number;
      themeSlot: string;
      songTitle: string;
      videoUrl: string | null;
      audioUrl: string | null;
    }[];
  }[];
}
```

No schema changes - reuses `Anime`/`Artist`/`Song` and their existing
`upsertAnime`/`getOrCreateArtist`/`upsertSong` helpers unchanged.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command). The new
logic is mostly thin API-client/wrapper code (matching the existing
untested `anilist.ts`/`animethemes.ts` pattern) plus the dedupe-by-anime
loop in `artist-import.post.ts` - a fair backfill candidate for a focused
unit test once `/tests` sets up a runner, but not blocking this feature per
the testing gate. Exercised directly against the real animethemes.moe/
AniList APIs during both spec-writing and implementation, plus a manual
browser pass for the client steps.
