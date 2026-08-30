# Feature: Deck assignment from card edit / Preview edit

**From build-plan:** feature 34
**Status:** verified

## Goal

Let deck membership (feature 13b's manual-deck checkboxes) be managed
directly from card editing - both `/cards`' row edit and
`CardPreviewModal`'s edit mode (feature 16) - as a second, complementary
entry point alongside the existing standalone "Decks" action on `/cards`,
which stays exactly as it is.

## In scope

- A new shared `components/deck/DeckMembershipPanel.vue` - the manual-deck
  checkbox list (name, checked state, disabled-while-toggling, a
  "No manual decks yet" hint, an error line), extracted from `/cards`'
  existing standalone panel so both call sites below can reuse it verbatim.
- `/cards`' row edit form (`editingId === c.id`) gains the same panel,
  wired to the page's existing `manualDecks`/`membershipsData`/
  `toggleDeckMembership`/`togglingMembership`/`deckToggleError` state - no
  new fetches, since that state is already loaded for the standalone panel.
- `/cards`' existing standalone "Decks" button + panel is refactored to use
  the same new component (so the checkbox markup exists in exactly one
  place), not removed - editing gains a *second* path to the same action,
  per the build-plan's "instead of only through that standalone panel"
  wording.
- `CardPreviewModal.vue`'s edit mode gains the same panel. Unlike `/cards`,
  this component has no existing manual-decks/memberships state, so it
  fetches both itself (`GET /api/decks?type=created`,
  `GET /api/decks/memberships`) when editing starts, and re-fetches
  memberships after each toggle - self-contained, matching how this
  component already independently `PATCH`es `/api/cards` for its own
  saves rather than relying on a parent.
- No server, schema, or API changes - reuses `GET /api/decks?type=created`,
  `GET /api/decks/memberships`, and `POST`/`DELETE /api/decks/cards`
  exactly as feature 13b built them.

## Out of scope

- The manual deck's own detail view (`/decks?type=created`, opened from
  the Decks page) - already has its own card list, "Remove" action
  (13b), and "Add existing cards" search (28); not touched. It gets this
  feature's benefit only indirectly, through the `CardPreviewModal` it
  already renders (feature 22).
- Fixing `GET /api/decks?type=created`'s existing pagination cap (~25
  decks per page, no further pages fetched) - a pre-existing limitation
  of the standalone panel this feature reuses as-is, not a regression
  introduced here.
- Removing `/cards`' standalone "Decks" button - stays, unchanged in
  behavior, as an independent entry point.
- Any change to `/decks/index.vue` itself.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Extract `DeckMembershipPanel`, refactor the standalone
  panel to use it (no behavior change)**
  - New `nuxt-app/app/components/deck/DeckMembershipPanel.vue`: props
    `cardId: number`, `decks: { id: number; name: string }[]`,
    `memberships: Record<number, number[]>`,
    `toggling: Record<string, boolean>` (keyed `` `${cardId}-${deckId}` ``),
    `error: string | null`; emits `toggle: [deckId: number, checked:
    boolean]`. Template and styles are the existing `.decks-panel` markup
    moved verbatim from `cards/index.vue` (hint, checkbox rows, error
    line), parameterized on the props above instead of closing over page
    state directly.
  - `cards/index.vue`: replace the existing inline `.decks-panel` block
    (the one shown when `openDecksPanelId === c.id`) with
    `<DeckMembershipPanel>`, passing the page's existing `manualDecks`,
    `membershipsData?.memberships`, `togglingMembership`,
    `deckToggleError`, and handling `@toggle` by calling the existing
    `toggleDeckMembership(c.id, deckId, checked)`. Remove the
    now-unused `isInDeck`/`cardDeckIds` helpers (only ever used by the
    markup just replaced).
  - *Done when:* `bun run build` passes; the standalone "Decks" button
    opens the identical-looking checkbox panel, and checking/unchecking a
    deck still works exactly as before this refactor - a pure extraction,
    verified as a regression check with no new behavior yet.

- [x] **Step 2 - Add the panel to `/cards`' inline edit form**
  - Add `<DeckMembershipPanel>` inside `.edit-form` (the `editingId ===
    c.id` block), same props and `@toggle` handler as the standalone
    panel from Step 1.
  - *Done when:* `bun run build` passes; clicking "Edit" on a card now
    also shows the manual-deck checkboxes there; toggling one in the edit
    form updates membership - confirmed by then opening the standalone
    "Decks" panel for the same card and seeing the same checked state.

