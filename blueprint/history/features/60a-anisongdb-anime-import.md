# Feature: AnisongDB client + anime theme import

**From build-plan:** feature 60a
**Status:** verified

## Goal

Make adding and first-playing a card fast by taking OP/ED clip URLs from
AnisongDB (the public API behind Anime Music Quiz) instead of animethemes.moe,
starting with the anime import path. animethemes.moe measured 1-3s media TTFB
and roughly 0.75s GraphQL search; AnisongDB measured 0.22-0.43s lookups and
0.32s media TTFB from AMQ's own distribution hosts. This sub-feature builds the
client, opens the media allowlist to those hosts, and repoints
`/api/lookup/import`. The search routes (60b) and the backfill for existing
cards (60c) come after.

## In scope

- `server/lib/anisongdb.ts`: a REST client for `POST /api/mal_ids_request`,
  with the same failure classification `postGraphQL` already applies.
- Theme slot mapping: AnisongDB's `"Opening 1"` / `"Ending 2"` to the app's
  existing `"OP1"` / `"ED2"` convention.
- Media URL selection: `HQ` then `MQ` for video, `audio` for audio, each a bare
  filename resolved against an AMQ distribution host.
- Extending `parseAllowedStreamUrl` so `/api/media/stream`, the stream cache,
  and the download path accept `*.animemusicquiz.com` alongside
  `*.animethemes.moe`.
- Carrying AniList's `idMal` through `fetchAnimeFromAniList` so an AniList-keyed
  import can address AnisongDB, which keys on MAL/ANN ids.
- A theme resolver that asks AnisongDB and animethemes.moe in parallel, taking
  clip URLs from AnisongDB and native song titles plus `animethemesThemeId`
  from animethemes.moe, and falling back to animethemes.moe entirely when
  AnisongDB has no match.
- Repointing `/api/lookup/import` at that resolver.

## Out of scope

- `/api/lookup/song-search`, `/api/lookup/artist-search`, and
  `/api/lookup/artist-import` stay on animethemes.moe. That is 60b.
- Existing cards keep their stored animethemes.moe URLs. That is 60c.
- Insert Songs. AnisongDB returns them, but `Song` is unique on
  `(animeId, themeSlot)` and the app has no slot for a non-OP/ED track, so they
  are filtered out here. Supporting them is its own feature.
- No new settings, no schema migration, no new columns. AnisongDB URLs are
  stored in the existing `animethemesVideoUrl` / `animethemesAudioUrl` columns,
  which are in practice "remote video/audio url". Renaming them would touch
  `CardWithDetails`, deck export/import, and every consumer for no behavior
  gain.
- No shared REST helper extracted across `server/lib/mal.ts` and the new
  client. `mal.ts` hand-rolls its own fetch and classification; unifying them
  is an unrelated refactor.
- No host health-checking or failover at playback time. A stored URL names one
  host; the allowlist accepts both so a URL from either keeps working.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - AnisongDB client and response mapping** - create
  `server/lib/anisongdb.ts` with a local `postJson` helper that classifies
  failures exactly as `postGraphQL` does (network error, timeout at the same
  5s budget, 403, 429, and 5xx to `ProviderUnavailableError`; other non-ok to
  `ProviderRequestError`; unparseable or wrong-shaped JSON to
  `ProviderUnavailableError`), plus `fetchThemesByMalId(malId, aniListId)` and
  the pure mappers it uses. Not wired into any route yet. *Done when:*
  `bun run test` passes with colocated tests covering:
  - slot mapping (`"Opening 1"` to `"OP1"`, `"Ending 12"` to `"ED12"`,
    `"Insert Song"` to null so it is dropped)
  - media selection (`HQ` preferred, `MQ` when `HQ` is null, both null yields
    no video url; an entry with no `HQ`, `MQ`, or `audio` is dropped entirely
    rather than imported as a sourceless theme)
  - entry rejection when `linked_ids.myanimelist` is not the id that was asked
    for, or `linked_ids.anilist` is missing or is not the AniList id the caller
    is importing
  - `isDub: true` entries dropped
  - deterministic de-duplication when two entries map to the same slot: prefer
    a non-rebroadcast entry, then one with `HQ`, then `MQ`, then `audio`,
    tie-breaking on the lowest `annSongId`, so a re-import cannot silently
    swap a card's source
  - each failure class above
