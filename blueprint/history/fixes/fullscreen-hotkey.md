# Fix: the full-screen hotkey does nothing on Cards and Decks

**Type:** Fix
**Status:** verified
**Branch:** `fix/e-hotkey-expand-player`

## The problem

On `/cards` and on a deck's detail view on `/decks`, the player in the
inspector rail has an expand button whose tooltip reads "Hotkey: E", but
pressing `E` does nothing. The button itself works (reproduced 2026-10-05 on
`/cards`: the player grows from 399px to 1358px wide on click and collapses on a
second click, while a dispatched `E` keydown changes nothing).

Cause: the `E` binding lives in `CardPreviewModal.vue`'s own `onKeydown`
(feature 36), not in `StudyMediaPlayer`. Since feature 50c `/cards` no longer
opens that modal, and since feature 81 `/decks` uses the same `CardInspector`,
so the rail's `StudyMediaPlayer` is mounted with `allow-expand` and
`v-model:immersive` but nothing listens for the key. Only `/stats`' trouble
cards still open `CardPreviewModal`.

## The fix

Make `StudyMediaPlayer` own the hotkey, since it owns the expand button, the
tooltip that advertises it, and the Escape collapse already.

- In `StudyMediaPlayer.vue`'s `onKeydown`, toggle `update:immersive` on `F`
  when `allowExpand` is set, and change the button's tooltip to "Hotkey: F".
  The key changes from `E` to `F` at the user's request (F for full screen; it
  is also party display's fullscreen key, and frees `E` for Edit card). Ignore
  `F` with Ctrl, Meta, or Alt held so browser shortcuts are untouched; the
  existing typing-target guard already applies.
- Remove the `E` branch from `CardPreviewModal.vue`'s `onKeydown`, so the old
  key stops expanding there and the new one is not toggled twice. Its Escape branch
  stays as it is.

Must not break:
- `/study` passes no `allow-expand`, so `F` there does nothing and `E` still
  toggles Edit card.
- `CardPreviewModal` still expands, now on `F` (through the player) and still
  ignores it while editing, because it passes `:allow-expand="!editing"`.
- Escape still collapses first, then closes the Preview modal.
- Typing `f` in a search box or any text field does not expand anything.

## Build steps

- [x] **Step 1 - Move the E hotkey into StudyMediaPlayer** - the two edits
  above. *Done when:* in the browser, selecting a card on `/cards` and
  pressing `F` expands the rail player to fill the content area and `F` again
  collapses it; the same on a deck's detail view on `/decks`; `F` typed in the
  search box does nothing; on `/stats`, opening a trouble card's Preview and
  pressing `F` toggles once (not twice) and `E` no longer expands; on
  `/study`, `E` still opens Edit card and nothing expands. `bun run build` and `bun run test` pass.

## Verify

1. Open `/cards`, click a card with a clip, press `F`. The player goes full
   screen; `F` or `Esc` returns it.
2. Open `/decks`, open a deck, click a card, press `F`. Same result.
3. Click into the Cards search box and type "f". The text appears and nothing
   expands.
4. On `/study`, press `E`. Edit card opens, the player does not expand.

## Additions made while building

- **The key became F, not E.** The spec was written for `E`; the user asked
  mid-build for `F` ("F for full screen"). The player's tooltip now reads
  "Hotkey: F", `E` no longer expands Preview, and `E` stays Edit card on
  `/study`. `F` is also the party display's fullscreen key.

## Evidence

- Browser (playwright-cli, 1440x800, real key presses): on `/cards` and on
  `/decks?type=created&id=88`, `F` grew the rail player from 399px to 1358px
  wide and `F` again returned it; on `/cards`, `E` did nothing, `F` then Esc
  collapsed it, and typing `f` in the search box typed and expanded nothing.
  On `/stats`, a trouble card's Preview toggled once per `F`, ignored `E`, and
  Esc collapsed it while leaving the modal open. On `/study`, `F` did nothing
  and `E` opened Edit card.
- `bun run build` completes and `bun run test` passes (123 files, 1728 tests).
  No unit test: the change is a UI key binding, outside the test gate's scope.

