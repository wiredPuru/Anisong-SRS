# MyAnimeList import is broken; AniList list import fails without a usable message

## Type

Fix

## Status

complete (2026-09-12)

## The problem

Tested live on 2026-09-11 against `bun run dev` and both upstreams directly.
Three distinct problems, only one of which is an upstream outage we cannot fix.

| Surface | Result | Cause |
|---|---|---|
| `GET /api/lookup/anilist-search` | works | AnimeThemes fallback (commit `d0a3684`) covers it; covers come back `null` |
| `POST /api/lookup/import` | works | same fallback; 16/16 repeat calls returned themes |
| `GET /api/lookup/mal-list` | **always fails** | Jikan's MAL scrape is down |
| `GET /api/lookup/anilist-list` | **always fails** | AniList's API is disabled upstream |

### 1. MyAnimeList import is dead at the Jikan hop (fixable)

`server/lib/jikan.ts` calls `https://api.jikan.moe/v4/users/{user}/animelist/completed`.
That endpoint returns HTTP 504 on every attempt:

```
{"status":504,"type":"BadResponseException",
 "message":"Jikan failed to connect to MyAnimeList. MyAnimeList may be down/unavailable or refuses to connect"}
```

Five consecutive attempts over several minutes, on both URL shapes
(`/animelist/completed` and `/animelist?status=completed`). Jikan itself is
healthy - `GET /v4/anime?q=naruto` returns 200 - so this is specifically MAL
refusing Jikan's scrape, not a Jikan outage we can wait out.

MyAnimeList's own public list endpoint, which is the page Jikan scrapes, works
directly and needs no key, no cookie, and no browser-spoofed header - it
answered on the app's own `USER_AGENT`:

```
GET https://myanimelist.net/animelist/{user}/load.json?status=2&offset={n}
```

Measured against user `Xinil` (233 completed): `offset=0` -> 233 entries,
`offset=100` -> 133, `offset=200` -> 33, `offset=300` -> `[]`. So `offset` is
an item offset, the page size is 300, and an exhausted list returns `[]`.
Entries carry `anime_id` and `anime_title`, the two fields `fetchMalCompletedList`
already maps. An unknown username returns HTTP 400
`{"errors":[{"message":"invalid request"}]}`, not a 404.

### 2. The MAL failure reports no cause (fixable)

`fetchMalCompletedList` throws a plain `Error`, so it carries no `statusMessage`:

- streaming path (what the UI uses): `{"type":"error","message":"Import failed. Please try again."}`
- non-streaming path: HTTP **500 "Server Error"**, body message `Jikan completed-list lookup failed with status 504`

Compare the AniList route, which throws `ProviderUnavailableError` and correctly
produces HTTP 503 with a real message. The MAL side gives the user nothing to act
on, which is why this reads as an unexplained server error.

### 3. AniList's Completed-list import cannot be fixed here (presentation only)

`https://graphql.anilist.co` returns HTTP 403 for every query:

> "The AniList API has been temporarily disabled due to severe stability issues."

Anime search and anime import survive because `createAnimeMetadataResolver()`
falls back to AnimeThemes. A personal Completed list has no AnimeThemes
equivalent, so `/api/lookup/anilist-list` genuinely cannot work right now. It
already fails cleanly (HTTP 503, "AniList is temporarily unavailable"), and
`useCompletedListImport` already keeps MAL results when the AniList half fails.
What is missing is telling the user this is upstream and that MyAnimeList still
works - the current wording reads like the app is broken.

## The fix

Replace the Jikan hop with a direct call to MyAnimeList's own `load.json`, give
MAL failures a real message, and say plainly in the UI that AniList is down
upstream while MyAnimeList still works.

Must not break:

- `mal-list`'s existing contract: same `{ results }` shape, same per-page
  progress reporting, same 404 on an unknown user, same skip-don't-fail behavior
  for an entry with no AniList counterpart.