- [x] **Step 2 - Allow AMQ media hosts through the cache and download** -
  extend `parseAllowedStreamUrl` in `server/utils/streamCache.ts` to accept
  `animemusicquiz.com` and its subdomains over https, alongside the existing
  animethemes.moe rule, and update `/api/media/stream`'s error message so it no
  longer says "must be an https animethemes.moe URL". *Done when:* a ranged
  request to `/api/media/stream?url=https://naedist.animemusicquiz.com/<file>`
  returns `206` with the right `Content-Type` and leaves exactly one file in
  the stream cache directory; a second request serves from cache without a
  refetch; a URL on any other host still returns `400`; a test covers the
  allowlist predicate for both allowed hosts, a lookalike
  (`animemusicquiz.com.evil.test`), and plain http.
- [x] **Step 3 - Carry `idMal` through the AniList lookup** - add `idMal` to
  `BY_ID_QUERY`, to `AniListAnime` as `malId: number | null`, and to
  `toAniListAnime`'s validation, so `AnimeMetadata` exposes it. Nothing
  consumes it yet. *Done when:* `bun run test` passes with a test asserting
  `toAniListAnime` maps a present `idMal`, tolerates a null one, and rejects a
  non-numeric one; `/api/lookup/import`'s response shape is unchanged.
- [x] **Step 4 - Theme resolver preferring AnisongDB** - add
  `server/utils/themeSource.ts` exporting `resolveThemes({ aniListId, malId })`,
  which calls AnisongDB (by MAL id) and `fetchAnimeThemesByAniListId` in
  parallel and merges them **by song title**: clip URLs from AnisongDB for the
  entry whose normalized title matches, all metadata from animethemes.moe, and
  the full animethemes.moe result when AnisongDB returns nothing, has no MAL id
  to query, or is unavailable. Revised from "merge by theme slot" during
  implementation, after a 12-anime live probe found the two providers number
  slots differently: BanG Dream! Ave Mujica's ED1 on animethemes.moe is
  AnisongDB's `Ending 2`, so a slot merge put one song's title on another
  song's audio. 7 of 29 slots disagreed on title, 2 of them genuinely different
  songs. An AnisongDB entry that matches no animethemes.moe title is added only
  when its slot is otherwise free, and a real romanization difference falls back
  to animethemes.moe rather than guessing.
  Parallel rather than sequential so import is no slower than today while
  playback gets the fast URLs. *Done when:* `bun run test` passes with tests
  for AnisongDB-only, animethemes-only, both-present merge (URLs from
  AnisongDB, native title and `animethemesThemeId` retained), a slot only one
  provider knows about (kept, from whichever has it), AnisongDB unavailable,
  animethemes.moe unavailable, both unavailable (the existing
  `ProviderUnavailableError` surfaces rather than a silent empty theme list),
  and `malId` null.
- [x] **Step 5 - Wire the resolver into `/api/lookup/import`** - replace the
  direct `fetchAnimeThemesByAniListId` call in
  `server/api/lookup/import.post.ts` with `resolveThemes`, and stop
  `upsertSong` from erasing a stored `animethemesThemeId` **or `titleNative`**
  when the incoming value is null (it currently sets both columns
  unconditionally on conflict, unlike `upsertAnime`, which deletes null keys
  from its update set). `titleNative` was added to this step during
  implementation: a slot only AnisongDB knows about resolves with
  `songTitleNative: null`, so re-importing an anime whose native song titles
  came from an earlier AnimeThemes import would have wiped them. Same defect
  class as `animethemesThemeId`, same fix.
  *Done when:* expanding an anime in `/cards`' Anime add-candidate group lists
  the same themes as before; adding one creates a card whose remote URLs point
  at `naedist.animemusicquiz.com`; that card plays in Study and Preview;
  re-importing the same anime after an AnisongDB failure does not null out an
  existing `animethemesThemeId`; a test covers the preserved-on-null behavior.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/lib/anisongdb.ts` (new) | REST client, mappers, failure classification |
| `nuxt-app/server/lib/anisongdb.test.ts` (new) | Step 1 coverage |
| `nuxt-app/server/utils/streamCache.ts` | `parseAllowedStreamUrl` host allowlist |
| `nuxt-app/server/utils/streamCache.test.ts` (new) | Allowlist predicate coverage |
| `nuxt-app/server/api/media/stream.get.ts` | Error message wording only |
| `nuxt-app/server/lib/anilist.ts` | `idMal` in the by-id query and `AniListAnime` |
| `nuxt-app/server/lib/anilist.test.ts` | `toAniListAnime` mapping of `idMal` |
| `nuxt-app/server/utils/animeMetadata.ts` | `AnimeMetadata` carries `malId` through |
| `nuxt-app/server/utils/themeSource.ts` (new) | The merge/preference resolver |
| `nuxt-app/server/utils/themeSource.test.ts` (new) | Step 4 coverage |
| `nuxt-app/server/api/lookup/import.post.ts` | Calls the resolver |
| `nuxt-app/server/utils/lookup.ts` | `upsertSong` stops erasing `animethemesThemeId` on null |

No client-side files change in 60a. `/cards`' add-candidate components already
render whatever `/api/lookup/import` returns.

## Data / contracts

**Load-bearing, consumed by 60b and 60c.** The resolver's output deliberately
matches the existing `AnimeThemeLookup` shape from `server/lib/animethemes.ts`,
widened where AnisongDB cannot fill a field:

```ts
export interface ResolvedTheme {
  themeSlot: string;                    // "OP1", "ED2" - already the app's convention
  songTitle: string | null;
  songTitleNative: string | null;       // AnimeThemes only; AnisongDB has no native songName
  artistName: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  animethemesThemeId: number | null;    // null when only AnisongDB knew this slot
  source: "anisongdb" | "animethemes" | "merged";
}
```

AnisongDB request and response, as verified live on 2026-09-13:

```
POST https://anisongdb.com/api/mal_ids_request
{ "mal_ids": [52991], "ignore_duplicate": true }
```

returns an array of entries carrying `songType` (`"Opening 1"`), `songName`,
`songArtist`, `linked_ids: { myanimelist, anidb, anilist, kitsu }`, and the
media filenames `HQ`, `MQ`, `audio`. Filenames resolve against
`https://naedist.animemusicquiz.com/<file>`. The OpenAPI spec is at
`https://anisongdb.com/openapi.json`.

