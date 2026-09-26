# Feature: Deck detail uses the Cards view

**From build-plan:** feature 81
**Status:** verified

## Goal

A deck's card list (artist, anime, and manual decks) looks and works like
`/cards`: the dense table (cover, song/artist, anime + slot, source badges,
due) with the resizable inspector rail on the right for playback, details,
download, deck membership, edit, and delete. This replaces today's row list with
per-row Preview/Remove/Delete/Download buttons. Built by extracting `/cards`'
table and inspector into shared components, so the two surfaces cannot drift.

## Design reference

No new visual target. The reference is the shipped `/cards` page (feature 50c,
retoned by 62), so the extracted components must render `/cards` pixel-identical
to today. The only new layout is `/decks` detail adopting `/cards`' split pane.

## In scope

- Pure display helpers shared by both pages: `dueLabel`, `isDueNow`,
  `compactSourceBadges`, `sourceBadges` move to `app/utils/cardDisplay.ts`,
  with tests.
- `components/card/CardTable.vue`: the table header and rows, with an optional
  checkbox column (on for `/cards`, off for decks).
- `components/card/CardInspector.vue`: the rail's contents (player or cover,
  titles with deck links, Due/Box tiles, notes, links, sources, downloads,
  deck membership panel, edit form, delete with confirm), plus an `actions`
  slot for extra buttons.
- `/cards` switched to both components with no visible or behavioural change.
- `/decks` detail on all three deck types: list pane (deck title, criterion
  block, Add cards block, table, infinite scroll sentinel, export block) beside
  a resizable inspector, stacking under 820px like `/cards`.
- Manual decks: "Remove from deck" in the inspector's `actions` slot.
  Unticking the current deck in the inspector's membership panel also drops
  the row, since it is the same operation.
- Deleting a card from a deck's inspector drops the row, clears the selection,
  and decrements the grid tile's count in place (as the per-row Delete did).
- The inspector links to the artist and anime decks, except the deck being
  viewed (today's `isCurrentDeck` rule).
- A manual deck graded on anything but the anime title hides the Due column
  and the Due/Box tiles, because `/api/decks/cards` returns the `Card` row's
  title-track schedule, which is not what that deck studies (feature 71).

## Out of scope

- Multi-select and bulk actions on deck detail (feature 61b's selection bar
  stays `/cards`-only, like 70a's filter).
- Showing a non-title track's box and due date in the table. That needs
  `/api/decks/cards` to join `CardTrack`; a later item if wanted.
- Feature 16's metadata edit (song title, theme slot, artist) on `/decks`.
  It was reachable only through the Preview modal this replaces. `/cards` has
  had no entry point to it since 50c either, so both surfaces now match; a
  "More edits" entry on the inspector would restore it for both. **Flagged for
  review.**
- Any server, route, or schema change.

## Build loop

Autopilot run: steps are built and verified in order without a pause between
them, with a checkpoint commit after each passing step. Review happens at the
final packet.

## Build steps

- [x] **Step 1 - Shared display helpers** - move `dueLabel`, `isDueNow`,
  `compactSourceBadges`, `sourceBadges` from `pages/cards/index.vue` into
  `app/utils/cardDisplay.ts` (structural parameter types), with
  `cardDisplay.test.ts`; `/cards` imports them. *Done when:* tests cover
  today/past/future/invalid due dates and local-over-remote badges, `bun run
  test` and `bun run build` pass, `/cards` renders unchanged.
- [x] **Step 2 - `CardTable` component** - extract the header row and card
  rows. Props: `cards`, `selectedId`, `checkedIds?` (omit to drop the
  checkbox column), `showDue` (default true). Emits `select(id)`,
  `check-click(id, event)`, `toggle-all`. The narrow-window column hiding
  moves with it. *Done when:* `/cards` uses it, `bun run measure /cards`
  shows the same row geometry at 1400x900 and 800x900 as before the step,
  and checkbox/shift-click/select-all still work.
- [x] **Step 3 - `CardInspector` component** - extract the rail's contents,
  owning its edit, clear-path, download, and delete state. Props: `card`
  (nullable), `audioOnly`, `hasDefaultDownloadFolder`, `autoDownload`,
  `clipSource`, `manualDecks`, `memberships`, `togglingMembership`,
  `membershipError`, `currentDeck?`, `showSchedule` (default true). Emits
  `updated(card)`, `deleted(id)`, `toggle-deck(cardId, deckId, checked)`. Slot
  `actions`. *Done when:* `/cards` uses it; select, play, download, edit
  notes/paths, clear a path, toggle a deck, and delete with confirm all work
  in the browser with no console errors; build and tests pass.
- [x] **Step 4 - Deck detail split pane** - `/decks` detail swaps the row
  list and `CardPreviewModal` for `CardTable` + `CardInspector` with the
  resizable pane, for all three deck types. Manual decks get "Remove from
  deck" in the `actions` slot; delete, update, and membership events patch
  the loaded list; the selection clears on deck change and when its card
  leaves the list. The inspector takes `currentDeck` (its own artist/anime
  shown as plain text) and `deleteConfirmText` (61c's "from your library,
  not just this deck" wording on manual decks), and the inspector's deck list
  refetches after a deck is created, renamed, or deleted. *Done when:* on an artist, an anime, and a manual deck,
  selecting a row opens it in the rail and it plays; Remove and Delete drop
  the row; search and infinite scroll still load; Add cards, criterion, and
  export blocks still work; no console errors.
- [x] **Step 5 - Criterion-aware schedule + narrow window** - `showDue` /
  `showSchedule` off for a manual deck whose criterion is not `title`; verify the 820px stack
  and remove CSS the old row list left unused. *Done when:* a song-graded
  manual deck shows no Due column or Due/Box tiles while a title-graded one
  does; at 800px wide the rail stacks under the list with no horizontal
  overflow (`bun run measure`); build and tests pass.

## Files / areas

- New: `nuxt-app/app/utils/cardDisplay.ts` (+ `.test.ts`),
  `nuxt-app/app/components/card/CardTable.vue`,
  `nuxt-app/app/components/card/CardInspector.vue`
- Changed: `nuxt-app/app/pages/cards/index.vue`,
  `nuxt-app/app/pages/decks/index.vue`

## Data / contracts

- No server change. `/api/decks/cards` already returns the full server
  `CardWithDetails` (notes, AniList id, AnimeThemes slugs); the client
  `DeckCard` interface on `/decks` just declared fewer fields and gains the
  rest, in server field order per `coding-standards.md` (F-09).
- `CardInspector`'s events (`updated`, `deleted`, `toggle-deck`) are the
  contract both pages depend on.
- The inspector width is persisted under `useResizablePane`'s existing key
  (`gaqSrs:cardsInspectorWidth`), so both pages share one width.

## Testing

- Vitest gate is on. Step 1's helpers are the in-scope logic
  (`vi.useFakeTimers()` for the due-date labels).
- Steps 2-5 are UI: evidence is `bun run build`, `bun run measure` geometry,
  and browser checks via the `playwright-cli` skill (screenshots, console).

## Notes for the AI

- Components declare their own `CardWithDetails` copy, as every other
  component does (F-09); keep field order matching the server.
- Keep class names and scoped CSS moving with the markup so `/cards` does not
  shift; the inspector's `:deep(.player-card)` overrides move into it.
- `/decks` query-param conventions stay (`?type=&id=`); no inspector state in
  the URL.