- The MAL -> AniList crosswalk, which the AnimeThemes fallback already handles
  correctly. Verified live: `findAnimeByExternalSite(site: MAL, id: [52991])`
  returns AniList `154587` (Frieren), and `[40748]` returns `113415` (Jujutsu
  Kaisen) - real diverging IDs, not the coincidental MAL/AniList overlap seen on
  low-numbered anime.
- `respondWithImportProgress`'s two response paths (ndjson stream and plain JSON).
- AniList staying the primary metadata provider once it recovers. Nothing here
  touches `animeMetadata.ts`'s resolver or the AnimeThemes fallback.

## Build steps

### Step 1 - fetch the MAL Completed list from MyAnimeList directly

Rewrite `server/lib/jikan.ts` as `server/lib/mal.ts` (Jikan has no other caller -
grep confirms only `mal-list.get.ts` and the tests import it), keeping the same
exported shape: `fetchMalCompletedList(username, onPage?)` returning
`{ malId, title }[]`, with the not-found error class renamed to
`MalUserNotFoundError`. Page `load.json?status=2&offset=n` in steps of 300,
stopping when a page returns fewer than 300 entries; keep the existing `MAX_PAGES`
safety net. Map `anime_id` -> `malId` and `anime_title` -> `title`, validating
both rather than trusting the shape. Translate HTTP 400 into the not-found error
(its message must cover both real cases: no such user, or a private list), and any
other non-OK status into `ProviderUnavailableError("MyAnimeList")` so the route
returns 503 with a real message instead of a bare 500. Update `mal-list.get.ts`'s
import and error class, and port `jikan.test.ts` to `mal.test.ts` against the new
paging and error contract.

**Done when:** `bun run test` passes, and with the dev server running,
`curl -H 'accept: application/x-ndjson' 'http://localhost:3000/api/lookup/mal-list?username=Xinil'`
streams page progress and a `{"type":"done","result":{"results":[...]}}` line with
a non-empty `results` array, each entry carrying a real `aniListId`. An unknown
username still ends the stream with a not-found message, and a forced upstream
failure ends it with a message naming MyAnimeList rather than
"Import failed. Please try again."

### Step 2 - say what is actually wrong in the import panel

In `app/pages/cards/index.vue`'s import panel, when the AniList source errors with
an upstream-unavailability message, show that it is an AniList-side outage and
that a MyAnimeList username still works, instead of the current bare
`AniList: {{ importAniListError }}` line. Keep the existing per-source error lines
for every other failure (bad username, network), keep both sources independent, and
keep MAL results rendering when only the AniList half failed.

**Done when:** on `/cards`, submitting both an AniList and a MyAnimeList username
shows the AniList outage explained in-panel while the MyAnimeList results list
renders below it in the same run; submitting only a bad MyAnimeList username still
shows that username's own error and no AniList line.

## Verify

1. `cd nuxt-app && bun run test` - green, including the ported `mal.test.ts`.
2. `bun run build` - clean.
3. `bun run dev`, then on `/cards` open "Import from AniList / MyAnimeList":
   - MyAnimeList username alone -> progress ticks up, candidates render, an
     already-added anime shows as added.
   - AniList username alone -> a clear "AniList is down upstream, try MyAnimeList"
     message, no raw 500 or bare "Import failed."
   - Both together -> AniList explained, MyAnimeList results still listed.
4. Re-check `curl -s https://graphql.anilist.co ...` before closing this out; if
   AniList has come back, confirm step 2's message no longer appears and the
   AniList list import works again unchanged.

## Notes for review

- **Scoped out, flagged:** the very first `POST /api/lookup/import` call of the
  session failed once with "Anime metadata lookup is temporarily unavailable",
  then succeeded on all 16 retries across 8 anime. With AniList down, AnimeThemes
  is the only provider left and `postGraphQL` has a 5s timeout and no retry, so a
  single upstream blip becomes a hard failure. Not reproducible enough to fix
  blind; say so if you want a retry added as a third step.
