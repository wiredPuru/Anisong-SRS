# Feature: Quick deck creation from card edit

**From build-plan:** feature 120
**Status:** verified

## Goal

Let a card's Decks list create a manual deck on the spot. Type a name, press
Create (or Enter), and the deck is made and the card is ticked into it, so
nobody has to leave the edit to visit `/decks` first.

## In scope

- A "New deck" text field plus Create button inside `DeckMembershipPanel.vue`,
  which every card edit surface already renders: the `/cards` and `/decks`
  inspector (`CardInspector`), Study's Edit card panel
  (`StudyCardEditPanel`), and the edit modal used from Listen
  (`CardPreviewModal`).
- Creating calls the existing `POST /api/decks` (name trimmed and
  duplicate-checked server-side), then ticks the current card into the new
  deck through the host's existing membership toggle.
- A blank name disables Create; a duplicate or failed create shows the
  server's message inline and keeps what was typed.
- Each host adds the new deck to its own deck list so it shows at once, and
  `/cards`' bulk "Add to deck" select sees it too.
- The empty-list hint no longer sends the user to `/decks`.

## Out of scope

- Renaming, a picture, or a grading criterion at creation (all stay on `/decks`).
- A new route, schema change, or `project-plan.md` change.
- Creating a deck from any place other than a card edit's Decks list.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

## Build steps

- [x] **Step 1 - Create field in the shared panel, wired into the Preview
  modal.** `DeckMembershipPanel` gets the name field and Create button; it
  POSTs `/api/decks`, emits `created` with the new deck, then emits the
  existing `toggle(deck.id, true)`. Enter in the field creates and never
  submits the surrounding edit form. `CardPreviewModal` handles `created` by
  appending the deck to its `manualDecks`. *Done when:* on `/listen`, editing a
  card, typing a new name and pressing Enter shows the deck in the list ticked,
  a duplicate name shows "A deck with this name already exists." and the form
  is not submitted.
- [x] **Step 2 - Wire the other hosts.** `StudyCardEditPanel` and
  `CardInspector` forward a `deck-created` event; `/study`, `/cards` and
  `/decks` append the deck to their `manualDecks` (the `useFetch` data) on it.
  *Done when:* the same flow works in Study's Edit card panel, the `/cards`
  inspector and a `/decks` detail inspector, the new deck appears in `/cards`'
  bulk "Add to deck" select and on `/decks`' Created tab after reload.

## Files / areas

- `nuxt-app/app/components/deck/DeckMembershipPanel.vue`
- `nuxt-app/app/components/card/CardPreviewModal.vue`
- `nuxt-app/app/components/card/CardInspector.vue`
- `nuxt-app/app/components/study/StudyCardEditPanel.vue`
- `nuxt-app/app/pages/study/index.vue`, `pages/cards/index.vue`,
  `pages/decks/index.vue`

## Data / contracts

- Reuses `POST /api/decks` `{ name }` -> `{ deck: { id, name, ... } }` or a
  400 with `statusMessage`. No change.
- New client events (load-bearing across the four hosts): the panel emits
  `created: [deck: { id: number; name: string }]`, always before `toggle`;
  `CardInspector` and `StudyCardEditPanel` forward it as `deck-created`.

## Testing

- No new pure logic, so no unit test; `bun run test` must stay green.
- UI rides on `bun run build` plus browser evidence: create in each surface,
  duplicate and blank names, Enter not submitting the edit form.

## Notes for the AI

- The panel sits inside `<form>`s: Enter in the new field must call
  `.prevent` and create, not save the card.
- Study treats keys outside text fields as hotkeys; typing in the field must
  not trigger them (same as the card edit's other inputs, so follow how
  they stop propagation).
- Match the panel's scoped-style tokens; no inline styles; no em dashes.
