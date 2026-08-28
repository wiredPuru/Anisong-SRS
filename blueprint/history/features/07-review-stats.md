# Feature: Review stats

**From build-plan:** feature 7
**Status:** verified

## Goal

Show guess-rate stats derived from `ReviewLog` so the user can see how well
they're actually learning each song, artist, and anime: an overall pass rate
plus the same metric sliced by artist and by anime title.

## In scope

- A `/stats` page with an overall summary (total reviews, pass rate) and a
  toggle between "By Artist" and "By Title" breakdowns, mirroring the
  `/decks` toggle pattern.
- Per-artist and per-anime rows: total reviews, pass count, fail count, pass
  rate. Artists/anime with cards but zero reviews still show, with pass rate
  displayed as "No reviews yet" rather than 0%.
- A server-side stats module and `/api/stats` endpoint computing these
  aggregates from `card` + `reviewLog` (joined through `song`), following the
  same query shape as `server/utils/decks.ts`.
- A cross-link from `/decks` to `/stats` (decks already link out to
  `/study`; add the same style of link for stats).

## Out of scope

- Per-card stats or a drill-down into individual song history (deferred;
  today's slices are artist-level and anime-level only, matching the build
  plan wording).
- Time-series/trend charts (e.g. pass rate over time) - only current
  cumulative totals.
- Any change to Leitner scheduling, review recording, or the `ReviewLog`
  schema - this feature only reads existing data.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight
   on. Checkpoints are optional; `/complete` makes the real feature-level
   commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the
step was too big, so split it.

## Build steps

- [x] **Step 1 - Stats data layer + API** - add `server/utils/stats.ts` with
  `getOverallStats()`, `listArtistStats()`, `listAnimeStats()`, and
  `server/api/stats.get.ts` handling `?type=overall|artist|anime` (400 on
  any other/missing value, matching `decks.get.ts`'s error style). *Done
  when:* `curl` (or the Nuxt server) against `/api/stats?type=overall`,
  `?type=artist`, and `?type=anime` returns correct shape and numbers,
  verified against the DB's actual `review_log` rows (spot-check via
  `sqlite3` or a temporary log) for at least one artist/anime with reviews
  and one with none.
- [x] **Step 2 - `/stats` page UI** - new `nuxt-app/app/pages/stats/index.vue`
  with the overall summary, the artist/title toggle and list (loading/error/
  empty states, matching `/decks`' conventions), and the cross-link from
  `/decks/index.vue`. *Done when:* visiting `/stats` shows the overall pass
  rate and both slices with real data from cards that have been studied at
  least once (via `/study`), the toggle switches slices without a full page
  reload, and the empty/zero-review state reads as "No reviews yet" instead
  of "0%".

## Files / areas

- `nuxt-app/server/utils/stats.ts` - new. Aggregation queries.
- `nuxt-app/server/api/stats.get.ts` - new. Thin handler, same shape as
  `decks.get.ts`.
- `nuxt-app/app/pages/stats/index.vue` - new. Page UI.
- `nuxt-app/app/pages/decks/index.vue` - small edit to add the `/stats`
  cross-link.

## Data / contracts

No schema changes - reads existing `card`, `song`, `artist`, `anime`,
`reviewLog` tables. New response shapes (server-only, not shared types since
no other feature consumes them):

```ts
interface OverallStats {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null; // 0-1, null when totalReviews is 0
}

interface ArtistStats {
  id: number;
  name: string;
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

interface AnimeStats {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}
```

`passRate` is `null` (not `0`) when `totalReviews` is `0`, so the UI can
distinguish "never studied" from "studied and always failed."

## Testing

No test runner is configured yet (`AGENTS.md` Commands section has no `test`
entry), so this rides on direct verification, not unit tests:

- Step 1: hit `/api/stats` with each `type` value via the running dev server
  and compare returned counts against the `review_log` table directly.
- Step 2: browser check - study a few cards via `/study` to generate review
  history, then confirm `/stats` reflects it, the toggle works, and the
  build (`bun run build`) is clean.

If `/tests` is run later and a runner gets added, `listArtistStats` /
`listAnimeStats` / `getOverallStats` would be reasonable candidates for a
focused test then (pure aggregation logic over seeded rows), but that's not
part of this feature's scope today.

## Notes for the AI

- Server-only aggregation: filesystem/API rules from `coding-standards.md`
  don't apply here, but the client/server split does - all DB access stays
  in `server/utils/stats.ts` and `server/api/stats.get.ts`, the page just
  calls the API.
- Match existing conventions exactly: `useFetch` for the page's initial load
  with explicit loading/error states, query-string params (`?type=`) not a
  dynamic route segment, scoped `<style>` using `var(--token)`, and the same
  toggle-button visual pattern already built in `/decks`.
- Use a `left join` from `card` to `reviewLog` (not inner join) so
  artists/anime with cards but no reviews still appear with zero counts -
  same reasoning as why `listArtistDecks`/`listAnimeDecks` inner-join
  through `card` in `decks.ts` (only decks with at least one card show at
  all), but reviews are the optional layer on top.
- Reuse the SQL pattern from `server/utils/decks.ts` (`count`, `groupBy`,
  join through `song`) rather than inventing a different query shape for
  `card` -> `song` -> `artist`/`anime`.
