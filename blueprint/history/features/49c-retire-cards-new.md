# Feature: Retire /cards/new

**From build-plan:** feature 49c
**Status:** verified

## Goal

Features 49a and 49b moved every capability of the standalone `/cards/new`
page into `/cards`' own search box: Anime add-candidates with an inline
theme-picker, Song one-click add, and the Artist catalog modal with Add all /
Download all. `/cards/new` is now a second, redundant implementation of the
same three flows. This step rewires every link that still points at it and
deletes the page, finishing feature 49 - one surface for finding an existing
card or adding a new one.

## In scope

- **Seed `/cards`' search from a `?q=` query param** so other pages can hand
  off a search to it. Read it on mount *and* on subsequent query changes (a
  `watch`, not just `onMounted`): NavBar sits on every page including
  `/cards`, so a nav-bar search submitted while already on `/cards` navigates
  `/cards` -> `/cards?q=X` without remounting the page component.
- **Rewire NavBar's three navigations** (`app/components/nav/NavBar.vue`) to
  `/cards?q=<text>` instead of `/cards/new?...`:
  | Function | Today | After |
  |---|---|---|
  | `onSearchEnter()` | `/cards/new?q=<query>` | `/cards?q=<query>` |
  | `addShow(result)` | `/cards/new?aniListId=<id>` | `/cards?q=<result.titleRomaji>` |
  | `selectArtistResult(candidate)` | `/cards/new?artistSlug=<slug>` | `/cards?q=<candidate.name>` |
  Each carries text that re-surfaces the very result the user clicked, since
  `/cards`' groups query the same endpoints with the same string.
- **Rewire the four in-app links**, with copy that points at the search box
  now that adding happens there:
  - `/cards`' header "Add card" link becomes a button that focuses the page's
    existing search input (keeping a visible affordance - the one place the
    app advertises adding).
  - `/cards`' empty state: "No cards yet. Add one." -> wording that sends the
    user to the search box above.
  - `/decks`' and `/stats`' empty-state links: `to="/cards/new"` ->
    `to="/cards"`, copy otherwise unchanged.
  - `/cards`' hint line reworded so the search box's dual purpose (find *and*
    add) is discoverable to a returning user.
- **Delete `app/pages/cards/new.vue`** once nothing links to it.

## Out of scope

- **Preserving feature 47's "no second click" behavior for NavBar's Anime and
  Artist results.** Today those deep links auto-run the import on arrival;
  after this step they land on `/cards` with the query pre-filled and the
  matching result one click away in its group. This is a deliberate trade,
  not an oversight: auto-opening the Artist modal on arrival would cover the
  local/Anime/Song groups behind an overlay, working directly against the
  unification feature 49 exists to deliver. Threading auto-open target props
  into the group components stays available if the extra click proves
  annoying in use.
- **A redirect from `/cards/new` to `/cards`.** The route 404s after this
  step. For a local single-user app with no external inbound links, a
  permanent redirect is clutter against a stated goal of deleting the page;
  easy to add later if a stale bookmark actually bites.
- **NavBar's search dropdown itself, and the deck-detail add flow** (features
  28/33). Feature 49's parent text describes the unified search as replacing
  those as *entry points*, but 49c's own scope is only the page plus its
  links. The dropdown keeps working exactly as it does today, just with new
  destinations; the deck-detail flow never touched `/cards/new` at all (it
  opens `DeckAddAnimeModal` in place) and is unaffected.
- **Any server-side change.** No endpoint is added, removed, or altered;
  `/cards/new` was a pure client page.
- **Regenerating `blueprint/context/project-overview.md`.** Its route list
  mentions `/cards/new` in 24 places and will be stale until `/overview` runs
  - a follow-up after merge, not part of this feature.
  `blueprint/project-plan.md` needs no edit (it never named the route).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `?q=` handoff into `/cards` + NavBar rewiring** - add query
  param handling to `app/pages/cards/index.vue` that seeds `searchInput` and
  `searchQuery` from `route.query.q`, covering both first mount and a later
  same-route navigation. (Built as a synchronous seed call placed above the
  `searchQuery` watcher plus a separate non-immediate `watch`, rather than one
  `{ immediate: true }` watch: the immediate form fires the `searchQuery`
  watcher during setup, racing a second `loadFirstPage()` against the one
  `onMounted` already runs.) Point
  NavBar's three `navigateTo` calls at `/cards?q=...` per the table above.
  Leave `/cards/new` in place and untouched this step - it just stops being
  reachable from the nav bar.
  *Done when:* typing 2+ characters in the nav search and pressing Enter lands
  on `/cards` with the search box pre-filled and all four groups (local,
  Anime, Song, Artist) populated for that query; clicking an Anime or Artist
  dropdown result does the same with that result's own title/name; doing
  either while already on `/cards` updates the page rather than doing nothing;
  a bare `/cards` with no `?q=` behaves exactly as before.

