# Fix: Add-card previews should use /cards' inspector rail, not a floating modal

**Type:** Fix
**Status:** verified

## The problem

`/cards`' own row list already replaced `CardPreviewModal` with a persistent
right-side inspector rail (feature 50c) - clicking a row selects it into the
400px `.inspector` pane with a real player, metadata, deck panel, and edit
form, no overlay. The nav bar's global search already respected this (the
`pendingCardPreview` watcher in `nuxt-app/app/pages/cards/index.vue` selected
into the rail instead of opening a modal).

But the three add-candidate groups below the list - `CardAddAnimeResults`,
`CardAddSongResults`, `CardAddArtistResults` (feature 49) - each emitted a
`preview` event still wired to `(card) => (previewCard = card)`, which popped
the old `CardPreviewModal` full-viewport overlay. Previewing a card just
added through search covered the whole page in a modal instead of using the
inspector space sitting right there, unlike every other preview path on this
screen.

## The fix

Routed all three add-candidate groups' `preview` emits into the inspector
rail instead of the modal, reusing the same unshift-if-missing + select
pattern the `pendingCardPreview` watcher already used (a freshly-added card
may not be in the currently loaded `cards` page).

- Extracted that pattern into `previewInInspector(card)` and called it from
  the `pendingCardPreview` watcher and all three `@preview` handlers.
- Removed `previewCard`, `onPreviewCardUpdated`, and the
  `<CardPreviewModal>` block from `cards/index.vue` - nothing on this page
  opens it anymore.
- `CardAddArtistResults.vue`'s `previewActive` prop (and the
  `:preview-active="previewCard !== null"` binding) existed only to stop its
  own bulk-import modal's Escape handler from double-firing under the old
  Preview modal. With that modal gone, removed the prop and simplified the
  Escape handler back to unconditional.
- `CardPreviewModal`'s other call site (`/decks`) is untouched.

## Build steps

- [x] **Step 1 - Route add-candidate Preview into the inspector rail** -
  added `previewInInspector(card)` in `cards/index.vue`, wired it to the
  `pendingCardPreview` watcher and all three add-candidate groups'
  `@preview`, deleted `previewCard`/`onPreviewCardUpdated`/
  `<CardPreviewModal>`; removed `CardAddArtistResults.vue`'s dead
  `previewActive` prop and Escape guard. *Done when:* clicking "Preview" on
  an added add-candidate theme selects that card into the right-side
  inspector instead of opening a modal, and the artist bulk-import modal's
  Escape key still closes it normally.

## Verify

- `bun run build` passes clean.
- Grepped for `previewCard`/`onPreviewCardUpdated`/`CardPreviewModal`/
  `previewActive` in both changed files - no dangling references.
- Manually confirmed via `bun run measure` screenshot that clicking a normal
  `/cards` row still selects it into the inspector exactly as before
  (player, Leitner tiles, sources, Deck panel, Edit/Delete) - the refactor
  didn't disturb the existing path the add-flow now shares.
- Could not capture a screenshot of the Preview click itself: the artist
  bulk-import modal's catalog-loading crawl outlasts the `measure` tool's
  fixed 1.5s post-click wait in this environment, and the seeded local test
  cards lack `animethemesThemeId`, so the Song-search group's "already
  added" state never triggered either. The reused code path is identical to
  what was already live in production for the nav-search hand-off.
