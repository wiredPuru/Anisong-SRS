# Fix: Card actions missing on /cards/new

**Type:** Fix
**Status:** verified

## The problem

`/cards`' list rows give each card four actions - Preview, Decks, Edit, Delete
- plus source badges and download buttons. A card just added on `/cards/new`
only gets an "Added" badge and download buttons (`nuxt-app/app/pages/cards/new.vue:230-267`).
There's no way to preview, edit, manage deck membership, or delete a card
without leaving for `/cards` and finding it again.

This was a known, explicit deferral: features 11 (Preview), 13b (Decks panel),
16 (edit metadata), and 17 (delete) each said "not on `/cards/new`, deferred."
This fix closes that gap by reusing what those features already built, not by
building new versions of them.

## The fix

Add the missing actions to the "Added" branch of `/cards/new`'s theme list
(`nuxt-app/app/pages/cards/new.vue`), reusing existing pieces:

- **Preview** button -> opens the existing `CardPreviewModal` (same component
  `/cards` uses). That modal is fully self-contained: it already loads its own
  manual-deck list and memberships, and its own Edit mode already includes
  song title / theme slot / artist / local paths *and* the `DeckMembershipPanel`
  (feature 34 folded deck assignment into this same edit mode). So one Preview
  button reaches Preview, Edit, and Decks together - **not** three separate
  buttons like `/cards`' row. `/cards`' standalone inline "Edit" (path-only)
  and standalone "Decks" toggle predate feature 34 and are redundant with what
  the modal now does in one place; this fix does not copy that redundancy.
  Flagging this choice for review: if a literal 4-button match to `/cards` is
  wanted instead, say so before `/implement` builds it.
- **Delete** button -> calls `DELETE /api/cards` directly (same call
  `/cards`' `removeCard()` makes), then removes the entry from `addedCards` so
  the row reverts to its pre-add state (matches deleting on `/cards`, where the
  card simply disappears from the list).

No server changes: `POST /api/cards` already returns the full
`CardWithDetails` shape (via `getCardWithDetails()`,
`nuxt-app/server/utils/cards.ts`), including `songTitleNative` and
`animeCoverImageUrl` - `new.vue`'s local `CardWithDetails` interface just
under-declares those two fields today and needs to catch up to what's already
on the wire, so `CardPreviewModal`'s stricter prop type accepts it.

## Build steps

- [x] **Step 1 - wire Preview + Delete into `/cards/new`**
  - In `nuxt-app/app/pages/cards/new.vue`, add `songTitleNative: string;` and
    `animeCoverImageUrl: string | null;` to the local `CardWithDetails`
    interface (matching `CardPreviewModal`'s prop type and what the API
    already returns).
  - Add `const previewCard = ref<CardWithDetails | null>(null);`.
  - Add `async function removeCard(songId: number)` that calls `$fetch("/api/cards", { method: "DELETE", body: { id: addedCards[songId].id } })`
    then `delete addedCards[songId]` (wrap in try/catch like the file's other
    handlers; surface a failure via the existing `addError[songId]` ref rather
    than adding a new error ref).
  - In the `added-info` block, add a `Preview` button (`@click="previewCard = addedCards[theme.songId]"`)
    and a `Delete` button (`@click="removeCard(theme.songId)"`), styled with
    the same `.preview-btn`/`.remove-btn` treatment `/cards/index.vue` already
    defines (port the two rule blocks into this file's `<style scoped>`,
    matching class names for consistency).
  - Add `<CardPreviewModal :card="previewCard" :open="previewCard !== null" @close="previewCard = null" @updated="(c) => { addedCards[c.songId] = c; previewCard = c; }" />`
    at the end of `<main class="cards-new">`, next to the existing markup
    (same placement pattern as `/cards/index.vue`'s own instance).
  - *Done when:* on `/cards/new`, after adding a card, its row shows Preview
    and Delete alongside the existing Added badge/download buttons. Preview
    opens the same modal `/cards` uses, with working playback, edit (title/
    theme/artist/paths), and deck-membership checkboxes; saving an edit there
    updates the row's badge state live. Delete removes the card via the API
    and the row reverts to its pre-add (search/add) state. `bun run build`
    passes.

## Files / areas

- `nuxt-app/app/pages/cards/new.vue` - the only file this touches.

## Data / contracts

No schema or API changes. `new.vue`'s local `CardWithDetails` type gains two
fields it was already receiving but not declaring.

## Verify

1. `bun run dev`, go to `/cards/new`, search an anime, add a card.
2. Confirm the added row shows Preview and Delete buttons.
3. Click Preview: playback works, Edit mode shows title/theme/artist/paths
   plus a Decks checkbox panel; toggle a deck membership and confirm it
   sticks (check `/decks` -> Created).
4. Click Delete: the card is removed (confirm via `/cards` that it's gone),
   and the `/cards/new` row reverts so the card can be re-added.
5. No test runner is configured; this is UI/integration behavior, verified by
   the manual pass above plus `bun run build`.
