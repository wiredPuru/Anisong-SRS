# Feature: AnisongDB song and artist search

**From build-plan:** feature 60b
**Status:** verified

## Goal

Move `/cards`' Song and Artist add-candidate groups, the nav bar's Artists
group, and the bulk artist catalog import off animethemes.moe and onto
AnisongDB, with animethemes.moe kept as the silent fallback. 60a did this for
the anime import path; these are the remaining live-search surfaces, and they
are the ones a keystroke hits.

Measured on 2026-09-13 from this machine:

| Call | animethemes.moe | AnisongDB |
|---|---|---|
| Artist search ("LiSA") | 0.61 - 0.73s | 0.22 - 0.35s |
| Song search ("Gurenge") | ~0.75s (60a measurement) | 0.25s |
| Artist catalog (LiSA, 34 themes) | not reliably answered during probing | 0.22 - 0.49s |

## In scope

- `server/lib/anisongdb.ts`: two new exported calls on the existing client.
  - `searchSongs(query)` via `POST /api/search_request` with a
    `song_name_search_filter`.
  - `searchArtists(query)` and `fetchArtistCatalog(artistId)` via
    `POST /api/search_request` with an `artist_search_filter` and
    `POST /api/artist_ids_request`.
- Server-side relevance ranking and truncation for song search. AnisongDB
  returns up to 500 unranked entries (a 640KB payload for "love"); the current
  animethemes.moe route returns a relevance-ordered top 10.
- A provider-neutral row key on song results, replacing the
  `animethemesThemeId` an AnisongDB result cannot supply.
- A provider-tagged artist candidate, replacing the animethemes.moe `slug` an
  AnisongDB artist does not have.
- Repointing `/api/lookup/song-search`, `/api/lookup/artist-search`, and
  `/api/lookup/artist-import` at AnisongDB, each falling back to today's
  animethemes.moe path on `ProviderUnavailableError`.
- A best-effort animethemes.moe metadata overlay on the AnisongDB artist
  catalog, so artist-imported songs keep their native Japanese titles
  (feature 30) and their `animethemesThemeId`.
- Loosening `/api/lookup/song-import`'s request validation so an AnisongDB
  result, which carries neither `animethemesThemeId` nor `animeAnimethemesId`,
  is accepted.
- Client type updates in `CardAddSongResults.vue`,
  `CardAddArtistResults.vue`, and `NavSearch.vue` to match the new shapes.

## Out of scope

- Existing cards keep their stored animethemes.moe URLs. That is 60c.
- `/api/lookup/anilist-search` and `/api/lookup/anilist-list` /
  `/api/lookup/mal-list`. Those are anime-title and user-list lookups, not
  OP/ED metadata, and AnisongDB is not a better source for them.
