# Feature: Default story fetch (118a)

**From build-plan:** feature 118a (sub-feature of 118, "RTK stories on Kanji Study")
**Status:** verified (tests, build, curl against the live site; offline path covered by unit tests only)

## Goal

A server route that returns the top Koohii story for one kanji, fetched from
`hochanh.github.io/rtk` on first request and cached locally, so 118b can show it
as the default beside the user's own story. No UI.

## In scope

- `server/lib/rtkStories.ts`: `parseTopStory(html)` (pure) and
  `fetchTopStory(char)` that GETs `https://hochanh.github.io/rtk/<char>/index.html`.
- A cache table `kanji_default_story` (migration) and `getDefaultStory(char)` in
  `server/utils/kanjiDefaultStories.ts`.
- `GET /api/kanji/story/default?char=` returning the story, its author and the
  source page URL, or a null story with a reason.

## Out of scope

- Any UI (118b), saving a default as the user's story (118b), and stepping
  through stories other than the first.
- Bundling or bulk-fetching stories. One kanji per request, ever.
- Re-fetching a cached story (no expiry; the site is static).

## Decisions made in this spec

- **Top story = first `<p>` under "Koohii stories"** (the site lists them by
  votes). Author comes from its profile link; text is the body with tags
  stripped (`<strong>`, `<em>` become plain text), entities decoded, whitespace
  collapsed, capped at 2000 characters to fit the story editor's limit.
- **Cache both outcomes that are facts:** a story, or "page exists with no
  story / 404" (stored as `text = NULL`). Network failures and non-404 errors
  are not cached, so a later request retries.
- **Offline:** a cached story is still returned; with no cache, no request is
  made and the reply is `{ text: null, reason: "offline" }`. The route never
  throws for provider trouble, because the default is an extra (like feature
  110b's story load): `reason` is `"offline" | "unavailable" | "none"`.
- **10 second timeout** on the fetch, `User-Agent` from `mediaDownload.ts`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Parser and client** - `parseTopStory` and `fetchTopStory` in
  `server/lib/rtkStories.ts`, with `rtkStories.test.ts`: the 花 page (author
  `Copycatken`, text "The flowers change with the seasons."), a page with
  entities and nested tags, a page with no stories, a story over 2000 chars
  (truncated), and `fetchTopStory` with a mocked `fetch` for 200, 404 (returns
  `{ status: "none" }`), a 500 and a thrown error (both `ProviderUnavailableError`),
  and offline (`assertOnline` throws, no fetch call). *Done when:* `bun run test`
  passes.
- [x] **Step 2 - Cache table and lookup** - `kanjiDefaultStory` in `schema.ts`,
  a generated migration, and `getDefaultStory(char)`: cache hit returns without
  fetching, miss fetches and stores (story or null), failures are not stored,
  offline with no cache returns `reason: "offline"`. Tests in
  `kanjiDefaultStories.test.ts` for each case with `fetchTopStory` mocked.
  *Done when:* tests pass and the migration applies on a fresh in-memory db.
- [x] **Step 3 - Route** - `server/api/kanji/story/default.get.ts` using
  `parseStoryChar` (400 on a bad char), returning `{ char, text, author, url,
  reason }`. *Done when:* with the dev server running, `curl
  "localhost:3000/api/kanji/story/default?char=花"` returns the Copycatken story,
  a second call is served from the cache (no second request), and Offline mode
  with an uncached kanji returns `text: null, reason: "offline"`.

## Files / areas

- `nuxt-app/server/lib/rtkStories.ts` (+ test)
- `nuxt-app/server/utils/kanjiDefaultStories.ts` (+ test)
- `nuxt-app/server/db/schema.ts`, `server/db/migrations/0043_*.sql`
- `nuxt-app/server/api/kanji/story/default.get.ts`

## Data / contracts

- Load-bearing for 118b: reply `{ char: string; text: string | null; author:
  string | null; url: string; reason: "offline" | "unavailable" | "none" | null }`
  (`reason` null when `text` is set). `url` is always the kanji's page on the
  site, for attribution.
- New table `kanji_default_story`: `char` PK, `text` nullable, `author` nullable,
  `fetchedAt` timestamp. The user's `kanji_story` is never read or written here.

## Testing

- Vitest for the parser (fixtures from the real 花 and 魔 pages), the client and
  the cache logic; the route is thin and rides on the curl evidence above.
- Verify with the real site once (the 花 curl), not in the test suite.

## Notes for the AI

- Mirror `server/lib/mal.ts` for the fetch shape, `ProviderUnavailableError`
  and `assertOnline`. Use `encodeURIComponent` on the character.
- Never fetch more than one kanji page per request. Do not add retries.
- No em dashes in generated text; keep comments to the why.