- Testing wrote real rows into the dev database (`nuxt-app/.data/gaq-srs.db`) for
  Jujutsu Kaisen, Frieren, Naruto Shippuden and a few others, via the successful
  `/api/lookup/import` probes.
- Swapping Jikan for MAL's own endpoint removes `api.jikan.moe` from the tech
  stack. `project-overview.md` lists Jikan under Tech stack and feature 58, so
  that entry needs amending when this is completed.

## Implementation evidence - step 1 (2026-09-11)

`server/lib/jikan.ts` and its test were deleted; `server/lib/mal.ts` replaces them,
paging `myanimelist.net/animelist/{user}/load.json?status=2&offset=n` in steps of
300 and stopping on a short page. `MalUserNotFoundError` covers HTTP 400/404 (a
missing user and a private list are indistinguishable in MAL's response); every
other non-OK status, network failure, unparseable body, non-array body, or page
whose entries all fail validation raises `ProviderUnavailableError("MyAnimeList")`,
so the route answers 503 with a real message instead of a bare 500. Only
`mal-list.get.ts` imported the old client, so the swap was contained; two stale
comments naming Jikan were updated in `anilist.ts` and `importCandidates.ts`.

- `bun run test`: 158 passed (23 files), up from 153 (-2 Jikan, +7 `mal.test.ts`).
- Live import, MAL user `Xinil`: 233 entries fetched in one page, 170 resolved to
  AniList ids through the AnimeThemes crosswalk, 63 skipped as absent from
  AnimeThemes. Took 208s (see Known limits below).
- Unknown user, both response paths: stream ends with
  `{"type":"error","message":"MyAnimeList user \"...\" not found, or their list is
  private"}`; plain JSON returns 404 with the same message.

## Implementation evidence - step 2 (2026-09-11)

`createImportStream` now flags an error event with `unavailable: true` when the
cause was a `ProviderUnavailableError`; `readImportStream` attaches that to the
thrown error (also reading it from a pre-stream 503) and exports `isUnavailable()`;
`useCompletedListImport` tracks it per source; `/cards`' import panel renders a
dedicated line for an outage and keeps the existing `AniList:` / `MyAnimeList:`
lines for anything the user can act on. A server-set flag was chosen over matching
the message text, since the server already knows the error class.

- `bun run test`: 164 passed (23 files). `bun run build`: clean.
- Browser (playwright-cli, dev server), both usernames in one run (`Josh` /
  `Sakura`): panel showed "MyAnimeList complete: 38 anime found.", the AniList
  outage line, "Found 38 anime (38 from MyAnimeList)." and the candidate list.
- Browser, bad MyAnimeList username alone: "MyAnimeList: MyAnimeList user
  "zzzz_no_such_user_9182" not found, or their list is private", with no AniList
  line and no outage copy.

## Known limits

- **Resolution is sequential.** `mal-list.get.ts` calls AnimeThemes once per MAL
  entry, roughly 0.9s each: 208s for 233 anime, 30s for 41. Not a regression (the
  route returned nothing at all before this fix), but newly visible.
  `findAnimeByExternalSite(site: MAL, id: $id)` takes an `[Int!]` list, so batching
  around 25 ids per call would cut that to roughly a tenth. Deliberately out of
  scope here; `animeMetadata.ts` was left untouched.
- **`load.json` is undocumented**, the same class of dependency as Jikan's scrape
  with one hop fewer. A field rename now surfaces as an outage rather than as an
  empty list, by design.
- **AniList's own Completed-list import still cannot work** while their API is
  disabled; step 2 only makes that legible. Nothing about the fallback resolver
  changed, so AniList resumes as the primary provider on its own when it returns.
- **`api.jikan.moe` is no longer used anywhere.** `project-overview.md` lists Jikan
  under Tech stack and in feature 58's entry, and `project-plan.md` §5 carries a
  Jikan line; both need amending on the next `/overview`.
