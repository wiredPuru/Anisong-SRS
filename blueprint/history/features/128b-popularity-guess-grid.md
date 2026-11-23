# Feature: Popularity x guess-rate grid

**From build-plan:** feature 128b (parent 128, Party endless online tiers)
**Status:** verified

## Goal

Difficulty for party's outside-library endless queue (feature 112, filtered by
128a) stops being guess rate alone. Each tier becomes a set of cells in a grid
of AniList global popularity rank against AnisongDB `songDifficulty` (AMQ guess
rate). A new Very easy tier covers famous shows with well-known songs:

| Rank | 50+ | 30-50 (and unrated) | Under 30 |
|---|---|---|---|
| Top 500 | Very easy | Easy | Medium |
| 500-1000 | Easy | Medium | Hard |
| Rest | Medium | Hard | Hard |

Random ignores the grid, as today.

## In scope

- **Top-1000 ranking:** AniList's 1000 most popular non-adult anime (`id`,
  `idMal`, rank), fetched as 20 pages of 50, one after another, and held in
  memory for a day. A show with no MAL id still counts for rank lookups but
  can't be fetched from.
- **Guess-rate columns:** 50+ is 50-100; 30-50 is 30-49.9 plus songs with no
  difficulty; under 30 is 0-29.9. The ranges no longer overlap at 30 and 50.
