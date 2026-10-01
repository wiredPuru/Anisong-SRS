# Fix: Session log button in place of Previous card

**Type:** Fix
**Status:** verified

## The problem

Below the Study player (and on the "All caught up" screen) sit two look-alike
buttons: "↩ Previous card" and "↻ Undo review". They read as near duplicates,
since both seem to be about the last card. "Previous card" only opens the most
recent card in Preview, which the session log (feature 52) already does from
its top row, alongside every other card of the session.

## The fix

In both `history-actions` rows in `app/pages/study/index.vue`, replace the
"Previous card" button with a "Session log" button that opens
`StudySessionLogModal`, the same thing the header's 📋 button and `L` already
open. The new button:

- reads "📋 Session log", with the tooltip "See every card from this session
  · Hotkey: L";
- is disabled while a typed-answer result is showing, like the header's log
  button;
- keeps the row's existing styling, renamed from `.previous-card-btn` to
  `.session-log-btn`.

Undo review is unchanged. The `P` hotkey still opens the last card, since it
costs nothing and a muscle-memory user loses nothing. It drops from the hotkey
legend, which already lists `L` for the log. `openPreviousCard` stays because
`P` still calls it.

Must not break: the header's 📋 button, `L`, `U`, Undo on the typed result
panel, and the log opening from "All caught up" (the modal is page-level, so
it already renders there).

## Build steps

- [x] **Step 1 - Swap the button** - replace both "Previous card" buttons with
  the Session log button, rename the class, and drop `P previous card` from the
  legend. *Done when:* after reviewing one card, the row under the player shows
  "📋 Session log" and "↻ Undo review"; clicking Session log opens the log
  listing that card; the same holds on "All caught up"; `P` still opens the
  last card; the build and tests pass.

## Verify

- `bun run dev`, open `/study`, pass or fail a card: the row under the player
  shows Session log and Undo review. Session log opens the log, and clicking
  its top row opens that card in Preview.
- Finish every due card: "All caught up" shows the same two buttons, and
  Session log opens the log.
- With Typed Answers on, while the result panel shows, Session log is
  disabled and Undo still works.
