# Fix: Grading stays locked after editing a card on Study

**Type:** Fix
**Status:** verified (build, tests, browser: D and Back to the video unlock grading after a style change; arrow-key grade then Undo restored the review log. The J path shares the same watcher and was not driven live.)

## The problem

On `/study`, after changing an audio-first card's style from the Edit card
panel, Missed and Got it stay disabled with no visible reason. The user cannot
grade the card (reported with a screenshot: answer revealed, picture showing,
both buttons greyed out).

**Cause:**
- The Edit card form lives on the details side of the flip card.
- While the form is open, `cardEditing` is true, and `answerControlsDisabled`
  (`pages/study/index.vue`) turns off every answer control.
- Flipping back to the picture (`D`, "Back to the video", the picture toggle,
  or `J` to the Japanese breakdown) hides the form without closing it. The
  controls stay locked, and the user can't see why.
- Feature 125 made this common. Marking a card audio first now keeps the form
  open so its style picker can be used, and changing the style never closes
  it. The same lock was already reachable before 125 by opening the editor and
  then flipping back to the picture.

## The fix

When the details card is flipped away while the editor is open, close the
editor.

- This is what `E` already does: the panel's `toggle()` drops unsaved edits,
  the same as Cancel. Flipping away is treated the same way, so there is no new
  rule about unsaved edits.
- The form stays open while the details side is showing, so trying several
  styles one after another still works.

**Implementation:**
- `StudyCardEditPanel` exposes a `close()` that calls `cancelEdit()` when the
  form is open.
- In `pages/study/index.vue`, watch `showDetails`. When it turns false while
  `cardEditing` is true, call `cardEditPanelRef.value?.close()`.
- This covers every flip path: `D`, "Back to the video", the picture toggle,
  and `J` (opening the breakdown sets `showDetails` false).
- It must not break:
  - The `presentationKey` reset. A new card already sets `cardEditing` false,
    so the extra close is harmless.
  - Editing while the details are showing. Grading stays locked while the form
    is visibly open, as intended, because the open form is the reason.
  - Preview, Listen and `/cards`, which have no flip lock.

## Build steps

- [x] **Step 1 - Close the editor when the details flip away.** Add `close()`
  to `StudyCardEditPanel` and the `showDetails` watcher in Study.
  - *Done when:* in the browser on `/study`:
    1. Open Edit card, mark Audio first, and change the style. The form stays
       open.
    2. Press `D`, or click Back to the video. The form closes and Missed and
       Got it are enabled.
    3. Grading with the arrow keys works.
    4. Opening the editor and pressing `J` (with the Japanese breakdown on)
       also unlocks grading.
    5. `bun run build` and `bun run test` are green.

## Verify

1. On `/study`, reveal a card and open Edit card (`E`).
2. Mark it Audio first and pick Pixelate.
3. Press `D` to go back to the video. Missed and Got it should now work.
4. Press the right arrow. The card is graded and the next card loads.

UI only, no new pure logic, so no new unit test. The evidence is browser checks
plus the build and the existing suite.
