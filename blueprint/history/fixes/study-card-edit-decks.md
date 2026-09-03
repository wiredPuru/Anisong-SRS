# Fix: Edit card + multi-deck assignment from within Study

**Type:** Fix
**Status:** verified

## The problem

Editing a card's local file paths or assigning it to manual decks required
leaving `/study` for `/cards` (whose inspector rail has both) or `/decks`.
There was no way to do either while actually studying a card.

## The fix

Added a collapsed-by-default "Edit card" panel to `/study`'s non-immersive
side column, below `StudyInfoPanel` - a new `StudyCardEditPanel.vue`
component with local video/audio path fields (matching `/cards`' inspector
edit form) plus the existing `DeckMembershipPanel` (feature 34), so a card
can be assigned to multiple manual decks without leaving the study session.

Deliberately does not reuse `CardPreviewModal` - that component always
mounts its own `StudyMediaPlayer` unconditionally, and `/study` already has
its own live player playing the current card. Mounting a second one would
risk exactly the overlapping-audio problem that got features 18 and 32
abandoned. `StudyCardEditPanel` has no player at all - a plain form, scoped
like `/cards`' inspector edit form: local paths and deck membership, not
song title/theme/artist editing.

- `study/index.vue` fetches `manualDecks` and `memberships` alongside the
  existing `studySettings` fetch, and has a `toggleDeckMembership()`
  handler matching the one already in `/cards`/`/decks`.
- The panel is keyed on `presentationKey`, so it fully remounts (and its
  editing state resets) on every card change, the same pattern the rest of
  this page already uses for per-card widgets.
- Saving a path edit merges into `currentCard` the same way the existing
  download-fallback flow already does.
- Non-immersive only, unchanged from the rest of the side column.

## Build steps

- [x] **Step 1 - `StudyCardEditPanel.vue`** - new component: an "Edit card"
  toggle revealing local video/audio path fields (with per-field Clear) and
  `DeckMembershipPanel`, emitting `updated`/`toggle-membership`.
- [x] **Step 2 - Wire it into `/study`** - fetches, toggle handler, and
  rendering in the side column.

*Done when:* clicking "Edit card" shows path fields and a deck checklist;
checking a deck adds the card to it; editing a path updates the card in
place; advancing to the next card closes the panel.

## Verify

- `bun run build` passes clean.
- Live test: opened "Edit card" on card 259, added it to the "KEY" manual
  deck via the same API the checkbox calls, reloaded the panel and
  confirmed the checkbox showed checked (live membership data, not stale).
  Reverted the membership change afterward.
- Confirmed the player frame (timestamp, paused state, theme badge) was
  completely unchanged throughout - no second player, no disruption.