- [x] **Step 2 - Rewire the four in-app links** - `/cards`' header link
  becomes a focus-the-search-input button (template ref + click handler);
  `/cards`' empty state and hint line reworded to point at the search box;
  `/decks`' and `/stats`' empty-state links retargeted to `/cards`. After this
  step nothing in the app links to `/cards/new`.
  *Done when:* `grep -rn "cards/new" nuxt-app/app` returns only
  `app/pages/cards/new.vue` itself; clicking "Add card" on `/cards` puts the
  cursor in the search input; the `/decks` and `/stats` empty states navigate
  to `/cards`.

- [x] **Step 3 - Delete the page** - remove `app/pages/cards/new.vue`.
  *Done when:* the file is gone; `bun run build` passes; `/cards`, `/decks`,
  `/stats` all still render (200) and their add paths work; `/cards/new`
  returns a 404 rather than erroring the app.

## Files / areas

- `app/pages/cards/index.vue` - `?q=` seeding (Step 1), header button + copy
  (Step 2).
- `app/components/nav/NavBar.vue` - three `navigateTo` targets (Step 1).
- `app/pages/decks/index.vue` - one empty-state link (Step 2).
- `app/pages/stats/index.vue` - one empty-state link (Step 2).
- `app/pages/cards/new.vue` - deleted (Step 3).

No server-side files change.

## Data / contracts

- **New (small, load-bearing for NavBar):** `/cards` accepts an optional `?q=`
  query param that seeds its search. It replaces three retired `/cards/new`
  params (`?q=`, `?aniListId=`, `?artistSlug=`) with one, and is the only
  route param anywhere in this app besides the existing `?type=&id=`
  convention on `/decks`.
- Nothing else changes. Every endpoint the deleted page called
  (`/api/lookup/anilist-search`, `/api/lookup/import`,
  `/api/lookup/artist-search`, `/api/lookup/artist-import`,
  `/api/lookup/song-search`, `/api/lookup/song-import`, `/api/cards`,
  `/api/cards/by-songs`, `/api/cards/download`) stays in use by the three
  `/cards` group components.

**Capability parity, verified before writing this spec** - every function on
`cards/new.vue` has an equivalent already live on `/cards`:

| `cards/new.vue` | `/cards` equivalent |
|---|---|
| `search()` / `selectAnime()` | `CardAddAnimeResults.runSearch()` / `toggleExpand()` |
| `artistSearch()` / `selectArtist()` | `CardAddArtistResults.runSearch()` / `openArtist()` |
| `songSearch()` / `addSongResult()` | `CardAddSongResults.runSearch()` / `addSongResult()` |
| `addAllArtistThemes()` / `downloadAllArtistVideos()` / `hasDownloadableAddedVideos()` | same names in `CardAddArtistResults` |
| `addCard()` / `removeCard()` / `downloadMedia()` / `preloadAddedCards()` / `progressPercent()` | present in each group component |
| `resolvedSongId()` / `addedSongCard()` | same names in `CardAddSongResults` |
| `onPreviewCardUpdated()` | already on `/cards` itself |
| per-theme local-video-path input | ported in 49a, `CardAddAnimeResults` |

The only interaction genuinely lost is the three-tab mode toggle with its
explicit Search button - replaced by one debounced box that runs all three
lookups at once, which is the point of feature 49.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command), so this
rides on browser/route and build evidence - it is pure routing and link
rewiring, with no new logic to unit test.

Unlike 49a and 49b, **this feature is fully verifiable during the current
AniList outage**: every done-when is about navigation, param seeding, and
link targets, none of which need AniList to return data. Only the Anime
group's *contents* would, and that is not what this step changes.

- From any page, nav search -> Enter -> `/cards?q=...` with the box seeded.
- Same from a nav Anime result and a nav Artist result.
- Repeat both while already on `/cards` (the same-route navigation case).
- "Add card" on `/cards` focuses the search input.
- `/decks` and `/stats` empty states land on `/cards`.
- `grep -rn "cards/new" nuxt-app/app` is empty after Step 3.
- `/cards`, `/decks`, `/stats` return 200; `/cards/new` returns 404.
- `bun run build` passes.

## Notes for the AI

- The build-plan line says "six existing entry points" but enumerates seven
  (3 NavBar + 2 on `/cards` + 1 on `/decks` + 1 on `/stats`). Seven is
  correct, confirmed by grep; the count in the plan text is simply off by
  one. Don't leave one behind chasing the number six.
- Use a `watch` on the route query, not a bare `onMounted` read - the
  same-route navigation case (nav search used while already on `/cards`) is a
  real path, and `cards/new.vue` itself used a watch for exactly this reason
  before it was deleted.
- Keep `/cards/new` fully working through Steps 1 and 2 so every step leaves
  the app in a shippable state; it is only deleted in Step 3, once nothing
  points at it.
- Don't add a `/cards/new` -> `/cards` redirect, a route rule, or a stub page
  in the name of tidiness - deleting the route is the intent (see Out of
  scope).
- After merge, `/overview` should be re-run so `project-overview.md` stops
  describing `/cards/new` as a live route. That is a separate command, not
  part of this feature's diff.
- `/complete` should check off both 49c *and* its parent 49, since 49a/49b are
  already checked and this is the last sub-item.
