# Feature: Cards

**From build-plan:** feature 50c
**Status:** verified

> Automated evidence: `bun run build` clean; all six routes 200; `/api/cards`
> returns `total` (162, against the 175 a `totalPages * PAGE_SIZE` guess would
> have given); shell markup present in SSR; zero hex literals in the page;
> orphaned selectors removed. The table and inspector render client-side, so
> their visual done-whens rest on the same footing as 50b's - see below.

## Goal

Relayout `/cards` to the Akiba Neon `1a Cards` artboard: a dense table filling
the window beside the rail, with a 400px inspector rail on the right showing
the selected card. Per-row action buttons are demoted out of every row and
live in the inspector instead, so the list reads as a scannable table rather
than a stack of expanded panels.

## Design reference

`blueprint/reference/akiba-neon-canvas.html`, artboard
`data-screen-label="1a Cards"`. Also `1a Add card` - **reference only, not
built**, see the resolved decision below.

**Resolved: no separate Add card page.** The canvas draws `1a Add card` as its
own screen with `Anime | Artist | Song` tabs and a "Back to cards" button -
exactly the `/cards/new` architecture feature 49 spent three sub-features
deleting. Decision, taken 2026-09-02: **restyle feature 49's unified `/cards`
search** into the artboard's split-pane shape instead. No new route, no tabs,
feature 49 stays intact. The artboard's results-left / detail-right idea is
still honoured - it is what the table and inspector already are.

## In scope

- **Two-pane shell**: full-height table pane plus a 400px inspector rail with
  its own left border and sunken ground, reusing the pattern 50b established.
- **Header strip**: `Cards` in the display face, a total count, and the
  existing search input moved into the strip.
- **Dense table**: a CSS grid with a header row - cover, Song (title over
  artist), Anime (title plus theme slot), Sources, Due. Selected row carries
  the accent border and tinted ground from the artboard.
- **Inspector rail**: the selected card's cover/preview tile, titles, a Due
  and a Box tile, a Sources block, its manual-deck chips, and Edit / Delete.
- **Demoting row actions**: Preview, Edit, Decks, Delete and the download
  controls leave the row and live in the inspector for the selected card.
- **Add-candidate groups** (`CardAddAnimeResults`, `CardAddSongResults`,
  `CardAddArtistResults`) keep working, rendered below the local table in the
  left pane. Their own internals are not redesigned here.

## Out of scope

- **A per-card pass rate column.** The artboard shows `88%` per row.
  `server/utils/stats.ts` aggregates `ReviewLog` by artist and by anime only -
  there is no per-card rate, and adding one means a new grouped query joined
  into `listCards` for every row. That is a data feature, not a retheme.
- **`3 missing a source` in the header.** Impossible by construction: feature
  4's create/update validation requires at least one of the four source
  fields, so the count is always 0. The artboard's `NO SOURCE` row is mockup
  fiction. The existing `No source` badge stays as a defensive display.
- **The `All | ...` segmented filter** in the header. The artboard never says
  what the other segments are, and no such filter exists. Not invented here.
- **A `+ Add card` button.** The artboard has one, but feature 49's same-day
  follow-on deliberately removed exactly that button from `/cards` because it
  only focused the search box below it. The search box is the add affordance.
- **`CardPreviewModal`'s own design** - 50b already restyled what it shares.
- **The narrow-window pass** - 50h.
- **Any change to the three add-candidate components' internals.**

## Build steps

- [x] **Step 1 - shell + header.** `.cards` becomes a full-height flex column
  with a header strip (display-face title, total count, search input) and a
  two-pane body: table pane plus a 400px inspector rail. Drop the centred
  measure and the `<h1>`/hint in favour of the strip.
  *Done when:* `/cards` fills the window beside the rail; the search input
  still filters with the same debounce; the loading, error and empty states
  still render; `bun run build` clean.

- [x] **Step 2 - the table.** Replace `.card-list`/`.card-row` with the
  artboard's grid: a header row and one row per card - cover thumb, song over
  artist, anime plus theme slot, source badges, due. Clicking a row selects
  it. Selected row gets the accent border and tint.
  *Done when:* every card renders one grid line; selecting a row marks it;
  infinite scroll still loads more on scroll; the cover thumb is absent, not
  broken, for an anime with no cover.

