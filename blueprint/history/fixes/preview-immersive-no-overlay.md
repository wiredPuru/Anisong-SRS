# Current Feature

**Title:** Remove info overlay from CardPreviewModal's expanded/immersive mode

**Type:** Fix

**Status:** verified

## The problem

`CardPreviewModal.vue` (shared by `/decks`' per-row Preview and `/study`'s
"Previous card" / session-log preview) overlays `StudyInfoPanel` on top of the
video when its expanded (immersive) mode is toggled - see the `#immersive`
slot passed to `StudyMediaPlayer` at
`app/components/card/CardPreviewModal.vue:242-259`.

`/cards`' own inspector rail uses the same `StudyMediaPlayer` component with
`allow-expand="true"` (`app/pages/cards/index.vue:449-458`) but passes no
`#immersive` slot at all, so expanding there just fills the frame with a
clean video - no overlay. `CardPreviewModal`'s expanded mode should behave the
same way.

## The fix

Remove the `<template v-if="immersive" #immersive>` block (and its
now-unused `.info-slot` scoped CSS) from `CardPreviewModal.vue`. Expanding
the player inside the Preview modal will then just grow the video to fill
the frame, with no `StudyInfoPanel` overlay - matching `/cards`.

Leave everything else untouched: the `immersive` ref, the `E`/Escape
key handling, `allow-expand`, and the existing `v-else-if="!immersive"` block
that already hides the info panel/edit button while immersive. This applies
identically everywhere `CardPreviewModal` is used (`/decks` row preview and
`/study`'s Previous/session-log preview), since it's one shared component.

## Build steps

1. [x] Delete the `#immersive` slot template block and the `.info-slot` CSS rule
   from `CardPreviewModal.vue`.
   **Done when:** opening a card's Preview (from `/decks` or `/study`'s
   Previous/session-log button) and pressing `E` (or the expand control)
   grows the player with no info card overlaid on the video - same look as
   expanding the player in `/cards`' inspector rail.

## Verify

- Open `/decks`, pick a deck, Preview a card, expand it - no overlay.
- On `/study`, review a card, click "Previous card" (or open the session log
  and pick an entry), expand the resulting Preview - no overlay.
- Collapsing back out of immersive still shows the normal info panel + Edit
  button as before.
