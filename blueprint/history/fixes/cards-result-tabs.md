# Fix: Tabs for /cards search result groups

**Type:** Fix

**Status:** verified

## The problem

On `/cards`, a search shows the local matches first, then the Anime, Song and
Artist add-candidate groups stacked below (`nuxt-app/app/pages/cards/index.vue`,
the `list-pane`). With a long local list, reaching the Anime, Songs or Artists
results means scrolling past every loaded card, and the local list's infinite
scroll makes that worse. The groups are not reachable quickly.

## The fix

When a search is active (2+ characters, the same gate the groups already use),
show a tab strip above the results and display one group at a time:

| Tab | Shows |
|---|---|
| Your cards (default) | The local card table, selection bar and empty states, exactly as today |
| Anime | `CardAddAnimeResults` |
| Songs | `CardAddSongResults` |
| Artists | `CardAddArtistResults` |

- The tab strip uses the app's existing `tab-seg` / `tab-seg-btn` look (as on
  `/decks` and `/stats`), with `role="tablist"` / `role="tab"` / `aria-selected`.
- The "Your cards" tab label carries the match count already known on the page
  (`totalCards`). No counts on the other tabs: they would need new events from
  each group.
- All three add groups stay mounted and are hidden, not unmounted, so their
  searches still run in parallel, an expanded anime theme picker or an open
  artist modal survives switching tabs, and a result is ready when its tab is
  opened. Add an optional `active` prop (default `true`) to each group
  component, applied as `v-show` on its existing `.add-*-group` root. Do not
  wrap the components in a hidden div: `CardAddArtistResults` has a fragment
  root whose background-download banner must stay visible on every tab.
- The chosen tab is page state only (not persisted, not in the URL) and is kept
  when the query changes. With no active search (under 2 characters) there are
  no tabs and the page looks as it does today; the add groups render nothing
  then, as now.
- The `/decks` artist catalog section (`CardAddArtistResults` on an artist
  deck) does not pass `active`, so it is unchanged.

**Must not break:** local list infinite scroll and bulk selection, the
inspector preview from add groups (`@preview`), `@refresh` reloading the first
page, the nav bar's `/cards?q=` hand-off (it still lands on "Your cards"),
and feature 99's library-filter chip and statuses, which stay on the cards tab.

## Build steps

- [x] **1. Tabs on `/cards`.** Add the `active` prop and `v-show` to the three
  group components, add a `resultTab` ref and the tab strip in `cards/index.vue`,
  and gate the existing local-results block on the "Your cards" tab. Add the
  scoped tab styles (reuse the `/decks` rules or promote them to `main.css`,
  whichever is smaller). Done when: searching "Chou" on `/cards` shows the
  tab strip with Your cards selected; clicking Artists shows only the artist
  results with no scrolling; clicking Your cards brings back the table at its
  prior scroll position of the list; typing a new query keeps the chosen tab.

## Verify

1. `bun run dev` in `nuxt-app/`, open `/cards`, search a name with many local
   matches (for example "Choucho").
2. Switch through all four tabs; each shows only its own results, and the
   Anime/Songs/Artists tabs are visible without scrolling.
3. Expand an anime in Anime, switch away and back: it is still expanded.
4. Clear the search box: tabs disappear and the page looks as it did before.
5. Open an artist deck on `/decks`: the "Other songs by" section still renders.
6. `bun run test` and `bun run build` pass.
