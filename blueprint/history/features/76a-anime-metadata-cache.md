# Feature: Anime metadata cache + backfill

**From build-plan:** feature 76a (parent: 76 Study filters)
**Status:** verified

## Goal

Store the AniList metadata that Study filters (76b) will filter on - year,
format, average score, genres, and ranked tags - on every `Anime` row. New
imports fill it automatically, and a Settings action backfills the anime
already in the library in a handful of batched AniList requests. No filtering
UI yet; this sub-feature only makes the data exist.

## In scope

- Six new `anime` columns (see Data / contracts), via a Drizzle migration.
- AniList's two by-id queries (`fetchAnimeFromAniList`,
  `fetchAnimeFromAniListByMalId`) select and parse the new fields into an
  optional `details` on `AniListAnime`.
- A batched `fetchAnimeDetailsByIds(ids)` using `Page(media(id_in:))`, up to 50
  ids per request.
- `upsertAnime` takes an optional `details`. Omitted leaves the stored columns
  alone (deck import, the stored-row and AnimeThemes fallbacks); given, it
  writes all five fields and stamps `aniListDetailsCheckedAt`.
- The three live import routes (`import`, `song-import`, `artist-import`) pass
  `details` through when the resolver returned fresh AniList data.
- `backfillAnimeDetails(fetchBatch)` over rows whose
  `aniListDetailsCheckedAt` is null, `POST /api/lookup/anime-details-backfill`,
  a `missingAnimeDetailsCount` on `GET /api/media-library`, and a Settings
  control beside Cover art mirroring `SettingsCoverArtControl`.

## Out of scope

- Any filter UI or due-card filtering (76b), user-list filtering (76c).
- Insert songs and saved presets (excluded from 76 entirely).
- Refreshing details that are already stored: AniList scores drift slowly, and
  a re-import of the anime already refreshes them. No "refetch all" action.
- Deck import manifests: they neither export nor import these fields; an
  imported deck's anime get details from the backfill.

## Build steps

- [x] **Step 1 - Schema + migration** - add the six columns to `anime` in
  `schema.ts` and generate migration `0021` with `bun run db:generate`.
  *Done when:* the migration is only `ALTER TABLE anime ADD ...` statements,
  `bun run test` passes (every DB test migrates an in-memory DB from scratch),
  and `bun run build` succeeds.
- [x] **Step 2 - AniList details parsing + batch fetch** - `AniListDetails`
  type, the two by-id queries select `seasonYear startDate { year } format
  averageScore genres tags { name rank }`, a strict parser, and
  `fetchAnimeDetailsByIds`. *Done when:* `anilist.test.ts` covers year fallback
  to `startDate.year`, all-null fields, malformed details opening the
  cooldown like other malformed metadata, the batch returning a map keyed by
  AniList id, ids missing from the response being absent from the map, and
  more than 50 ids splitting into multiple requests.
- [x] **Step 3 - Persist on import** - `upsertAnime({ details })` and the
  three import routes. *Done when:* tests show `details` written with a
  checked-at stamp, an omitted `details` leaving stored details untouched on
  conflict, and a resolver fallback (stored row or AnimeThemes metadata)
  carrying no `details`.
- [x] **Step 4 - Backfill util + route + count** - `backfillAnimeDetails`,
  `countAnimeMissingDetails`, the POST route, and the count on
  `GET /api/media-library`. *Done when:* tests show found rows filled,
  rows AniList does not return stamped as checked with empty details (so they
  are never re-probed and the count reaches zero), a provider error
  propagating after earlier batches are already saved, and the count matching
  the rows the backfill touches.
- [x] **Step 5 - Settings control** - `SettingsAnimeDetailsControl.vue` in the
  same Settings section as Cover art. *Done when:* against a scratch copy of the
  real database (`GAQ_SRS_DATA_DIR`), Settings shows "319 anime are missing
  details", the button runs the backfill, the summary reports filled/skipped,
  the count drops to 0 (or to the skipped remainder, reported as such), no
  console errors, and a spot-check row in SQLite has plausible year, format,
  score, genres, and tags.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `nuxt-app/server/db/migrations/0021_*.sql` (+ meta)
- `nuxt-app/server/lib/anilist.ts`, `anilist.test.ts`
- `nuxt-app/server/utils/lookup.ts`, `animeMetadata.ts` (type only)
- `nuxt-app/server/api/lookup/import.post.ts`, `song-import.post.ts`, `artist-import.post.ts`
- `nuxt-app/server/utils/animeDetailsBackfill.ts` + test (new)
- `nuxt-app/server/api/lookup/anime-details-backfill.post.ts` (new)
- `nuxt-app/server/api/media-library.get.ts`, `nuxt-app/app/pages/settings.vue`
- `nuxt-app/app/components/settings/SettingsAnimeDetailsControl.vue` (new)

## Data / contracts

**Load-bearing for 76b.** New `anime` columns:

| Column | Type | Meaning |
|---|---|---|
| `year` | integer, null | AniList `seasonYear`, else `startDate.year` |
| `format` | text, null | AniList `MediaFormat` as sent: `TV`, `TV_SHORT`, `MOVIE`, `SPECIAL`, `OVA`, `ONA`, `MUSIC` |
| `average_score` | integer, null | AniList `averageScore`, 0-100 |
| `genres` | text JSON `string[]`, not null, default `[]` | AniList genres |
| `tags` | text JSON `{ name: string; rank: number }[]`, not null, default `[]` | AniList tags, rank 0-100 |
| `ani_list_details_checked_at` | integer `timestamp_ms`, null | When details were last written; null = never fetched |

```ts
interface AniListDetails {
  year: number | null;
  format: string | null;
  averageScore: number | null;
  genres: string[];
  tags: { name: string; rank: number }[];
}
```

`AniListAnime.details?: AniListDetails` - present only from the two by-id
queries, mirroring how `malId` is only selected there. Search and
Completed-list queries stay unchanged.

Filtering in 76b reads genres/tags with SQLite `json_each`, so they stay JSON
columns rather than join tables. `aniListDetailsCheckedAt` separates "AniList
has no data" from "never checked", the same lesson as
`Song.animethemesCheckedAt`.

## Testing

Test gate is on (`bun run test`). In-scope logic: the details parser and
batch fetch (step 2), `upsertAnime`'s details handling (step 3), and the
backfill util (step 4). The Settings control is UI and rides on browser
evidence plus build (step 5).

## Notes for the AI

- AniList can be rate limited; the batch fetch goes through `requestAniList`
  so it shares the cooldown, and batches run sequentially.
- The cover backfill route deliberately calls AniList directly, not the
  metadata resolver, because the fallback carries no data; the same applies here.
- Never run the dev server against the live `.data/gaq-srs.db` for this
  feature's evidence: copy it to the scratchpad and point `GAQ_SRS_DATA_DIR`
  at the copy, so the migration and backfill only touch the copy.
- Leave `nuxt-app/study-loaded.yml` (untracked, unrelated) out of every commit.

## Outcome

Verified 2026-09-25 with `bun run test` (1027 passing) and `bun run build`,
plus browser evidence against a scratch copy of the live database
(`GAQ_SRS_DATA_DIR`): Settings showed 319 anime missing details, the backfill
filled 317 of 319 in 7 AniList requests, and the 2 skipped were test rows with
made-up AniList ids (`Tesuto Anime`, `Test Show`). No typecheck command exists
in this project, so none ran.