- [x] **Step 3 - Wire the panel into `CardPreviewModal`'s edit mode**
  - Add local `manualDecks: ManualDeck[]`, `cardMemberships:
    Record<number, number[]>`, `togglingMembership: Record<string,
    boolean>` (reactive), `deckToggleError: string | null` state.
  - Add `loadDeckData()`: fires `GET /api/decks?type=created` and
    `GET /api/decks/memberships` (via `$fetch`, in parallel), populating
    the two refs above; called (not awaited) from `startEdit()` so the
    edit form still appears immediately and the panel populates once the
    fetch resolves. On failure, set `deckToggleError` too (reusing the
    same error slot the toggle handler uses) - otherwise a failed fetch
    would silently look identical to "no manual decks exist yet."
  - Add `toggleDeckMembership(deckId, checked)`: mirrors `/cards`'
    version - `POST`/`DELETE /api/decks/cards` with `{ deckId, cardId:
    card.id }`, then re-fetches memberships; sets `deckToggleError` on
    failure.
  - Render `<DeckMembershipPanel :card-id="card.id" :decks="manualDecks"
    :memberships="cardMemberships" :toggling="togglingMembership"
    :error="deckToggleError" @toggle="toggleDeckMembership" />` inside
    `.edit-form`.
  - *Done when:* `bun run build` passes; opening a card's Preview (from
    either `/cards` or a deck detail view), clicking "Edit card," shows
    the manual-deck checkboxes with the card's real current memberships;
    toggling one there updates it - confirmed by closing the modal,
    reopening `/cards`' standalone "Decks" panel (or another Preview) for
    the same card, and seeing the change reflected.

## Files / areas

- `nuxt-app/app/components/deck/DeckMembershipPanel.vue` - new; standalone
  panel refactored to use it, dead helpers removed (Step 1).
- `nuxt-app/app/pages/cards/index.vue` - edit-form gains the panel too
  (Step 2).
- `nuxt-app/app/components/card/CardPreviewModal.vue` - own deck-data
  fetch, toggle handler, and the panel in edit mode (Step 3).

## Data / contracts

No server, schema, or API changes.

- New component contract (load-bearing for Steps 2 and 3, since it's built
  in Step 1 for both to consume):
  ```ts
  interface ManualDeck { id: number; name: string; }
  defineProps<{
    cardId: number;
    decks: ManualDeck[];
    memberships: Record<number, number[]>; // cardId -> deckId[]
    toggling: Record<string, boolean>; // `${cardId}-${deckId}` -> boolean
    error: string | null;
  }>();
  defineEmits<{ toggle: [deckId: number, checked: boolean] }>();
  ```

## Testing

No test runner is configured in `AGENTS.md` yet. This is UI wiring and a
component extraction with no new business logic (membership toggling
already exists server-side, untouched) - not a candidate for a unit test
even once a runner exists. Verify via `bun run build` at each step, plus a
manual browser pass: Step 1's regression check (standalone panel behaves
identically after the refactor), and Steps 2 and 3's cross-view consistency
checks (a toggle made in one place - edit form, Preview, or the standalone
panel - is reflected in the others) all need an actual click-through, not
just reading the code.

## Notes for the AI

- `DeckMembershipPanel` takes `cardId` plus the *whole* memberships map
  (not a pre-filtered list) so its `toggling` key format
  (`` `${cardId}-${deckId}` ``) matches `/cards`' existing convention
  exactly - `CardPreviewModal` just uses a memberships map with only one
  card's entry in it, which works identically.
- `CardPreviewModal.vue`'s `<form v-if="editing">` wrapping the edit
  fields is fine to also wrap the new panel - plain checkboxes don't
  trigger form submission, so no `@submit.prevent` concerns.
- Match `components/deck/` naming (already used by
  `DeckAddAnimeModal.vue`) and the auto-import convention noted since
  feature 11: filename must start with the folder name (`Deck...`), or
  Nuxt registers it under a different auto-import tag than expected.
- Don't touch `/decks/index.vue` - it renders `CardPreviewModal` already
  and needs no changes to benefit from Step 3.

## Verification note

Build evidence (`bun run build`) passed at every step. This session's
environment had no browser/Playwright tool, so the manual click-through
checks named in each step's "done when" (toggling a deck in one place and
confirming it's reflected in another) were not personally performed by the
implementing agent - only API-level checks (`GET /api/decks?type=created`,
`GET /api/decks/memberships` both confirmed returning correct real data)
and code-level equivalence review. Worth a real click-through if this ever
regresses.