- [x] **Step 3 - inspector rail.** The selected card's panel: cover tile with
  theme badge, titles, Due and Box tiles, Sources block, deck chips, and
  Edit / Delete / Preview actions. With nothing selected, an empty-state
  prompt.
  *Done when:* selecting a row fills the rail; Preview still opens the modal;
  Delete still removes the card and clears the selection; the deck chips
  reflect real membership.

- [x] **Step 4 - demote row actions.** Remove the per-row Preview / Edit /
  Decks / Delete / download controls now that the inspector owns them, moving
  the edit form and `DeckMembershipPanel` into the rail.
  *Done when:* no action buttons remain in a row; edit still saves; deck
  toggles still call the assignment API; downloads still run with their
  progress bar; nothing that worked before is unreachable.

- [x] **Step 5 - add-candidate groups in the new layout.** Re-place the three
  add-candidate groups below the table in the left pane so a search still
  surfaces Anime, Song and Artist results.
  *Done when:* a 2+ character search still shows all three groups with their
  independent loading and error states; adding a card still refreshes the
  local list; `bun run build` clean and every route 200.

## Files / areas

- `nuxt-app/app/pages/cards/index.vue` - template and styles (all steps).
- `nuxt-app/server/api/cards.get.ts` - expose the already-computed `total`
  (Step 1). See Data / contracts.

## Data / contracts

No schema, route or stored shape changes. One **additive** server field:

`GET /api/cards` currently returns `{ cards, page, totalPages }`. `listCards`
already computes `total` internally and throws it away. Step 1 adds it to the
response so the header can show a real count instead of a derived guess
(`totalPages * PAGE_SIZE` is only accurate to within a page). Purely additive -
no existing consumer reads a field that changes meaning.

Derived client-side, no new data needed:

| Column | Source |
|---|---|
| Cover | `animeCoverImageUrl` (already used on `/cards`) |
| Song / Artist | `songTitle`, `artistName` |
| Anime / Slot | `animeTitleEnglish`, `themeSlot` |
| Sources | the four local/remote fields, as today's `sourceBadges()` |
| Due | `nextReviewAt` vs now - `Today` / `in Nd` / `new` |
| Box | `box` |

Measured off the artboard: table grid `46px 1fr 200px 120px 108px`, `14px`
gap, `10px 14px` row padding, `--radius-sm`. Cover `34x48`. Header labels
`11px/700`, `1.2px` tracking, `--faint`. Selected row: `--accent` border on
an accent-tinted ground. Inspector `400px`, `--surface-sunken`, `22px`
padding, `18px` gap.

## Testing

No test runner configured; this rides on build and browser evidence. The due
formatter is the only logic added - a pure function over `nextReviewAt`, worth
a focused test if a runner ever lands.

- Check the add-candidate groups after Step 5; they are the most likely
  casualty of moving the list markup.
- Check download progress after Step 4 - it moved out of the row.
- `bun run build` and all six routes 200 at the end.

## Not verified in a browser

`/cards` loads its list client-side, so no server-side check reaches the
table, the inspector, or the add-candidate groups. Confirm before building on
this: row selection filling the rail, the edit form and deck toggles inside
it, download progress in its new home, and all three add-candidate groups
appearing under the table on a 2+ character search.

## Notes for the AI

- **The artboard overstates what the data supports.** Pass rate, the
  missing-source count and the `All` filter are all fiction; see Out of scope.
  Verify a field exists before rendering it, exactly as 50b did with the
  release year and the `R replay` hotkey.
- **Do not re-add the "Add card" button.** Removing it was a deliberate
  follow-on to feature 49c.
- `/cards/index.vue` is 769 lines with a lot of live state (edit forms, deck
  panels, download progress, preview). Step 4 moves that machinery rather than
  rewriting it - reuse the existing handlers.
- Reuse 50b's shell pattern: `flex: 1` on the page root against
  `.app-content`'s flex column, `--surface-sunken` and `--border` for the rail.
- Keep the conventions: scoped `<style>`, `var(--token)`, no hard-coded
  colours, no em dashes.
