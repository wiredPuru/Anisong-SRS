# Feature: Filters for catalog songs

**From build-plan:** feature 128a (parent 128, Party endless online tiers)
**Status:** verified

## Goal

When party's endless queue draws songs from outside the library (feature 112),
the Study filters picked in New game narrow those songs too, as far as
AnisongDB can apply them. Today the panel says "Filters don't apply to songs
outside your library" and only a difficulty range is sent. Catalog songs also
start arriving in chunks of 5, per feature 128.

## In scope

- Translating the endless queue's `StudyFilters` into AnisongDB's
  `SongFilterOptions` for `get_n_random_songs`:
  - `themeTypes` to `song_types` (`OP` opening, `ED` ending, `IN` insert).
    Empty means OP and ED, plus insert only when Include insert songs is on, as
    today.
  - `formats` to `anime_types` (`TV` and `TV_SHORT` tv, `MOVIE` movie,
    `SPECIAL` special, `OVA` ova, `ONA` ona, `MUSIC` other).
  - `yearMin`/`yearMax` to `season` (`Winter <yearMin>` to `Fall <yearMax>`,
    either end open when unset).
  - `genresInclude`/`genresExclude` and `tagsInclude`/`tagsExclude` to
    `genres`/`tags` as `require_all` and `exclude` (require lists need every
    entry, as in Study).
- `seasons` (feature 78): when exactly one year and every picked season falls in
  it, or when no seasons are picked, the range says it all. Otherwise songs
  are checked after fetching against the song's `animeVintage` ("Fall 2013"),
  and the request asks for 4x the chunk so enough survive.
- Filters AnisongDB cannot take are not sent: AniList score, studio, anime list,
  tag min rank, and theme mix weights. The endless panel names the ones that
  are set as "not applied to songs outside your library".
- A genre or tag AnisongDB does not know (it answers `Unknown tag(s): 'x'`)
  is dropped, the request is retried once without it, and the panel lists it.
- Catalog chunks of 5 (`ENDLESS_CATALOG_BATCH`), still keeping 4 songs ahead.
- When the filters match nothing, the panel says so instead of the queue
  silently stopping.

## Out of scope

- The popularity x guess-rate grid and Very easy tier (128b). Difficulty keeps
  112's guess-rate bands here.
- In-library endless: unchanged, including its 10-song batches.
- Checking AniList score, studio or list after fetching.
- Listen, Study and Browse by filters.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Filter translation (pure)** - `server/utils/partyCatalogFilters.ts`
  exports `catalogSongFilters(filters: StudyFilters | null, includeInserts: boolean)`
  returning `{ options, seasons, notApplied }` (see contracts) and
  `matchesSeasons(vintage: string | null, seasons)`. *Done when:* tests cover
  null filters, each mapping above, open year ends, the single-year season
  case handled by the range, a multi-year season subset returned for
  post-checking, a malformed or missing vintage failing the check, and
  `notApplied` naming only filters that are actually set.
- [x] **Step 2 - AnisongDB client** - `fetchRandomSongs(count, difficulty,
  filters?)` merges the options with the difficulty range and returns
  `animeVintage` on `AnisongRandomSong`. A 4xx whose `detail` names unknown
  tags or genres throws `AnisongUnknownLabelsError` carrying the names
  (`parseUnknownLabels`, pure). *Done when:* tests cover `parseUnknownLabels`
  on the real message shape, several names, and unrelated messages; a live call
  with a genre and an OP filter returns only openings of that genre.
- [x] **Step 3 - Store wiring** - `topUpCatalog` sends the translated filters,
  applies the season check, drops unknown labels and retries once, adds chunks
  of 5, and records `catalogNote` on the endless state. *Done when:* on the
  scratch party server, an outside-library endless queue with Openings plus a
  genre only queues openings of shows with that genre (checked from the host
  state's answers), a made-up tag is dropped and reported, and filters that
  match nothing set `noMatch` without an error.
- [x] **Step 4 - Panel copy** - `PartyEndlessPanel` replaces "Filters don't
  apply to songs outside your library" with what is applied, the
  `notApplied` names, unknown labels, and the no-match message. *Done when:*
  browser check on the scratch server shows each message, and with no filters
  set the panel shows no filter note.

## Files / areas

- `nuxt-app/server/utils/partyCatalogFilters.ts` (+ test) - new.
- `nuxt-app/server/lib/anisongdb.ts` (+ test) - filters, vintage, unknown labels.
- `nuxt-app/server/utils/partyEndless.ts` - `ENDLESS_CATALOG_BATCH`.
- `nuxt-app/server/utils/partyStore.ts` - `topUpCatalog`.
- `nuxt-app/server/utils/partyGame.ts` - `PartyEndless.catalogNote`.
- `nuxt-app/app/composables/usePartyHost.ts` - client copy of the field.
- `nuxt-app/app/components/party/PartyEndlessPanel.vue` - copy.

## Data / contracts

Server only, no schema change. Load-bearing for 128b, which reuses `options`
on `mal_ids_request`:

```ts
// partyCatalogFilters.ts
interface CatalogSongFilters {
  options: AnisongSongFilterOptions; // song_types, anime_types, season, genres, tags
  seasons: AnimeSeason[] | null;     // null = the range already covers it
  notApplied: string[];              // e.g. ["AniList score", "Studio"]
}

// PartyEndless (server, and the client copy in usePartyHost.ts)
catalogNote?: { notApplied: string[]; unknownLabels: string[]; noMatch: boolean } | null;
```

`catalogNote` is null for in-library endless. It is set from the filters when
an outside-library endless command arrives (so `notApplied` shows before any
fetch) and reset by every endless command. A `noMatch` note stops further
fetches until the next command. AnisongDB reports one unknown kind per answer
(genres, then tags), so a batch may retry up to 4 times.

## Testing

- Vitest: `catalogSongFilters`, `matchesSeasons`, `parseUnknownLabels`.
- Live AnisongDB call in Step 2 (manual, not a unit test).
- Scratch party server (ports 4100-4103, scratch data dir) plus
  `playwright-cli` for Steps 3 and 4. Never stop the user's own party server.
- `bun run test` and `bun run build` before each checkpoint.

## Notes for the AI

- Verified 2026-11-22: `get_n_random_songs` accepts `song_types`,
  `anime_types`, `season` ("Fall 2013" range), `difficulty`, `genres` and
  `tags` (`require_any`/`require_all`/`exclude`, up to 100 each), `n` up to 500,
  and answers in about 0.4s. An unknown tag returns
  `{"detail": "Unknown tag(s): 'zzznotatag'."}`.
- Keep 112's difficulty behaviour exactly; 128b replaces it.
- Online only: `topUpCatalog` already returns when offline.
- No em dashes; comments only where the why is not obvious.
