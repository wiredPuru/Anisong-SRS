# Feature: Anime cover art

**From build-plan:** feature 12
**Status:** verified

## Goal

Fetch each anime's AniList cover image and show it wherever cards and decks
are browsed, so anime are visually recognizable instead of title-text-only.

**Design call for review:** "fetch and store" means storing the AniList CDN
URL (`coverImage.large`), not downloading the image file. AniList's cover
images are stable, permanently-hosted assets meant for exactly this kind of
hotlinking - the app already treats external media the same way
(`animethemesVideoUrl`/`animethemesAudioUrl` are stored as URLs, never
copied locally). Downloading and locally caching cover images would add
filesystem management for zero real benefit on a localhost-only app with a
live internet connection. Say so if you'd rather these be downloaded into
the media library like feature 8 does for clips.

## In scope

- `anime.coverImageUrl` (text, nullable) - the AniList `coverImage.large` URL,
  fetched and stored whenever an anime is looked up or re-looked-up via
  `/api/lookup/import` (the only place `upsertAnime` is called). An anime
  added *before* this feature stays `null` until the user re-selects it from
  an AniList search in `/cards/new` - `upsertAnime`'s existing
  `onConflictDoUpdate` on `aniListId` already refreshes it for free, no
  separate backfill step needed.
- Surface the new field on the existing card/deck read paths: `CardWithDetails`
  (shared by `/api/cards`, `/api/decks/cards`, `/api/study/next`,
  `/api/study/review`, `/api/cards/download`) gains `animeCoverImageUrl`, and
  `AnimeDeck` (from `listAnimeDecks()`) gains `coverImageUrl`. Both come from
  a column already joined into their existing queries - no new joins.
- Display: a small thumbnail per row on `/cards`, and on `/decks` for
  **anime-type** decks only (both the deck list and a deck's detail header
  and card rows) - artist-type decks span multiple anime, so no single cover
  applies there and none is shown.
- Graceful degradation: a card/deck whose anime has no `coverImageUrl` (not
  yet re-looked-up) renders its row exactly as it does today - no broken
  image, no placeholder box, no layout shift.

## Out of scope

- Downloading/caching the image file locally (see the design call above).
- Backfilling existing anime rows in bulk - see the free re-lookup path
  above; a dedicated bulk-refresh action is a separate feature if ever
  wanted.
- Artist-type decks - no per-row or per-deck cover, by design (see In scope).
- `/study` and `CardPreviewModal` - both are playback-focused and reuse the
  same `StudyMediaPlayer`/`StudyInfoPanel` components; adding cover art
  there is a different, unrequested design change to a component this
  feature doesn't otherwise touch.
- `/cards/new`'s search-results list and the post-selection theme list - the
  build-plan line asks for "card/deck browsing" (existing, saved cards and
  decks), not the anime-picking flow that happens before any card exists.
- Feature 9's export bundle format (`DeckBundleCardEntry`) - already shipped
  and versioned; not extended with a cover field here.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Fetch and store the cover URL** - add `coverImageUrl` (text,
  nullable) to `anime` in `server/db/schema.ts` (Drizzle migration via
  `bun run db:generate`). In `server/lib/anilist.ts`, add `coverImage {
  large }` to `BY_ID_QUERY` (not `SEARCH_QUERY` - out of scope per above),
  extend `AniListMedia`/`AniListAnime` with `coverImageUrl: string | null`,
  and map it in `toAniListAnime`. Extend `upsertAnime` in
  `server/utils/lookup.ts` to accept and persist `coverImageUrl`. Update
  `server/api/lookup/import.post.ts`'s `upsertAnime` call to pass
  `coverImageUrl: aniListAnime.coverImageUrl`. *Done when:* `curl -X POST
  /api/lookup/import` with a real `aniListId` (per feature 3/8's precedent),
  then `curl /api/cards` (or a direct sqlite query) on a card from that
  anime, shows a populated `coverImageUrl` pointing at a real
  `s4.anilist.co` (or equivalent AniList CDN) URL; an anime with no AniList
  cover art (rare, but `coverImage.large` can be null) stores `null`
  cleanly, no error.
- [x] **Step 2 - Surface it on card/deck reads** - in `server/utils/cards.ts`,
  add `animeCoverImageUrl: anime.coverImageUrl` to `cardSelection` and
  `CardWithDetails`. In `server/utils/decks.ts`, add `coverImageUrl:
  anime.coverImageUrl` to `listAnimeDecks()`'s select and the `AnimeDeck`
  interface; `listArtistDecks()`/`ArtistDeck` unchanged. *Done when:* `curl
  /api/cards`, `curl "/api/decks?type=anime"`, and `curl
  "/api/decks/cards?type=anime&id=<id>"` all include the new field
  (populated for the anime re-imported in Step 1, `null` for others);
  `curl "/api/decks?type=artist"` response is byte-for-byte unchanged
  (no new field).
- [x] **Step 3 - Show it on `/cards`** - in `app/pages/cards/index.vue`, add
  `animeCoverImageUrl` to the local `CardWithDetails` interface and render a
  small `<img>` thumbnail at the start of each `.card-row` when it's set;
  render nothing in its place when it's `null` (existing row layout,
  unchanged). *Done when:* in the browser (or SSR `curl` of `/cards`), a
  card from the Step 1 anime shows its cover thumbnail; a card whose anime
  has no cover renders identically to before this feature.
