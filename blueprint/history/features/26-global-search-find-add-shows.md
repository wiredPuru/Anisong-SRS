# Feature: Global search: find + add shows

**From build-plan:** feature 26
**Status:** verified

## Goal

Today the nav search bar (`/api/search`) only ever searches what's already in
the local DB. If you type an anime that isn't in your library yet, you get "No
results" with no path forward - you have to know to go to `/cards/new` and
search AniList separately. This feature closes that gap: when the local
"Anime" group comes back empty, the dropdown also checks AniList and offers an
inline "Add" action per result that jumps straight into the existing
lookup/import flow on `/cards/new`, already on the right anime with its
themes loading.

## In scope

- The nav search dropdown (`NavBar.vue`) fires a fallback AniList search
  (reusing the existing `GET /api/lookup/anilist-search` endpoint) only when
  the query is long enough to have run a local search (2+ chars, matching the
  existing local-search gate) and the local `anime` result group came back
  empty.
- Results render in a new "Add a show" group in the dropdown, each with an
  inline "Add" button.
- Clicking "Add" navigates to `/cards/new?aniListId=<id>` and closes the
  dropdown.
- `/cards/new` reads an `aniListId` query param on mount and, if it's a valid
  number, immediately calls the page's existing `selectAnime` import flow with
  it - skipping the manual "search AniList" step so the theme list (and
  per-theme "Add card" buttons) appears right away.
- Loading state ("Searching for shows...") and a degrade-gracefully error
  state (AniList unreachable) for the fallback search, independent of the
  local search's own pending/error state.

## Out of scope

- Duplicating the theme list / "Add card" UI inside the nav dropdown itself -
  "Add" always hands off to `/cards/new`, which already owns that flow (per
  the build-plan line, this feature reuses it rather than rebuilding it).
- Any change to `/api/search`'s existing contract or its four local result
  groups (cards/artists/anime/decks) - untouched.
- Bulk/artist-catalog import (a separate, already-flagged open item, not this
  feature).
- Searching animethemes.moe directly from the dropdown - the existing
  AniList-first, animethemes-on-import order is unchanged.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Nav search surfaces AniList results with an Add action** -
  In `NavBar.vue`: after a local search resolves, if `results.anime.length ===
  0`, call `GET /api/lookup/anilist-search?q=` (same endpoint `/cards/new`
  already uses). Track this in its own state (`externalAnime: AniListResult[]
  | null`, `externalPending`, `externalError`) so it doesn't interfere with
  the existing local `searchPending`/`searchError`/`hasResults` states. Render
  a new "Add a show" group (styled like the existing `search-group` /
  `search-result` blocks) when `externalAnime` has entries, and an inline
  "Searching for shows..." status while pending. If the AniList call fires
  and comes back empty, or fails, fold into the existing single "No results."
  line rather than adding a second empty/error message - the dropdown should
  never show two different "nothing here" states at once. Guard against the
  now-two-stage (`local` then `external`) async chain resolving out of order
  when the user types again mid-flight: give each `runSearch()` invocation a
  local generation number and drop its results if a newer invocation has
  since started, the same way you'd guard any stale-response race - this
  wasn't a real risk with the old single-`$fetch` version but is now that a
  search can await two calls in sequence. Clicking a result's "Add" button
  calls `resetSearch()` then `navigateTo(`/cards/new?aniListId=${result.aniListId}`)`.
  *Done when:* searching for a show not in the library shows an "Add a show"
  section with a working "Add" button that lands on `/cards/new` with the
  right `aniListId` in the URL; searching for something already in the
  library (local anime match exists) never fires the AniList call; a query
  with zero local and zero AniList matches shows exactly one "No results.";
  killing network to AniList also folds into that same single message rather
  than a second error line; typing a fast follow-up query before the first
  one's AniList round-trip resolves never lets the stale first query's
  results flash in afterward.