No schema migration. `Card.animethemesVideoUrl` / `animethemesAudioUrl` now
hold a URL from either provider; the column names are historical.

## Testing

Vitest is configured (`bun run test` from `nuxt-app/`), so the logic-test gate
is on. In-scope logic that must ship a test with its step:

| Step | Logic needing a test |
|---|---|
| 1 | Slot mapper, HQ/MQ/audio selection, entry rejection and de-duplication, failure classification |
| 2 | `parseAllowedStreamUrl` for both allowed hosts, a lookalike host, plain http |
| 3 | `toAniListAnime` handling of present, null, and invalid `idMal` |
| 4 | Merge and preference rules, plus each provider-failure path |
| 5 | `upsertSong` preserving a stored `animethemesThemeId` when passed null |

Mock `fetch` with `vi.mock`, as the existing provider tests do. Do not call
either live API from a test.

Manual path, after step 5, with `bun run dev` in `nuxt-app/`:

1. Go to `/cards`, search an anime you have not added (for example "Frieren").
2. Expand the Anime result. The theme list should look exactly as it does today.
3. Add one theme, then open its Preview. It should play.
4. Check the card's stored source: its remote URL should be on
   `naedist.animemusicquiz.com`, and playback should start noticeably sooner
   than an existing animethemes.moe-backed card.
5. Confirm the Japanese song title still shows in Preview's info panel with the
   Japanese toggle on, proving the parallel animethemes.moe call still supplies
   `songTitleNative`.

Final gate: `bun run test` and `bun run build` from `nuxt-app/`. There is no
`Verify` command declared in `AGENTS.md`, so those two are the automated gate.

## Notes for the AI

- Server-only. Every provider call stays in `server/lib/` and is reached
  through a `server/api/` route, per `coding-standards.md`.
- Mirror `server/utils/animeMetadata.ts`'s resolver pattern: a factory holding
  the fallback decision for one request, `ProviderUnavailableError` for
  availability failures, and a real error for request-validation failures. Do
  not invent a second fallback mechanism.
- `USER_AGENT` from `server/utils/mediaDownload.ts` is the project's one
  User-Agent constant; reuse it. AniList, animethemes.moe, and GitHub have all
  rejected bare Node defaults (features 3, 48, 54), so assume AnisongDB may
  too.
- `AnimeThemeLookup.animethemesThemeId` is non-null today. The new
  `ResolvedTheme` widens it to nullable; check every consumer of the import
  route's `themes` array compiles against that.
- Never map an AnisongDB entry onto an anime by title. Match only on the
  `linked_ids` the entry carries, and verify both that
  `linked_ids.myanimelist` is the id that was requested and that
  `linked_ids.anilist` is the AniList id being imported. `mal_ids_request`
  takes an array, so a wrong-anime entry in a shared response is a real
  possibility, not a theoretical one.
- `Anime` has no `malId` column and this sub-feature does not add one. 60c can
  recover a MAL id for an already-stored anime with a single AniList by-id
  refetch during its backfill, so nothing here forces a migration on it.
- An AnisongDB entry with no usable media at all is skipped, not imported as a
  sourceless theme. A card must have at least one non-null source (feature 4).
- `Promise.allSettled`, not `Promise.all`, in the resolver. One provider being
  down must not reject the other's result.
- No em dashes in code comments or commit messages, per the Writing section of
  `coding-standards.md`.
