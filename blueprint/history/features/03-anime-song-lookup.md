# Feature: Anime & song lookup

**From build-plan:** feature 3
**Status:** verified

## Goal

Search AniList for an anime, then pull its OP/ED themes (song title, artist,
video/audio URLs) from animethemes.moe by cross-referencing the AniList ID,
and cache the searchable metadata (`Anime`, `Artist`, `Song`) into the local
DB. This is the lookup engine feature 4 (Flashcard CRUD) will build its
"add a card" UI on top of - this feature ships no UI itself, only the API,
verified the same way feature 1's Data layer was: build, boot, curl.

Every GraphQL query and field name in this spec was verified against the
live APIs during spec'ing (introspection + real test queries against both
graphql.anilist.co and graphql.animethemes.moe, using "Bocchi the Rock!",
AniList id `130003`), not guessed from docs. The docs site at
api-docs.animethemes.moe turned out to be JS-rendered and didn't scrape
cleanly, so the schema below came from querying the API directly.

## In scope

- AniList GraphQL client: search by title, fetch a single anime by AniList id
- animethemes.moe GraphQL client: given an AniList id, find the matching
  anime and its OP/ED themes (song title, performing artist, one video URL +
  one audio URL per theme)
- `GET /api/lookup/anilist-search?q=` - search endpoint
- `POST /api/lookup/import` - given an AniList id, fetches both APIs and
  upserts `Anime`, `Artist`, `Song` rows; returns the full payload including
  video/audio URLs (not persisted - there's no `Card` to attach them to yet)
- Idempotent import: re-importing the same anime must not create duplicate
  rows
- Adding a `UNIQUE` constraint on `artist.name` (missing from feature 1;
  needed now to get-or-create artists without duplicating them across
  imports)

## Out of scope

- Any UI - no search box, no "/cards/new" page. Feature 4 builds that and
  calls these same endpoints
- Creating `Card` rows or persisting video/audio URLs anywhere - `Card`
  doesn't exist until a user picks a specific theme in feature 4
- Multi-artist songs - only the first credited performance's artist is used.
  `Song.artistId` is a single FK (locked in feature 1); modeling
  collaborations is a bigger data-model change, not this feature's job
- Picking a "best" video (resolution, subbed/uncensored preference) - takes
  the first available video/audio pair per theme
- Auto-importing an artist's entire catalog or downloading video files -
  that's the separate, not-yet-planned idea sitting in `project-plan.md`
  (still uncommitted); this feature is single-anime lookup only
- Rate limiting / retry logic against either external API

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - AniList client + search endpoint** - add
  `nuxt-app/server/lib/anilist.ts` (`searchAnimeOnAniList(query)` and
  `fetchAnimeFromAniList(aniListId)`, using the exact queries in
  Data/contracts) and
  `nuxt-app/server/api/lookup/anilist-search.get.ts` (reads `?q=`, 400 if
  empty/missing). *Done when:* `curl 'localhost:3000/api/lookup/anilist-search?q=Bocchi%20the%20Rock'`
  returns results including `{"aniListId":130003,"titleEnglish":"BOCCHI THE ROCK!",...}`;
  `curl 'localhost:3000/api/lookup/anilist-search?q='` returns `400`; build +
  `tsc --build` clean.
- [x] **Step 2 - Artist uniqueness + upsert helpers** - add `.unique()` to
  `artist.name` in `schema.ts`, generate the migration, add
  `nuxt-app/server/utils/lookup.ts` with `upsertAnime`, `getOrCreateArtist`,
  `upsertSong` (upsert/get-or-create keyed on `ani_list_id`, `name`, and
  `(anime_id, theme_slot)` respectively - same `onConflictDoUpdate` pattern
  as feature 2's `mediaLibrary.ts`). *Done when:* build + `tsc --build`
  clean; fresh boot (`rm -rf .data` + boot) then
  `sqlite3 .data/gaq-srs.db ".schema artist"` shows the `UNIQUE` index on
  `name`. (The helpers' actual upsert behavior is proven end-to-end in step
  4, not re-tested here in isolation.)
- [x] **Step 3 - animethemes.moe client** - add
  `nuxt-app/server/lib/animethemes.ts`:
  `fetchAnimeThemesByAniListId(aniListId)`, using the exact query in
  Data/contracts. Returns `null` if animethemes.moe has no matching anime at
  all; returns `{ animethemesId, themes: [] }` if matched but themeless;
  otherwise `{ animethemesId, themes: [{ animethemesThemeId, themeSlot,
  songTitle, artistName, videoUrl, audioUrl }] }`, skipping any theme whose
  song has no usable title (both `romaji` and `native` null - a real data
  gap on some entries) rather than throwing. Takes the first video and its
  audio per theme. *Done when:* a one-off script (temporary, not committed)
  calling `fetchAnimeThemesByAniListId(130003)` prints `animethemesId: 3912`
  and a theme with `themeSlot: "OP1"`, `songTitle: "Tsukinami ni Kagayake"`,
  `artistName: "Kessoku Band"`, `videoUrl` starting with
  `https://v.animethemes.moe`, `audioUrl` starting with
  `https://a.animethemes.moe`; build + `tsc --build` clean.
- [x] **Step 4 - Import orchestration + route** - add
  `nuxt-app/server/api/lookup/import.post.ts`: validates `{ aniListId:
  number }`, calls `fetchAnimeFromAniList` (404 if not found on AniList),
  calls `fetchAnimeThemesByAniListId`, `upsertAnime` (storing
  `animethemesId` as `null` when there's no animethemes.moe match), then
  for each theme with a title, `getOrCreateArtist` + `upsertSong`; responds
  with the anime plus each theme's song id, title, artist, and video/audio
  URLs. *Done when*, against a running dev server with a fresh DB: `curl -X
  POST -d '{"aniListId":130003}' -H 'content-type: application/json'
  localhost:3000/api/lookup/import` returns `200` with
  `titleEnglish: "BOCCHI THE ROCK!"` and a `themes` entry for `"OP1"`;
  posting the identical body again returns `200` with the same `anime.id`
  and `song.id` values, and `sqlite3 .data/gaq-srs.db "SELECT count(*) FROM
  song"` is the same after both calls (no duplicate rows); `curl -X POST -d
  '{"aniListId":999999999}' ...` returns `404`; `curl -X POST -d '{}' ...`
  returns `400`.

## Files / areas

- `nuxt-app/server/lib/anilist.ts` - new
- `nuxt-app/server/lib/animethemes.ts` - new
- `nuxt-app/server/utils/lookup.ts` - new
- `nuxt-app/server/api/lookup/anilist-search.get.ts` - new
- `nuxt-app/server/api/lookup/import.post.ts` - new
- `nuxt-app/server/db/schema.ts` - `artist.name` gets `.unique()`
- `nuxt-app/server/db/migrations/` - new, generated

## Data / contracts

**Schema change:** `artist.name` becomes `UNIQUE` (was unconstrained since
feature 1). No other feature has written `Artist` rows yet, so this is safe
to add now without a data-migration/dedup concern.

**AniList queries** (`https://graphql.anilist.co`, verified working):

```graphql
# search
query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME) {
      id
      title { romaji english native }
    }
  }
}
```

```graphql
# fetch by id
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
  }
}
```

A nonexistent id returns HTTP `404` with `{"errors":[...], "data":{"Media":null}}`
- the client must treat that as "not found," not throw on the non-2xx status.

**animethemes.moe query** (`https://graphql.animethemes.moe`, verified
working against AniList id `130003` -> animethemes.moe anime id `3912`):

```graphql
query ($anilistId: [Int!]) {
  findAnimeByExternalSite(site: ANILIST, id: $anilistId) {
    id
    animethemes(first: 50) {
      id
      slug
      song {
        title { romaji native }
        performances {
          artist { name { main native } }
        }
      }
      animethemeentries(first: 1) {
        videos(first: 1) {
          nodes {
            link
            audio { link }
          }
        }
      }
    }
  }
}
```

**Nullability mismatch (found in step 1's own test output, not anticipated
when this spec was written):** `Anime.titleEnglish`/`titleNative` are `NOT
NULL` per feature 1's locked schema, but AniList's `title.english` and
`title.native` are both nullable and do come back `null` in practice
("Bocchi the Rock! 2nd Season" has `titleEnglish: null`). Only `titleRomaji`
is AniList-guaranteed non-null. `upsertAnime` must fall back to
`titleRomaji` when `titleEnglish` or `titleNative` is `null` - a common,
reasonable convention (no official English title -> show the romaji), not a
silent data-loss workaround.

Notes locked from live verification:
- animethemes.moe blocks Node's default `fetch` User-Agent with a bare `403`
  (`curl` and browser UAs pass fine; confirmed by testing all three
  directly). The client must send an explicit, identifying User-Agent
  header (e.g. `"GAQ-SRS/1.0 (personal AMQ study app)"` - honest
  self-identification, not a spoofed browser string, and confirmed that
  works too). AniList does not require this.
- The `$anilistId` variable must be declared `[Int!]`, not `[Int]` - the
  server's `id` argument type is `[Int!]`, and GraphQL rejects a nullable-
  element variable type against a non-null-element argument type. An
  inline literal (`id: [130003]`) is checked more leniently and doesn't
  surface this - only testing the actual parameterized-variable form (as
  the real client uses) caught it.
- `findAnimeByExternalSite` returns a plain list (`[Anime!]!`), not
  paginated - take the first element, or treat an empty list as "no match."
- `AnimeTheme.slug` (e.g. `"OP1"`, `"ED1"`) is exactly our `theme_slot`
  value - use it directly, don't reconstruct from `type`/`sequence`.
- `SongTitle.romaji` and `SongTitle.native` are **both nullable** - some
  real entries have neither. Skip the theme rather than storing an empty
  title.
- `Performance.artist.name.main` is the artist display name to use.
  `performances` can list the same artist multiple times (observed on real
  data); just take `performances[0]`.
- Connections (`animethemes`, `animethemeentries`, `videos`) use `first:`
  (required) and expose results via `.nodes`, not `.data` or `.edges.node`.
- `Video.link` is the video URL; `Video.audio.link` is the audio-only URL.

**API contract**
- `GET /api/lookup/anilist-search?q=<term>` -> `200 { results:
  [{ aniListId: number, titleRomaji: string, titleEnglish: string | null,
  titleNative: string | null }] }`, capped at 10 results (`perPage: 10` in
  the query - don't rely on AniList's unspecified default); `400` if `q` is
  missing or empty.
- `POST /api/lookup/import` body `{ aniListId: number }` -> `200 { anime:
  { id, aniListId, animethemesId, titleEnglish, titleRomaji, titleNative },
  themes: [{ songId, themeSlot, songTitle, artistName, videoUrl, audioUrl }]
  }`; `404` if AniList has no such anime; `400` if `aniListId` is
  missing/not a number. `themes` is `[]` when AniList has the anime but
  animethemes.moe has no match or no themes with a usable title - not an
  error.

## Testing

Still no test runner configured. This feature's core logic (GraphQL
response mapping/upserting) is exactly the kind of thing worth testing once
`/tests` runs - flagging it again since this is the second feature in a row
where that would have helped, but not adding a runner mid-feature per
`coding-standards.md`. Evidence stays build output, `tsc --build`, and the
curl sequences above against real external APIs (deliberately using real
data, not mocks, so the exact field/shape assumptions get proven against the
live schema rather than a guess).

**Known coverage gap, stated plainly:** the "AniList has it, animethemes.moe
has no match at all" path (`fetchAnimeThemesByAniListId` returning `null`)
is verified by code inspection, not a live example - I don't have a stable,
permanently-unmatched real AniList id to pin a repeatable test to. The
`themes: []` path (matched anime, zero usable themes) has the same
limitation. Both are simple `if` branches, low risk, but not exercised
against live data the way the happy path is.

## Notes for the AI

- Both GraphQL clients are plain `fetch` calls (`POST` with a JSON body) -
  no GraphQL client library needed for two query shapes.
- Server-only, per `coding-standards.md`: these live under `server/lib/` and
  `server/utils/`, never imported from `app/` (there's no UI in this feature
  anyway).
- Reuse the `onConflictDoUpdate` upsert pattern from feature 2's
  `mediaLibrary.ts` for consistency.
- A theme with a usable title but no credited artist (`artistName: null`
  from `fetchAnimeThemesByAniListId`) still needs a value for `Song.artistId`
  (`NOT NULL` per feature 1). `getOrCreateArtist("Unknown Artist")` is the
  fallback - a placeholder artist row, not a crash. This case wasn't
  hit in step 3's real data (Kessoku Band was always present), so it's an
  untested defensive path, not a proven one.
- Wrap both external fetches in try/catch; a network failure or non-2xx
  response (other than AniList's documented 404-for-not-found) should
  surface as a clean `502` from our API, not an unhandled exception.
- `project-plan.md` currently has an uncommitted note about bulk
  artist-import and downloading video. That is explicitly out of scope here
  (see Out of scope) - don't fold it in without a separate spec'd decision.
