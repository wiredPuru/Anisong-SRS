# Current Feature

## Edit a card in Study after passing or failing it

**Type:** Fix
**Status:** verified

### The problem

Once a Study round has a result, the Edit card panel cannot be used on the card that was just answered:

- **Typed answers:** `study/index.vue` passes `:disabled="Boolean(quizResult)"` to `StudyCardEditPanel`, and the panel's `startEdit()` returns early when `disabled` is set, so Edit does nothing while the result panel shows.
- **Both modes:** `onKeydown` returns early once `roundResult` is set (a typed or manual result), letting only flip card, flip Japanese and undo through, so the `E` hotkey is dead after Pass/Fail.
- **Stale history:** `onCardEdited` only updates `currentCard`. The answered card's `sessionHistory` entry keeps the old copy, so Previous card and the session log show the pre-edit title, paths and notes.

Manual Pass/Fail can already open the panel with its button (only the hotkey is blocked); typed answers cannot do either.

### The fix

1. Remove `:disabled="Boolean(quizResult)"` from `StudyCardEditPanel`. Nothing else uses that prop in Study, so leave the prop itself in place.
2. In `onKeydown`'s result-phase branch, let `editCard` through by calling `toggleEditFromKey()`, the same way flip card is handled (non-repeat, `hotkeys.claimSpace` for consistency).
3. Have `onCardEdited` also sync every `sessionHistory` entry with the same card id, as `onHistoryCardUpdated` already does, so Previous and the log stay current. Keep the existing current-card guard for the live card.

Must not break:

- Grading, scoring, undo and the result panel: an edit touches card fields only, never the box, streak, due date or `ReviewLog`.
- Continue still advances. Moving to the next card already resets `cardEditing` through the `presentationKey` watcher, so an unsaved edit is dropped as Cancel does today.
- The answer overlay stays disabled while editing (`answerControlsDisabled` already includes `cardEditing`).
- The `E` hotkey keeps its guards for loading, a busy submission, an open Preview or session log.

### Build steps

- [x] **1. Enable editing in the result phase.** Make the three changes above in `app/pages/study/index.vue`. Add a pure helper only if a test-worthy rule appears; the logic here is wiring, so it rides on browser evidence.
  - **Done when:** after a typed or manual round is graded, the Edit card button opens the form, `E` toggles it, Save updates the info panel and the session log/Previous entry for that card, and Continue then serves the next card normally.

### Verify

1. Start Study with Typed Answers on, answer a card, and with the result showing press `E`. The form opens. Change the notes, Save, and confirm the info panel shows them.
2. Open the session log (`L`) or Previous card: the same card shows the new notes.
3. Press Continue: the next card loads, with no open edit form.
4. Repeat with Typed Answers off, using Pass/Fail and then `E`.
5. Confirm the card's box and due date are unchanged by the edit, and `bun run test` and `bun run build` pass.

### Evidence

- `bun run test` passed (2778 tests) and `bun run build` passed on the final code.
- `/study` loaded on the dev server with the change. The graded-round path (press `E` after Pass/Fail or a typed result, Save, check the session log) was not exercised, because grading writes a real review into the library; it is left for the user's manual try.