- [x] **Step 4 - Show it on `/decks`** - in `app/pages/decks/index.vue`, add
  `coverImageUrl` to `AnimeDeck`/`DeckItem` (only populated for
  `activeType === 'anime'`) and `animeCoverImageUrl` to `DeckCard`. Render a
  thumbnail per row in the anime-type deck list, one larger thumbnail next
  to the deck-detail `<h2>` when viewing an anime deck, and a small one per
  card row in the deck-detail list (reusing the same field as Step 3).
  Artist-type deck rows and their detail view get no thumbnail markup at
  all. *Done when:* in the browser (or SSR `curl`), `/decks?type=anime`
  shows thumbnails where available; `/decks?type=anime&id=<Step-1-anime>`
  shows the larger header thumbnail and per-card thumbnails; `/decks?type=artist`
  and its detail view render exactly as before this feature.

## Files / areas

- `nuxt-app/server/db/schema.ts` - add `anime.coverImageUrl`; new migration.
- `nuxt-app/server/lib/anilist.ts` - fetch `coverImage.large` in `BY_ID_QUERY`.
- `nuxt-app/server/utils/lookup.ts` - `upsertAnime` accepts/persists it.
- `nuxt-app/server/api/lookup/import.post.ts` - pass it through.
- `nuxt-app/server/utils/cards.ts` - `CardWithDetails`/`cardSelection`.
- `nuxt-app/server/utils/decks.ts` - `AnimeDeck`/`listAnimeDecks()`.
- `nuxt-app/app/pages/cards/index.vue` - thumbnail per card row.
- `nuxt-app/app/pages/decks/index.vue` - thumbnail per anime deck row,
  detail header, and detail card rows.

## Data / contracts

```ts
// server/db/schema.ts - anime table addition
coverImageUrl: text("cover_image_url"), // nullable; AniList coverImage.large URL
```

```ts
// server/lib/anilist.ts
export interface AniListAnime {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImageUrl: string | null; // new
}
```

`CardWithDetails` (load-bearing, per `project-overview.md`) gains:

```ts
animeCoverImageUrl: string | null;
```

`AnimeDeck` (from `server/utils/decks.ts`) gains:

```ts
coverImageUrl: string | null;
```

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test` entry),
so this rides on direct verification, same as features 8 and 9:

- Step 1: `curl` against `/api/lookup/import` with a real `aniListId`,
  confirming the stored URL via `/api/cards`. `bun run build` must stay clean.
- Step 2: `curl` against the three read endpoints, confirming the field
  appears (or is correctly absent for artist decks).
- Steps 3 & 4: browser check, or SSR HTML via `curl`, confirming the
  thumbnail renders where expected and is absent (not broken) elsewhere.

This feature is field-plumbing plus straightforward conditional rendering -
no new branching logic complex enough to warrant a focused unit test even if
a runner existed, unlike feature 9's skip/error-collection logic.

## Notes for the AI

- Server-only: the AniList fetch and DB write stay in `server/lib/anilist.ts`,
  `server/utils/lookup.ts`, and `server/api/lookup/import.post.ts`; pages only
  render a URL already present in fetched JSON, per `coding-standards.md`.
- `CardWithDetails` is documented as a single shared shape across five
  endpoints in `project-overview.md` - extend the one shared
  `cardSelection`/`CardWithDetails` in `cards.ts` rather than forking a
  separate query, even though `/study/*` won't render the new field. That
  matches how every other `CardWithDetails` field already rides along
  unused on endpoints that don't display it.
- `<img>` tags load directly from AniList's CDN (`s4.anilist.co` or
  similar) client-side - no server-side proxy or caching, same as how
  `animethemesVideoUrl`/`animethemesAudioUrl` are played directly from
  their CDN today.
- Use `v-if`, not an empty-string `src`, to skip rendering when
  `coverImageUrl`/`animeCoverImageUrl` is `null` - an empty `src` triggers a
  broken-image icon and, in some browsers, a spurious request to the
  current page's URL.
