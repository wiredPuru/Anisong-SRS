# Feature: Catalog section on the artist deck page (105a)

**From build-plan:** feature 105a (parent: 105, Artist link opens deck + catalog search)
**Status:** verified

## Goal

Give an artist's `/decks` detail page an "Other songs by this artist" section that
runs the same catalog search `/cards` runs for an artist, so a user who lands on
the deck can add songs the library lacks without leaving the page. This is the
destination half of feature 105; 105b adds the link that opens it from Study and
Listen.

## In scope

- On an artist deck's detail view only, above the card list
  deck, a section headed "Other songs by <artist name>" that renders the existing
  `CardAddArtistResults` with `query` set to the deck's artist name and
  `has-default-download-folder` from the page's existing state.
- A pure helper, `artistCatalogQuery(name)`, returning the search text or `null`
  when the section should not show: blank name, fewer than 2 characters (the
  component's own minimum), or the placeholder name `Unknown Artist` that imports
  store when a provider names no artist.
- Wiring the component's events: `refresh` reloads the deck's first card page (a
  song added for this artist joins the derived artist deck) and `preview` selects
  that card in the inspector when it is loaded, otherwise reloads the first page
  and then selects it.
- Manual and anime decks do not get the section.

## Out of scope

- The link from Study and Listen (105b).
- Any change to `CardAddArtistResults` itself, or to a server route: it already
  searches by name, resolves the catalog, and adds and downloads cards.
- Searching by anything but the artist's stored name. A credit spelled
  differently upstream may match nothing; the component already says "No matching
  artists found." and we do not guess.
- Deep-linking a search into the section (a `?q=`-style param). The query is
  always the deck's own artist name.

## Build loop

Build one step at a time. Review each diff before moving on.

## Build steps

- [x] **Step 1 - Query helper** - `app/utils/artistCatalog.ts` exporting
  `artistCatalogQuery(name: string): string | null` (trimmed; null for blank,
  under 2 characters, or `Unknown Artist` compared case-insensitively) with
  `artistCatalog.test.ts` beside it. *Done when:* tests cover a normal name
  (trimmed), a name with surrounding spaces, blank, one character, two
  characters, `Unknown Artist` in two casings, and a Japanese name; `bun run test`
  passes.
- [x] **Step 2 - Section on the artist deck page** - in `pages/decks/index.vue`,
  a block above the deck's card list (below the criterion and Add cards blocks), shown when
  `activeType === 'artist'` and `artistCatalogQuery(deckLabel)` is non-null,
  rendering `<CardAddArtistResults>` under the heading. Wire `refresh` and
  `preview` as above. Styled with existing tokens, matching the neighbouring Add
  cards and Export blocks. *Done when:* in the browser, an artist deck shows the
  section and a search for that name lists matching artists; picking one opens the
  catalog modal; adding a song closes the loop (the card appears in the deck list
  after the refresh); an anime deck, a manual deck and an `Unknown Artist` deck
  show no section; the build passes with no console errors.

## Files / areas

- `nuxt-app/app/utils/artistCatalog.ts` (+ test)
- `nuxt-app/app/pages/decks/index.vue`
- Read only: `app/components/card/CardAddArtistResults.vue`

## Data / contracts

- No server, schema, or API change.
- `CardAddArtistResults` contract (unchanged): props `query`,
  `hasDefaultDownloadFolder`; events `refresh`, `preview(card)`.
- The artist deck page is already reachable as `/decks?type=artist&id=<id>`
  (`artistDeckPath`, `app/utils/deckLinks.ts`); 105b links to exactly that.

## Testing

Vitest gate is on. In-scope logic: `artistCatalogQuery`. The section and its
wiring are UI and ride on browser evidence plus `bun run build`. Run `bun run
test` and `bun run build` in `nuxt-app/`. Browser checks run against a copy of
the live DB (`GAQ_SRS_DATA_DIR` pointed at a scratch folder), since adding a song
writes cards.

## Notes for the AI

- The component renders its own "Artists" heading inside; the wrapper heading is
  the page's, so keep both readable rather than editing the component.
- Pass the deck's stored `deckLabel`, not anything the user typed.
- As built: the page reloads its first card page with `{ quiet: true }` on `refresh`, because the pending state unmounts the detail body and would close the catalog modal mid-add; `preview` splices a missing card to the front (as `/cards` does) and `loadMoreDeckCards` skips ids already loaded.
- Comments explain why only; no em dashes; no inline styles; existing tokens.
