# Click single-action rows directly

**Type:** Fix

**Status:** verified

**Branch:** `fix/click-single-action-rows`

**Completed:** 2026-09-14

## The problem

Several list rows carry exactly one control, a small pill button at the far
right, and clicking anywhere else on the row does nothing. On a wide window
that means travelling across the whole row to hit "Select" or "Add".

Some lists already behave the way this should: `/cards`' Anime, Artist, and
import-list results are whole-row buttons (`.result-toggle`), and so are the
Study session log rows, deck tiles, and the Home page's weakest-deck rows. The
rows below are the ones that were never brought in line.

A survey of every list surface found five rows with a single action:

| # | Where | Row | Only action |
|---|---|---|---|
| 1 | `app/pages/decks/index.vue` - manual deck "Add a new anime" | AniList result | **Select** (opens `DeckAddAnimeModal`) |
| 2 | `app/pages/decks/index.vue` - manual deck "Add cards" | Existing card result | **Add** to this deck |
| 3 | `app/components/card/CardAddSongResults.vue` | Song result, not yet added | **Add** |
| 4 | `app/components/card/CardAddArtistResults.vue` - artist catalog modal | Theme, not yet added | **Add** |
| 5 | `app/components/deck/DeckAddAnimeModal.vue` | Theme, not yet added | **Add** |

Deliberately excluded, because they do not have exactly one action:

- **Rows that already work:** the whole-row buttons listed above.
- **Several actions:** any row after it is added (Preview, Delete, Download), and
  `/cards`' inspector and table rows (checkbox plus inspect).
- **An input beside the button:** `CardAddAnimeResults.vue`'s theme rows, where
  "Add card" sits next to an optional local-video-path field. A row click
  there would land while the user is aiming for the field.
- **No action at all:** the Home page's recently-added list.

## The fix

Make the row itself fire its one action, while keeping the visible pill.

- **Keep the button, add a row click.** Each row gets `@click` calling the same
  handler, and the pill gets `@click.stop` so a click on it fires once, not
  twice. The pill stays in the tab order, so keyboard users still have a real
  `<button>`. The alternative, wrapping the row in one `<button>`, would turn
  the pill into a non-interactive span and means reshaping rows whose added
  state holds other buttons (a `<button>` cannot contain buttons).
- **Only while single-action.** The row click is bound only in the state that
  has one action. Rows 2-5 switch to "Added" (a badge, or Preview/Delete/
  Download) after a successful add, and from then on a row click does nothing,
  so a second click can never add twice or land on the wrong control.
- **Respect in-flight state.** A row click is ignored while that row is
  already adding, the same way its disabled pill is.
- **One shared affordance.** A global `.row-clickable` class in
  `app/assets/css/main.css` (beside `.sr-only` and `.deck-link`) sets
  `cursor: pointer` and a hover edge in `--accent-secondary` (an inset
  shadow, so nothing shifts), the same highlight the Study session log rows
  already use, so all five rows look and feel the same without five copies.

Worth knowing: rows 2-5 are "Add", which creates a card or a deck membership,
so a stray click on a row now adds. That is the requested behaviour, and
it stays cheap to undo: the row immediately shows Added with a Delete or
Remove beside it, and duplicate cards are already rejected server-side.

Must not break:

- Every pill button still works on its own and fires exactly once.
- Added rows keep their Preview, Delete, Remove, and Download buttons working,
  none of them triggering a row action.
- Disabled/in-progress rows stay inert.

## Build steps

### Step 1 - shared class and the deck page rows (1, 2)  (done)

- Add `.row-clickable` to `app/assets/css/main.css`.
- `app/pages/decks/index.vue`: the "Add a new anime" `<li>` calls
  `openAddAnimeModal(r)`; the "Add cards" `<li>` calls
  `addCardToCurrentDeck(r.id)` only while `!isCardInDeck(r.id)` and not
  already adding. Both pills get `@click.stop`.

**Done when:** on a manual deck, clicking the text area of an "Add a new anime"
row opens the add-anime modal, clicking an "Add cards" result row adds it and
shows "Added", and clicking that row again does nothing.

### Step 2 - the three add-theme rows (3, 4, 5)  (done)

- `CardAddSongResults.vue`, `CardAddArtistResults.vue` (catalog modal theme
  rows), and `DeckAddAnimeModal.vue`: the `<li>` runs its existing add handler
  only while the row is un-added and not adding, with `row-clickable` applied
  in that state only. Pills get `@click.stop`.

**Done when:** in each of the three, clicking an un-added row's title adds it
once; clicking an added row's text does nothing; Preview, Delete, and Download
on added rows still act alone.

## Verify

1. `cd nuxt-app && bun run test` and `bun run build` - green.
2. `/decks?type=created&id=<deck>`: search "clannad" in Add cards. Click the
   middle of a "CLANNAD" row under "Add a new anime" - the modal opens. In the
   modal, click a theme row's title - it adds once and shows Added. Click the
   row again - nothing.
3. Same box: click an existing-card result row - it adds to the deck. Click
   again - nothing.
4. `/cards`: search a song title; click an un-added row in the Song group - it
   adds; Preview and Delete on it still work alone.
5. `/cards`: open an artist from the Artist group; click a theme row - it adds.
6. Hover each of the five rows: pointer cursor and a cyan edge; hovering an
   added row shows neither.
7. Tab through a result list: each pill still receives focus and Enter fires it.

## Notes from the build

- The hover affordance is an inset `--accent-secondary` edge, matching the Study
  session log rows, rather than a background change; the spec line was amended
  during step 1.
- Found while verifying, not fixed here: `DeckAddAnimeModal` does not pre-mark
  songs that already have a card, so their Add (by button or row) fails with
  "A card for this song already exists." The `/cards` add groups pre-mark via
  `GET /api/cards/by-songs`; this modal never got that.
