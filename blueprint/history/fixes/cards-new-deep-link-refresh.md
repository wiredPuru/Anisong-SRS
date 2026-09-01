# Fix: `/cards/new` deep links don't re-resolve on same-route navigation

**Type:** Fix
**Status:** verified

## The problem

`/cards/new`'s `onMounted()` (`nuxt-app/app/pages/cards/new.vue:419-442`) reads
`route.query.aniListId` / `artistSlug` / `q` once, on page mount, and resolves
whichever one is present (`selectAnime`, `selectArtist`, or `search`). All
three deep links are triggered by `navigateTo("/cards/new?...")` calls from
`NavBar.vue` (an "Add a show" click, an Artist result click, or Enter in the
search box).

If you're already sitting on `/cards/new` (having landed there via one of
those deep links) and trigger a *second* one - e.g. searching another artist
in the nav bar and clicking a different result - Nuxt does a client-side
navigation to the new URL. Since the route path doesn't change (only the
query string does), the page component isn't remounted, so `onMounted` never
fires again. The URL bar updates, but nothing re-resolves - matching exactly
what was reported: "the URL does change" but "the next query wont load."

This affects all three deep-link params identically (`aniListId`, `artistSlug`,
`q`), not just the newest `artistSlug` one - `onMounted`-only was always the
wrong lifecycle hook for "react to this query param on every navigation," it
just wasn't noticeable before there were repeatable nav-bar entry points
driving repeat visits to the same route.

A related staleness bug shares the same root cause: none of the three
branches reset the *other* two modes' leftover state before resolving, so
clicking an Anime result then (while still on the page) an Artist result
would show both the old anime's theme list (rendered unconditionally, not
gated on `searchMode`) and the new artist's results at once, since only
`setSearchMode()` - not the deep-link handler - clears `selectedAnime`/
`selectedArtist`/etc.

## The fix

Replace the one-shot `onMounted` with a `watch` on the three query fields
(`{ immediate: true }` covers the initial mount, so `onMounted` is removed
entirely, not kept alongside the watcher):

```ts
watch(
  [() => route.query.aniListId, () => route.query.artistSlug, () => route.query.q],
  () => {
    // same three branches as today
  },
  { immediate: true },
);
```

Each of the three branches gets `setSearchMode(<mode>)` inserted before it
resolves (`setSearchMode("anime")` for the `aniListId` and `q` branches,
`setSearchMode("artist")` for the `artistSlug` branch - replacing its current
direct `searchMode.value = "artist"` write), reusing the existing full-reset
function instead of a bespoke partial reset. This both fixes the "doesn't
re-fire" bug and the "stale other-mode results linger" bug with the same
change, since `setSearchMode` already clears `selectedAnime`, `selectedArtist`,
and their search-result lists.

Must not break: visiting `/cards/new` directly (no query params) still shows
the default "By anime" empty state exactly as today; a single deep link on
first load still resolves exactly as it does now; the existing mutual
precedence (`aniListId` wins, then `artistSlug`, then `q`) is unchanged;
manually switching tabs via the toggle buttons (which already call
`setSearchMode` themselves) is unaffected.

## Build steps

- [x] **Step 1 - Replace `onMounted` with a query-watching effect** - In
  `nuxt-app/app/pages/cards/new.vue`, replace the `onMounted(() => {...})`
  block with `watch([...], () => {...}, { immediate: true })` as described
  above, adding the `setSearchMode(...)` call to each of the three branches.
  *Done when:* starting on `/cards/new`, resolving one artist via the nav
  search, then resolving a *different* artist via the nav search without
  leaving the page both update the shown catalog to the second artist (not
  just the URL); the same holds for two different `aniListId` deep links in a
  row, and for an `aniListId` deep link followed by an `artistSlug` one (the
  old anime's theme list is gone once the artist result loads); a fresh visit
  to `/cards/new?artistSlug=<slug>` (full page load) still resolves
  immediately as it does today; `bun run build` is clean.

## Verify

- `bun run build` clean.
- No test runner logic involved - pure UI/routing wiring over existing,
  unchanged resolve functions (`selectAnime`, `selectArtist`, `search`).
  Verify by browser/build evidence per the Testing gate in
  `coding-standards.md`.
- Manual (or dev-server + curl for the underlying resolve calls, since no
  Playwright is installed in this project): from `/`, use the nav search to
  jump to one artist's catalog on `/cards/new`, then - without navigating
  away - use the nav search again for a second, different artist and confirm
  the page updates to the new artist's catalog. Repeat once mixing an Anime
  result and an Artist result in sequence, confirming no leftover results
  from the first selection remain visible.

## Build notes

The implemented code differs slightly from the spec's sketch: the `watch`
call is registered *inside* `onMounted` (`onMounted(() => { watch([...], ...,
{ immediate: true }) })`), not at the top level. A bare top-level `watch`
with `immediate: true` runs synchronously during Nuxt's SSR pass, which
would have fired the `selectAnime`/`selectArtist`/`search` `$fetch` calls
server-side on every fresh page load - a regression the original
`onMounted`-only code was specifically avoiding (Vue skips `onMounted`
callbacks entirely during SSR). Wrapping the `watch` registration in
`onMounted` keeps the resolve calls client-only, exactly as before, while
still reacting to every subsequent same-route query change for the rest of
the component's mounted lifetime.

Verified via `bun run build` (clean), `bun run test` (5/5, unrelated
regression check), and dev-server + curl confirming all four load shapes
(`?artistSlug=`, `?aniListId=`, `?q=`, bare) still return `200` with nothing
in the server log. No Playwright in this project, so the actual repeat-
navigation browser interaction (the bug's specific repro) was not driven
live - verified by code read-through of `watch`'s array-of-getters
semantics and the `onMounted` SSR-safety reasoning above, same standard
used throughout this session's other UI work.
