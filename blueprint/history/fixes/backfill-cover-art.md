# Fix: Backfill anime cover art missing after an AniList outage

**Type:** Fix
**Status:** verified

## The problem

Five cards on `/cards` show an empty grey tile where the anime cover should be.
They are not broken images: those anime have no cover URL stored at all.

```
card 340  Bouken Desho Desho?   anime 501  Suzumiya Haruhi no Shoushitsu  cover NULL
card 341  GO! GO! MANIAC        anime 506  K-On!!                         cover NULL
card 342  Utauyo!! MIRACLE      anime 506  K-On!!                         cover NULL
card 343  Listen!!              anime 506  K-On!!                         cover NULL
card 344  NO, Thank You!        anime 506  K-On!!                         cover NULL
```

`/cards` renders `<img v-if="c.animeCoverImageUrl">` with a
`.cover-thumb-empty` span otherwise ([cards/index.vue:503](nuxt-app/app/pages/cards/index.vue#L503)),
so a null column is exactly the tile in the screenshot.

**Why those rows are null.** The `fall back to AnimeThemes metadata during an
AniList outage` fix (`d0a3684`) lets an import complete when AniList is down:
`createAnimeMetadataResolver()` catches `ProviderUnavailableError` and calls
`fetchAnimeMetadataFromAnimeThemes()` instead
([animeMetadata.ts:35-42](nuxt-app/server/utils/animeMetadata.ts#L35-L42)).
That fallback only asks AnimeThemes for `id`, `title { romaji english native }`
and the AniList resource id (`METADATA_FIELDS`,
[animethemes.ts:363-367](nuxt-app/server/lib/animethemes.ts#L363-L367)), and
`AnimeThemesMetadata` has no cover field at all. `upsertAnime` treats an omitted
`coverImageUrl` as "leave it alone" ([lookup.ts:48-51](nuxt-app/server/utils/lookup.ts#L48-L51)),
which is correct for deck import but means a first insert during an outage
stores NULL.

**Nothing ever repairs it.** Once the anime row exists, no flow re-resolves its
metadata, so the cover stays missing forever even after AniList recovers. Ten
anime rows are affected today; the contiguous ids 501-530 are one import
session during the outage, and rows 1/5/10 are older test data.

## The fix

Add an explicit repair: fetch the missing covers from AniList on demand, from
Settings. AniList is healthy again, so every affected row can be filled from
the client the app already uses.

Deliberately not automatic. A list render must not fan out external API calls,
and a boot-time burst would be worse. This mirrors `/stats`' Refresh button: a
visible control the user can press when they notice something missing.

Out of scope, noted so it is a decision rather than an oversight: teaching the
AnimeThemes fallback to carry its own cover image. AnimeThemes does expose
images, but on a different schema that needs verifying, and the backfill
already repairs the outcome once AniList is reachable. Worth its own fix if
outages become common.

Must not break:

- `upsertAnime`'s omit-means-preserve contract - the backfill writes only
  `coverImageUrl`, on rows where it is currently null, and never touches titles
  or the external id mapping.
- An anime AniList has no record of (the `Tesuto Anime` test row carries the
  bogus `aniListId` 999001) must be skipped, not turned into a failed run.
- A genuine AniList outage during the backfill reports itself rather than
  marking rows as permanently coverless.

## Build steps

### Step 1 - the backfill itself, with tests

- [x] Done

- `setAnimeCoverImage(animeId, url)` in `server/utils/lookup.ts`, next to
  `upsertAnime`: a targeted update of the one column.
- `backfillMissingCovers()` in a new `server/utils/coverBackfill.ts`, taking
  its AniList fetcher as an injected argument so it is testable. Selects anime
  with a null `coverImageUrl`, resolves each **sequentially** (AniList rate
  limits; the bulk artist import already loops this way), and returns
  `{ checked, updated, skipped }`. A row AniList has no record of, or that has
  a record with no cover, counts as `skipped`. A `ProviderUnavailableError`
  aborts and propagates, so a dead provider is never mistaken for ten
  coverless anime.
- `server/utils/coverBackfill.test.ts` beside it, `vi.mock`ing the AniList
  client per the stack binding in `coding-standards.md`. Cases: fills a null
  cover, skips an unknown anime id, skips a record with a null cover, leaves
  non-null rows untouched, and propagates provider-unavailable.

**Done when:** `bun run test` shows the new cases passing, and the suite is
green.

### Step 2 - the Settings control

- [x] Done

- `GET /api/media-library` also returns `missingCoverCount`. The Settings page
  already loads this payload and already calls `refresh()` after every
  mutation, so the count updates with no new client plumbing. (It is derived
  rather than a settings column, like the existing `streamCachePath`.)
- `POST /api/lookup/cover-backfill` calls `backfillMissingCovers()` with the
  real client and returns its counts.
- `SettingsCoverArtControl.vue` under `app/components/settings/`, matching the
  existing `Settings*Control.vue` shape and emitting `saved` so the page
  refreshes: a "Cover art" panel in the **Media library** section stating how
  many anime are missing one, a button to fetch them, `ActivityStatus` while it
  runs, and a result line. Disabled with a "Nothing missing" state at zero.

**Done when:** `/settings` Media library reports the 10 anime missing cover
art; pressing the button fills the 9 real ones, skips the `Tesuto Anime` test
row, and the count drops; the five cards in the screenshot show real thumbnails
on `/cards` without a restart.

## Verify

1. `bun run dev` in `nuxt-app/`. `/cards`, search `K-On`: the four Houkago Tea
   Time rows show empty tiles.
2. `/settings` to Media library: the Cover art panel reports 10 anime missing.
3. Press the button. It reports filled and skipped counts, and the panel then
   reports 1 remaining (the bogus-id test row).
4. Back to `/cards`: those rows now show the K-On!! and Haruhi covers.
5. Press the button again with only the test row left: it reports nothing
   filled and does not error.
6. `bun run test` and `bun run build` in `nuxt-app/`.