- **Picking a batch:** each batch picks one of the tier's cells at random. If
  that cell yields nothing, it tries the tier's other cells in random order.
  - **Top 500 and 500-1000 cells:** one `mal_ids_request` for every MAL id in
    the band (at most 500, AnisongDB's limit), with the cell's guess-rate range
    and 128a's filters. The answer is kept as that cell's pool until the next
    endless command or for 30 minutes. Each batch draws from the pool locally:
    at most one song per show, skipping recently used shows and songs already
    queued. Measured 2026-11-22: the top-500 band at 50+ is one request, 0.6s,
    1.1 MB, 807 songs from 397 shows.
  - **Rest cells:** `get_n_random_songs` with the cell's range and 128a's
    filters, dropping songs whose AniList id is in the top 1000. Ask for 4x the
    chunk, or 8x when a season subset also needs checking.
  - 128a's season check, unknown-label retry and chunks of 5 apply to both
    paths.
- **No match:** set only when every cell of the tier comes back empty from
  AnisongDB. An empty pool is conclusive, so this is no longer a guess.
- **Recent shows:** a top-cell pool skips the AniList ids of the last 60 songs
  the catalog endless queue added. When every show in the pool is recent, the
  oldest are allowed again. The list resets on every endless command.
- **Reroll:** rerolling a catalog song picks its replacement from the same tier.
- **Very easy:** a new `veryEasy` difficulty, accepted only with
  `outsideLibrary`. The server refuses it for in-library endless. The panel
  offers it only outside the library, and switches back to Easy when Outside
  library is turned off.
- **Ranking unavailable** (AniList down, or the ranking still loading on the
  first batch): the ranking starts loading on the endless command, and a batch
  waits up to 3 seconds for it (near instant from the response cache, where
  every page is kept for a day). Until it is ready, the tier uses its guess-rate column alone (112's behaviour), with Very
  easy using 50+ and Hard using under 30. `catalogNote.rankingUnavailable` is
  set, and the panel says "Popularity ranking unavailable, using guess rate
  only." until a batch uses the ranking.

## Out of scope

- In-library endless, its popularity bands and `popularityCutoffs`. They keep
  their own two AniList calls; folding them into the ranking is a later cleanup.
- Weighting cells within a tier.
- Saving the ranking or the pools to the database; a restart refetches them.
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

- [x] **Step 1 - Grid (pure)** - `server/utils/partyCatalogGrid.ts` exports:
  - `TIER_CELLS`
  - `columnRange(column)`
  - `rankIndex(ranking)` and `rankBand(aniListId, ranks)`
  - `bandMalIds(ranking, band)`
  - `drawFromPool(pool, { queued, recentShows, count, random })` (one per show,
    with recent shows allowed again oldest first when nothing else is left)

  *Done when:* tests cover:
  - every tier's cells against the table above
  - the three ranges, with unrated only in the middle column
  - rank bands at ranks 1, 500, 501, 1000 and 1001, and an unranked id
  - band MAL ids skipping missing `idMal`
  - drawing that skips queued songs, gives one song per show, lets recent shows
    back in oldest first, and copes with a pool smaller than the count
- [x] **Step 2 - Ranking cache** - `server/utils/popularityRanking.ts`:
  `parseRankingPage` (pure), `loadPopularityRanking()` (20 sequential AniList
  pages, `createTimedCache` for 24h; returns null offline or on failure, never
  throws), and `currentRanking()` (the loaded ranking or null; starts a load
  without waiting). *Done when:* tests cover a well-formed page, a missing
  `idMal`, malformed entries and an empty page, and a live call returns 1000
  entries in rank order.
- [x] **Step 3 - AnisongDB client** -
  - `AnisongRandomSong` gains `aniListId` (from `linked_ids.anilist`).
  - `DifficultyRange` gains `includeUnrated`.
  - `fetchSongsByMalIds(malIds, difficulty, options)` posts to
    `mal_ids_request` and parses through the same function as random songs.

  *Done when:* tests cover the shared parse, both payloads including
  `include_no_difficulty`, and the unknown-label error on `mal_ids_request`;
  a live call for three well-known MAL ids at 50+ returns only songs rated 50
  or more.
- [x] **Step 4 - Store wiring** -
  - `veryEasy` in `ENDLESS_DIFFICULTIES`, refused without `outsideLibrary`.
  - Cell pools, reset by every endless command or after 30 minutes.
  - `fetchCatalogBatch` and `rerollCatalogItem` pick by cell.
  - The recent-shows list.
  - The ranking fallback and `catalogNote.rankingUnavailable`.

  *Done when:* on the scratch party server:
  - Very easy, Easy, Medium and Hard each queue songs whose show rank band and
    guess rate fall in that tier's cells (checked through
    `ann_song_ids_request` and the ranking).
  - Random still works.
  - A 128a filter still applies.
  - A filter set no top-500 show matches gives Very easy a no-match note.
  - `veryEasy` without Outside library returns an error.
- [x] **Step 5 - Panel** - `PartyEndlessPanel` offers Very easy only outside
  the library and resets to Easy when Outside library is turned off. Each
  tier's hint names its grid cells, and the ranking-unavailable note shows when
  set. *Done when:* a browser check on the scratch server shows each, and the
  in-library panel is unchanged.

## Files / areas

- `nuxt-app/server/utils/partyCatalogGrid.ts` (+ test) - new.
- `nuxt-app/server/utils/popularityRanking.ts` (+ test) - new.
- `nuxt-app/server/utils/partyCatalogPicker.ts` (+ test) - new in Step 4: per-tier cell picking,
  band pools and recent shows, kept out of `partyStore.ts` so it can be unit tested.
- `nuxt-app/server/lib/anisongdb.ts` (+ test) - `aniListId`,
  `includeUnrated`, `fetchSongsByMalIds`.
- `nuxt-app/server/utils/partyEndless.ts` - `veryEasy`, and
  `catalogDifficultyRange` for the fallback.
- `nuxt-app/server/utils/partyGame.ts` - validation and
  `catalogNote.rankingUnavailable`.
- `nuxt-app/server/utils/partyStore.ts` - pools, batch and reroll picking.
- `nuxt-app/app/composables/usePartyHost.ts` - client copies.
- `nuxt-app/app/components/party/PartyEndlessPanel.vue` - Very easy and copy.

## Data / contracts

Server only, no schema change.

```ts
// partyCatalogGrid.ts
type RankBand = "top500" | "top1000" | "rest";
type GuessColumn = "high" | "mid" | "low"; // 50+, 30-50 plus unrated, under 30
interface GridCell { band: RankBand; column: GuessColumn }
const TIER_CELLS: Record<Exclude<EndlessDifficulty, "random">, GridCell[]>;

interface RankedAnime { aniListId: number; malId: number | null; rank: number }

// popularityRanking.ts
loadPopularityRanking(): Promise<RankedAnime[] | null>;
currentRanking(): RankedAnime[] | null;
rankingWithin(ms: number): Promise<RankedAnime[] | null>;

// anisongdb.ts
interface DifficultyRange { start: number; end: number; includeUnrated?: boolean }
interface AnisongRandomSong { /* ...as today */ aniListId: number | null }

// partyEndless.ts
ENDLESS_DIFFICULTIES = ["veryEasy", "easy", "medium", "hard", "random"];

// PartyCatalogNote (server and client copy) gains
rankingUnavailable: boolean;
```

## Testing

- Vitest: the grid, `parseRankingPage`, the AnisongDB parse and payloads.
- Live AniList and AnisongDB calls in Steps 2 and 3 (manual, not unit tests).
- Scratch party server (ports 4100-4103, scratch data dir) plus `playwright-cli`
  for Steps 4 and 5. Never stop the user's own party server.
- `bun run test` and `bun run build` before each checkpoint. Rebuilding breaks
  a running party server, so restart the user's after the final build.

## Notes for the AI

- Verified 2026-11-22: `mal_ids_request` takes `filters` with `song_types` and
  `difficulty` (including `include_no_difficulty`) and returns the same song
  objects as `get_n_random_songs`, which carry `linked_ids.anilist` and
  `songDifficulty`.
- Measured 2026-11-22 for the top-500 band (499 MAL ids), OP/ED:

  | Guess rate | Songs | Shows | Size | Time |
  |---|---|---|---|---|
  | 50+ | 807 | 397 | 1.1 MB | 0.6s |
  | 30-49.9 plus unrated | 750 | 369 | 1.1 MB | 0.7s |
  | Any | 2013 | 492 | 2.8 MB | 1.2s |

- AniList allows about 30 requests a minute when degraded; fetch the 20
  ranking pages one after another, not in parallel.
- Online only: `topUpCatalog` already returns when offline.
- No em dashes; comments only where the why is not obvious.
