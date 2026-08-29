# Feature: Preview on deck detail card rows

**From build-plan:** feature 22
**Status:** verified

## Goal

`/cards` already has a per-row Preview button that opens `CardPreviewModal`
(playback, info, and edit) without starting a study session (feature 11,
edit mode added in feature 16). A deck's detail view (`/decks`, any of
Artist/Anime/Created) shows the same kind of card rows but has no way to
preview one without leaving to `/cards` first. This adds the identical
Preview button to deck-detail card rows, reusing `CardPreviewModal`
unchanged - no new component, no new modal variant.

## In scope

- A "Preview" button on each card row inside a deck's detail card list
  (`deckDetail.cards`), for all three deck types (Artist, Anime, Created).
- Same visibility rule `/cards` already uses: hidden when the card has no
  playable source (`sourceBadges(c).length === 0` - a defensive check;
  today every card has at least one source per the data model's own
  constraint, but this matches existing precedent rather than dropping it).
- Opens the existing `CardPreviewModal` (playback, language toggles, expand,
  ambient mode, and its edit mode) exactly as `/cards` does.
- Saving an edit in the modal refreshes the deck's card list
  (`fetchDeckDetail()`, the same function pagination and add/remove already
  call) so the row reflects the change immediately.

## Out of scope

- Any change to `CardPreviewModal` itself - it is reused exactly as built.
- A Preview button on the top-level deck *list* rows (Artist/Anime/Created
  summary cards) - only the detail view's per-card rows get one.
- Handling what happens to deck grouping if an edit reassigns a card's
  artist/anime while previewing from that exact Artist/Anime deck - see
  Notes for the AI; it's an accepted consequence of derived decks, not a
  gap this feature needs to patch.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add the Preview button and modal to deck detail card rows**
  - Add `animeTitleNative: string` to the local `DeckCard` interface in
    `nuxt-app/app/pages/decks/index.vue` - `/api/decks/cards` already
    returns it (it flows through the shared `CardWithDetails` shape in
    `server/utils/cards.ts`), the frontend type just doesn't declare it yet,
    so `DeckCard` currently can't be passed to `CardPreviewModal`'s prop
    type as-is.
  - Add a `previewCard = ref<DeckCard | null>(null)`.
  - In the `deckDetail.cards` row template, add a "Preview" button next to
    the existing (Created-only) "Remove" button, gated on
    `sourceBadges(c).length`, `@click="previewCard = c"` - same condition
    and click handler shape `/cards` uses.
  - Mount `<CardPreviewModal :card="previewCard" :open="previewCard !== null" @close="previewCard = null" @updated="onPreviewCardUpdated" />`
    once, near the end of the template (same placement pattern as
    `/cards`).
  - Add `onPreviewCardUpdated(updated: DeckCard)`: set
    `previewCard.value = updated` then `await fetchDeckDetail()` - mirrors
    `/cards`' `onPreviewCardUpdated`, but calls this page's existing
    `fetchDeckDetail` (not the top-level `refresh`, which only reloads the
    deck list, not the open detail view).
  - Add a `.preview-btn` style rule matching `/cards`' definition (accent
    outline pill: `padding: 6px 14px`, `border-radius: var(--radius-pill)`,
    `border: 1px solid var(--accent)`, transparent background, `color:
    var(--accent)`) so it reads as the same control across both pages.

  *Done when:* opening any deck's detail view (Artist, Anime, or Created)
  shows a "Preview" button on every card row; clicking it opens
  `CardPreviewModal` with that card's playback and info; editing and saving
  in the modal updates the row's displayed title/artist without a full page
  reload; closing the modal (✕, backdrop, or Escape) returns to the deck
  detail list.

## Files / areas

- `nuxt-app/app/pages/decks/index.vue` (only file touched - `CardPreviewModal`
  is reused unchanged and already globally auto-imported, same as on
  `/cards`).

## Data / contracts

- No schema or API change. `/api/decks/cards` already returns every field
  `CardPreviewModal` needs; this step only completes the frontend `DeckCard`
  type to match what the endpoint already sends.

## Testing

- No test runner is configured in `AGENTS.md`, and this is a UI-only wiring
  change (no new logic beyond a type addition and a refetch call), so it
  rides on browser/manual evidence, not a unit test.
- Manual check: open `/decks`, drill into an Artist deck's detail view,
  click "Preview" on a card row, confirm playback/info appear and the modal
  closes cleanly; repeat for an Anime deck and a Created (manual) deck;
  from within Preview, edit a card's song title, save, and confirm the
  updated title shows in the row without navigating away.

## Notes for the AI

- Reuse `sourceBadges(c)` and `extractErrorMessage` already defined in this
  file - don't reintroduce them.
- `fetchDeckDetail` (not `refresh`) is the right refetch target here -
  `refresh` reloads the top-level deck list (`data`), which isn't visible
  while a detail view is open; `fetchDeckDetail` is what pagination and the
  existing add/remove-card actions already call to update
  `deckDetail.value`.
- If an edit inside Preview reassigns a card's artist/anime while viewing
  that exact Artist/Anime deck's detail, the refetch can make the card
  vanish from the list the user is looking at (it no longer belongs to that
  derived deck). This matches how Artist/Anime decks are documented as
  query-time groupings, not stored entities - correct behavior, not a bug
  to special-case.
- Match the existing button order/placement conventions in this file (e.g.
  action buttons as flex:none siblings inside `.deck-card-row-main`) rather
  than introducing a new layout pattern.