- [x] **Step 2 - `/cards/new` auto-imports from a deep-linked `aniListId`** -
  In `app/pages/cards/new.vue`: on mount, read `route.query.aniListId`. If it
  parses as a positive integer, call the existing `selectAnime()` with a
  synthetic `AniListResult` (`{ aniListId, titleRomaji: "", titleEnglish:
  null, titleNative: null }`) immediately, so the existing
  `importing`/`importError`/theme-list rendering takes over exactly as it
  does for a manually-selected result - no new import logic. An invalid or
  missing `aniListId` leaves the page exactly as it is today (manual search
  form, nothing pre-selected).
  *Done when:* navigating to `/cards/new?aniListId=<a real AniList id>` shows
  "Loading themes..." then the theme list for that anime with no manual
  search step required; `/cards/new` with no query param, or a malformed
  `aniListId`, behaves exactly as it does today.

## Files / areas

- `nuxt-app/app/components/nav/NavBar.vue` - fallback AniList search, new
  dropdown group, `addShow` navigation.
- `nuxt-app/app/pages/cards/new.vue` - `aniListId` query param handling on
  mount.
- No server-side changes - both steps only call the existing `GET
  /api/lookup/anilist-search` endpoint from a new call site.

## Data / contracts

- Reuses the existing `AniListResult` shape returned by `GET
  /api/lookup/anilist-search` (`{ aniListId, titleRomaji, titleEnglish,
  titleNative }`), already defined independently in `cards/new.vue`; `NavBar.vue`
  needs its own copy of the same shape (no shared type file exists yet for
  this interface, matching the project's current per-file interface
  convention - see `CardWithDetails` duplicated across `NavBar.vue` and
  `cards/new.vue` today).
- No schema changes, no new API routes.

## Testing

No test runner is configured in `AGENTS.md`, so this rides on manual/browser
verification, not unit tests:

- Search for an anime title not yet in the library -> "Add a show" section
  appears with AniList matches -> "Add" navigates to `/cards/new?aniListId=`
  -> theme list loads automatically.
- Search for an anime already in the library -> only the existing local
  "Anime" group shows; confirm (via browser devtools network tab) that no
  AniList call fires.
- Search a nonsense string with zero local and zero AniList matches -> "No
  results." shows once, not duplicated with an empty "Add a show" section.
- With devtools network throttling on, type a query, then quickly replace it
  with a different one before the first finishes -> only the final query's
  results ever render (no stale flash from the first).
- Visit `/cards/new` directly (no query param) and with a malformed
  `aniListId` (e.g. `?aniListId=abc`) -> confirm today's plain search form,
  unchanged.

## Notes for the AI

- Client-only feature - no server route changes, so the "server routes for
  anything touching SQLite/fs/external GraphQL" rule in
  `coding-standards.md` doesn't add new surface here; the external call was
  already server-proxied by the existing `/api/lookup/anilist-search` route.
- Follow the established `useFetch` (initial load) / `$fetch` (mutation or
  ad-hoc fetch) split already used elsewhere - the AniList fallback call is a
  `$fetch`, consistent with how `cards/new.vue` already calls the same
  endpoint.
- Keep the local search's existing behavior byte-for-byte unchanged; the
  external section is strictly additive and must degrade to today's exact
  behavior when AniList is unreachable or the query matches locally.

## Verification evidence

- `bun run build` - clean (run three times across both steps and the final
  safety pass). No `Verify` command or test runner is declared in `AGENTS.md`,
  so the build is the automated gate.
- Endpoint-level evidence via curl (dev server): `/api/search?q=<nonsense>`
  returns all-empty groups; `/api/lookup/anilist-search?q=Bocchi` returns live
  AniList results; `POST /api/lookup/import {aniListId: 130003}` returns the
  anime and full theme list (the exact call `selectAnime` makes); `/cards/new`
  with no param, `?aniListId=abc`, `?aniListId=-5`, and `?aniListId=130003` all
  return `200` with no server error.
- Gap: Playwright is not installed in this project, so the interactive
  dropdown (typing, debounce, clicking Add) was not clicked through in a live
  browser. Verified instead by code read-through plus the endpoint/build
  evidence above.

## Findings

None raised against this feature.