- Insert songs, still filtered out. `Song` is unique on `(animeId, themeSlot)`
  and has no slot for a non-OP/ED track (60a's decision, unchanged).
- Composer search. AnisongDB offers it; the app has no composer concept.
- No new settings, no schema migration, no new columns. Same as 60a: the
  preference is automatic with silent fallback, because the only difference
  between the providers is speed.
- No UI or layout changes. The three groups keep their current markup, states,
  and bulk actions; only the data behind them moves.
- No shared REST helper extracted across `mal.ts` and `anisongdb.ts`. Still an
  unrelated refactor (60a's call, unchanged).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - AnisongDB song search with ranking** - add
  `searchSongs(query)` to `server/lib/anisongdb.ts`, posting
  `{ song_name_search_filter: { search, partial_match: true },
  filters: { song_types: ["opening", "ending"] }, ignore_duplicate: true }` to
  `POST /api/search_request` through the existing `postMalIds` failure
  classification (extract it into a shared `postJson(path, body)` that both
  calls use). Reuse the existing `toThemeSlot`, `mediaUrl`, and `rank` mappers.
  Drop entries with no `linked_ids.anilist`, no usable media, `isDub: true`, or
  a non-OP/ED `songType`. Rank the survivors before truncating to 10: exact
  normalized title match, then prefix match, then substring, then `annSongId`
  ascending as a stable tie-break. Not wired into any route yet. *Done when:*
  `bun run test` passes with colocated tests covering the ranking order,
  the 10-result cap, each rejection rule, and that the shared `postJson`
  still classifies network error, timeout, 403, 429, 5xx, other non-ok,
  and unparseable JSON exactly as before.

- [x] **Step 2 - Provider-neutral song result key (pure rename)** - rename
  `SongSearchEntry.animethemesThemeId` to `resultKey: string` across
  `server/lib/animethemes.ts`, `/api/lookup/song-search`, and
  `CardAddSongResults.vue` (roughly 25 reference sites, all mechanical), and
  add `animethemesThemeId: number | null` as a separate carried field.
  animethemes.moe builds `resultKey` as `` `at:${theme.id}` ``. No behavior
  change, no new provider yet: this step exists purely so step 3's diff is
  about behavior rather than a rename. *Done when:* `bun run build` and
  `bun run test` pass; searching a song on `/cards` behaves exactly as before
  (results list, Add, Added badge, Preview, Delete, per-row download).

- [x] **Step 3 - Repoint song search at AnisongDB** - `/api/lookup/song-search`
  calls `searchSongs` first and falls back to `searchSongsOnAnimeThemes` on
  `ProviderUnavailableError` only (a `ProviderRequestError` still surfaces).
  AnisongDB results use `` `adb:${annSongId}` `` as `resultKey`, with
  `animethemesThemeId: null`, `songTitleNative: null`, and no
  `animeAnimethemesId`. Loosen `/api/lookup/song-import`'s validation: require
  `animeAniListId` and `themeSlot`, accept `animethemesThemeId` as a number or
  null/absent, and make `animeAnimethemesId` optional (pass
  `aniListAnime.animethemesId ?? body.animeAnimethemesId ?? null` into
  `upsertAnime`, which already drops a null `animethemesId` from its update
  set). *Done when:* a song search on `/cards` returns results noticeably
  faster than before; adding one creates a card whose remote URLs are on
  `naedist.animemusicquiz.com` and which plays in Preview; a test covers the
  fallback firing on `ProviderUnavailableError`, not firing on
  `ProviderRequestError`, and `song-import` accepting a request with no
  `animethemesThemeId` and no `animeAnimethemesId`.

- [x] **Step 4 - AnisongDB artist search** - add `searchArtists(query)` to the
  client, posting an `artist_search_filter` to `POST /api/search_request` and
  reducing the returned song entries to distinct artists from their `artists[]`
  arrays, keeping only those whose name actually matches the query (a partial
  artist match returns collaborators too: "LiSA" returned 37 distinct artists
  across 99 entries, including `m-flo` and `Hyadain`). Rank by exact, then
  prefix, then substring, then entry count descending; cap at 10. Widen the
  candidate contract to `{ source: "anisongdb" | "animethemes"; id: number;
  name: string; slug: string | null }` in a new `server/utils/artistSource.ts`,
  have `/api/lookup/artist-search` return that shape, and update the duplicated
  `ArtistCandidate` interface in both `CardAddArtistResults.vue` and
  `NavSearch.vue`.
  **Revised during implementation:** the search stays AnimeThemes-backed here
  and the flip to AnisongDB moves to step 6. `CardAddArtistResults.vue` posts
  `{ artistSlug: candidate.slug }`, so serving AnisongDB candidates (which have
  no slug) before the import can resolve them would leave artist import
  returning 400 for two whole steps, breaking the "every step leaves the app
  working" rule. `searchArtists` lands here tested but unwired, exactly as
  step 1's `searchSongs` did.
  *Done when:* typing an artist name in `/cards`' search and in the nav bar
  dropdown returns the same names as before, now carrying `source` and a
  nullable `slug`; opening an artist still imports its catalog; `bun run test`
  passes with tests for the collaborator filter, the ranking order, and the cap.

- [x] **Step 5 - AnisongDB artist catalog** - add
  `fetchArtistCatalog(artistId)` (`POST /api/artist_ids_request`, OP/ED only,
  `ignore_duplicate: true`), returning one entry per theme with its AniList id,
  slot, song title, artist name, and clip URLs. Add a resolver in
  `server/utils/artistSource.ts` that takes an `ArtistCandidate` and returns
  today's `ArtistThemesResult` shape, widened so `animethemesThemeId`,
  `animeAnimethemesId` and `songTitleNative` are nullable. An `animethemes`
  candidate takes today's path unchanged.

  **The AnimeThemes metadata overlay was built, measured, and dropped by user
  decision (2026-09-13).** This spec added it during its own red-team pass to
  protect feature 30's native Japanese song titles. Live measurement showed
  AnimeThemes carries a native song title for **4 of 113** sampled artist
  themes and **0 of 54** sampled anime themes, while the overlay cost a serial
  artist-search hop plus a catalog fetch: catalog resolution measured 427ms
  (AnisongDB alone), 2626ms (AnimeThemes, today), and 3819-6263ms with the
  overlay, so it was slower than the path it replaced. The two ids it also
  recovered, `animethemesThemeId` and `animeAnimethemesId`, are written and
  round-tripped by deck export but never read to make a decision. An
  AnisongDB-sourced artist theme therefore stores null for all three;
  `Song.titleNative` falls back to the romaji title, which is already what
  Study and Preview display for ~96% of songs.
  *Done when:* `bun run test` passes with tests for the AnisongDB catalog path,
  an AnisongDB outage surfacing rather than emptying the catalog, an
  `animethemes` candidate still using the old path and never touching
  AnisongDB, and the candidate validator.

- [x] **Step 6 - Wire the resolver into `/api/lookup/artist-import`** - the
  route accepts the whole `ArtistCandidate` in its body instead of a bare
  `artistSlug`, validates it, and calls the step 5 resolver; the existing
  per-anime AniList resolution loop, `respondWithImportProgress` reporting,
  `unavailableAnimeCount` handling, and response shape are unchanged.
  `CardAddArtistResults.vue` posts `candidate` instead of
  `{ artistSlug: candidate.slug }`. **Also flips `searchArtistCandidates` to
  AnisongDB-first with the `ProviderUnavailableError` fallback** (moved here
  from step 4, see that step's note), since this is the first point at which
  the import can resolve an AnisongDB candidate. *Done when:* opening an artist from
  `/cards`' Artist group lists the same anime groups as before with a working
  progress readout; Add, Add all, and Download all still work; an added
  theme's card has `naedist.animemusicquiz.com` URLs and plays; its Japanese
  song title still shows in Preview with the Japanese toggle on; a test covers
  the route rejecting a malformed candidate.

- [x] **Step 7 - Full verification pass** - run the manual path in Testing
  below end to end, plus `bun run test` and `bun run build`. *Done when:*
  every manual check passes and both commands are green.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/lib/anisongdb.ts` | `postJson` extraction, `searchSongs`, `searchArtists`, `fetchArtistCatalog` |
| `nuxt-app/server/lib/anisongdb.test.ts` | Steps 1, 4, 5 coverage |
| `nuxt-app/server/lib/animethemes.ts` | `SongSearchEntry.resultKey` rename (step 2) |
| `nuxt-app/server/api/lookup/song-search.get.ts` | AnisongDB first, animethemes fallback |
| `nuxt-app/server/api/lookup/song-import.post.ts` | Accepts a result with no animethemes ids |
| `nuxt-app/server/api/lookup/artist-search.get.ts` | AnisongDB first, animethemes fallback |
| `nuxt-app/server/api/lookup/artist-import.post.ts` | Takes a candidate, calls the resolver |
| `nuxt-app/server/utils/artistSource.ts` (new) | Catalog resolver plus the metadata overlay |
| `nuxt-app/server/utils/artistSource.test.ts` (new) | Step 5 coverage |
| `nuxt-app/server/utils/themeSource.ts` | Export `titleKey` for reuse |
| `nuxt-app/app/components/card/CardAddSongResults.vue` | `resultKey` rename |
| `nuxt-app/app/components/card/CardAddArtistResults.vue` | Candidate shape, posts the candidate |
| `nuxt-app/app/components/nav/NavSearch.vue` | Candidate shape (uses `id` and `name` only) |

## Data / contracts

**Load-bearing, consumed by 60c and by every add-candidate surface.**

```ts
// server/lib/animethemes.ts - SongSearchEntry, widened
interface SongSearchEntry {
  resultKey: string;                  // "at:<themeId>" or "adb:<annSongId>"; the client's row identity
  animethemesThemeId: number | null;  // null for an AnisongDB result
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;     // AnimeThemes only
  artistName: string | null;
  animeAniListId: number;
  animeAnimethemesId: number | null;  // null for an AnisongDB result
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

// Artist candidate, returned by /api/lookup/artist-search and posted back to
// /api/lookup/artist-import
interface ArtistCandidate {
  source: "anisongdb" | "animethemes";
  id: number;                         // AnisongDB artist id, or the AnimeThemes artist id
  name: string;
  slug: string | null;                // AnimeThemes only; AnisongDB has no slug
}

// server/utils/artistSource.ts - today's ArtistThemesResult, widened
interface ResolvedArtistThemes {
  artistName: string;
  entries: {
    animethemesThemeId: number | null;  // was non-null
    themeSlot: string;
    songTitle: string | null;
    songTitleNative: string | null;
    animeAniListId: number;
    animeAnimethemesId: number | null;  // was non-null
    animeTitleRomaji: string;
    videoUrl: string | null;
    audioUrl: string | null;
  }[];
}
```

`/api/lookup/artist-import`'s **response** shape (`{ artistName, animeGroups,
unavailableAnimeCount }`) does not change. Only its request body does.

AnisongDB endpoints, verified live 2026-09-13:

```
POST https://anisongdb.com/api/search_request
{ "song_name_search_filter": { "search": "Gurenge", "partial_match": true },
  "filters": { "song_types": ["opening", "ending"] }, "ignore_duplicate": true }

POST https://anisongdb.com/api/search_request
{ "artist_search_filter": { "search": "YOASOBI", "partial_match": true },
  "filters": { "song_types": ["opening", "ending"] }, "ignore_duplicate": true }

POST https://anisongdb.com/api/artist_ids_request
{ "artist_ids": [8355], "ignore_duplicate": true,
  "filters": { "song_types": ["opening", "ending"] } }
```

All three return an array of the same `SongEntry` shape `mal_ids_request`
already returns, plus an `artists: [{ id, names[], line_up_id, groups,
members }]` array. No `limit` parameter exists; the server caps responses at
500 entries, unranked.

No schema migration. `Card.animethemesVideoUrl` / `animethemesAudioUrl` keep
holding a URL from either provider.

**Behavior change to accept:** AnisongDB's artist catalog includes a solo
artist's group work. `artist_ids_request` for Lilas Ikuta (id 21301) returns 16
entries including YOASOBI's, at every `group_granularity` value. Feature 37a
deliberately walked only animethemes.moe's direct `performances`, never
`memberPerformances`, so a member's group songs did not appear. Reading this as
an improvement (an artist's catalog should include their group), but it is a
visible change to what an artist import produces and is flagged here rather
than buried.

## Testing

Vitest is configured (`bun run test` from `nuxt-app/`), so the logic-test gate
is on. In-scope logic that must ship a test with its step:

| Step | Logic needing a test |
|---|---|
| 1 | Song ranking order, 10-cap, each rejection rule, shared `postJson` failure classification |
| 2 | None (pure rename); existing tests must stay green |
| 3 | Fallback on `ProviderUnavailableError` but not `ProviderRequestError`; `song-import` accepting absent animethemes ids |
| 4 | Collaborator filtering, artist ranking, cap, fallback |
| 5 | Overlay pairing, unpaired title, slug lookup miss, animethemes unavailable, animethemes candidate path |
| 6 | Route rejecting a malformed candidate |

Mock `fetch` with `vi.mock` / `vi.stubGlobal`, as `anisongdb.test.ts` already
does. Do not call either live API from a test.

Manual path, with `bun run dev` in `nuxt-app/`:

1. `/cards`, type a song title you have not added (for example "Gurenge"). The
   Songs group should populate faster than today and show the same song.
2. Add it. The row flips to "Added"; Preview plays it; the stored remote URL is
   on `naedist.animemusicquiz.com`.
3. Type an artist name (for example "YOASOBI"). The Artists group should show
   the artist, and the nav bar dropdown's Artists group should show the same.
4. Open the artist. The catalog modal should list anime groups with a live
   progress readout, as today.
5. Add one theme, open its Preview, turn the Japanese toggle on. The anime's
   native title should show from AniList; the **song** title shows its romaji,
   because the AnimeThemes overlay was dropped (see step 5) and AnimeThemes
   had a native song title for only 4 of 113 sampled themes anyway.
6. Add all, then Download all. Both should still work.
7. Simulate AnisongDB being down (block `anisongdb.com` in `/etc/hosts`, or
   temporarily point `ANISONGDB_ENDPOINT` at an unreachable host). Song search,
   artist search, and artist import should all still work through
   animethemes.moe, with no error shown.

Final gate: `bun run test` and `bun run build` from `nuxt-app/`. No `Verify`
command is declared in `AGENTS.md`, so those two are the automated gate.

## Notes for the AI

- Server-only provider calls, reached through `server/api/` routes, per
  `coding-standards.md`. No client-side fetch to either provider.
- Fall back on `ProviderUnavailableError` only. A `ProviderRequestError` means
  the app sent something wrong and must surface, not be masked by a silent
  second provider. This is the distinction `postMalIds` already draws.
- Reuse `USER_AGENT` from `server/utils/mediaDownload.ts`. It is the project's
  one User-Agent constant.
- Reuse `titleKey` from `themeSource.ts` for step 5's pairing rather than
  writing a second normalizer. 60a's title-pairing rule is the precedent: pair
  on normalized song title, never on slot, because the providers number slots
  differently.
- Never map an AnisongDB entry onto an anime by title. Use
  `linked_ids.anilist` only, exactly as `fetchThemesByMalId` does. The
  `mal_ids_request` cross-anime guard does not apply to these endpoints (they
  are not keyed by anime), but the "no AniList id means skip" rule still does.
- `upsertSong` and `upsertAnime` already drop null keys from their update sets
  (60a, step 5), so a re-import through the sparser provider will not erase a
  stored `titleNative`, `animethemesThemeId`, or `animethemesId`. Do not
  re-add unconditional overwrites.
- The two client-side `ArtistCandidate` declarations in
  `CardAddArtistResults.vue` and `NavSearch.vue` are deliberate duplication
  (F-09). Update both, keeping field order matching the server declaration.
- `NavSearch.vue` only reads `id` and `name` from a candidate, so it needs a
  type update and nothing else.
- The song search payload cap matters: truncate server-side to 10 before
  returning. Never hand a 500-entry array to the client.
- No em dashes in code comments or commit messages, per the Writing section of
  `coding-standards.md`.
