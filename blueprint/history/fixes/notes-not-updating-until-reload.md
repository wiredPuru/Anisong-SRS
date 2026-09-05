# Current Feature

## Saved notes do not appear until a reload

**Type:** Fix
**Status:** verified

## The problem

Editing a card's notes (feature 56) writes to the database correctly - every
save path sends `notes` and `PATCH /api/cards` returns the full updated
`CardWithDetails` - but two surfaces never show the new value back, so the save
reads as a no-op.

| Surface | Saves? | Shows immediately? | Shows after reload? |
| --- | --- | --- | --- |
| `/study` (`StudyCardEditPanel`) | yes | **no** | yes |
| `/cards` inspector rail | yes | **no** | **no** |
| `CardPreviewModal` (from `/decks`) | yes | yes | yes |

Two separate causes:

1. **`/study` applies only part of the update.**
   `onCardEdited()` in [study/index.vue:214-221](nuxt-app/app/pages/study/index.vue#L214-L221)
   copies exactly `localVideoPath` and `localAudioPath` off the payload and
   discards the rest, so `currentCard.notes` keeps its pre-edit value and
   `StudyInfoPanel`'s `:notes="currentCard.notes"` ([study/index.vue:721](nuxt-app/app/pages/study/index.vue#L721))
   stays stale until the next card is fetched. Nothing type-errors because the
   handler's inline parameter type only lists the three fields it uses.
   `onHistoryCardUpdated()` directly above it already does the right thing
   (`{ ...currentCard.value, ...updated }`), so the two handlers disagree.

2. **`/cards`' inspector never renders notes read-only.** The inspector body
   ([cards/index.vue:460-579](nuxt-app/app/pages/cards/index.vue#L460-L579))
   has blocks for titles, tiles, Sources, Decks, and the edit form, but no
   Notes block. `saveEdit()` correctly calls `replaceCard(result.card)`, so the
   data is there in `selectedCard` - there is simply nowhere for it to show.
   Notes are effectively write-only on that page, which is why a reload does
   not help either.

## The fix

1. Widen `onCardEdited()` to apply the whole updated card, mirroring
   `onHistoryCardUpdated()`'s existing spread, so any field the panel edits
   (notes today, anything added later) propagates. Type the parameter as
   `{ id: number } & Partial<CardWithDetails>` so it accepts
   `StudyCardEditPanel`'s deliberately narrow emit shape while still being
   checked against the real card type.
2. Add a read-only Notes block to `/cards`' inspector, placed above the
   Sources block, following the existing `inspector-block` + `block-label`
   pattern. Absent entirely when the card has no notes, matching how
   `StudyInfoPanel` omits its own empty Notes row.

Must not break:

- `StudyCardEditPanel`'s local-path clear and download flows, which route
  through the same `updated` emit and must keep updating the player's source.
- `CardPreviewModal`'s already-correct behavior on `/decks` - no change there.
- The inspector's existing block order and spacing; the Notes block reuses the
  established styling rather than introducing a new surface treatment.

Out of scope: `/decks`' local `DeckCard` interface is missing `notes`,
`songTitleNative`, and `streak` compared to the real wire shape. It works at
runtime (the whole server object is assigned through), so it is a typing
accuracy gap, not this bug.

## Build steps

- [x] **Step 1 - propagate the full card on `/study`.** Change
      `onCardEdited()` to spread the whole payload onto `currentCard`.
      **Done when:** editing a card's notes from `/study`'s edit panel and
      saving updates the info panel's Notes row on the spot, with no card
      change or reload, and clearing/downloading a local path from that same
      panel still swaps the player's source as before.

- [x] **Step 2 - show notes in `/cards`' inspector.** Add the read-only Notes
      block above Sources. **Done when:** selecting a card with notes shows
      them in the rail; saving an edited note updates that text immediately;
      and a card with no notes shows no Notes block at all.

## Verify

1. `bun run dev` in `nuxt-app/`.
2. **`/study`** - start a session, open the card edit panel, type a note, Save.
   The info panel's Notes row shows the new text immediately. Edit again and
   clear it; the row disappears without a reload.
3. **`/cards`** - select a card, Edit card, add a note, Save. The inspector
   shows a Notes block with that text right away. Reload; it is still there.
   Select a card with no notes; no Notes block renders.
4. **`/decks`** - open a card's Preview, edit its notes, Save. Unchanged from
   today: the note updates immediately.
5. `bun run test` stays green (no new logic in scope for a unit test - both
   steps are UI state propagation and rendering, verified in the browser per
   the Testing section of `coding-standards.md`).
