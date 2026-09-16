# Fix: Overlay typed-answer search on the video

**Type:** Fix

**Status:** verified

## The problem

On `/study`, Typed Answers puts the anime-title search in the right-hand side
column, away from the media the user is watching and below the card information
and edit controls. This makes the primary quiz interaction less immediate and
can push it down the scrolling side panel.

## The fix

While Typed Answers is active and waiting for an answer, move its search surface
into a compact, bottom-centered overlay within the player pane. Keep the input,
autocomplete suggestions, status feedback, Submit answer, and Give up actions
usable without obscuring the whole video. Suggestions should open within the
available player area, and the overlay must remain readable against both video
and audio-cover backgrounds by using the existing theme and glass tokens. Its
guidance tells the user that typing or pressing Space starts playback; an empty
Space press starts paused media without inserting a blank into the search.

Treat only a selected database suggestion as a valid answer. Hide Submit answer
until such a selection exists. When the user has typed non-empty text without a
valid selection, Enter should give up and grade the card as failed so they do
not need to click Give up separately.

Keep the side column's blurred card information, edit controls, result panel,
and manual-review layout unchanged. Preserve autofocus, IME composition,
keyboard selection/submission, first-keystroke playback, exact AniList-ID
grading, the result/Continue phase, and all playback controls. Do not add a new
fullscreen or immersive Study mode.

## Build steps

- [x] **Step 1 - Place Typed Answers over the player.** Render the existing
  `StudyTypedAnswer` interaction in an anchored overlay inside `.player-pane`
  during the unanswered Typed Answers phase, and adapt its responsive styling
  so the input, upward-opening suggestion list, status text, and actions stay
  contained and usable at desktop and narrow widths. Remove its old side-column
  placement without duplicating component state or event wiring. **Done when:**
  Typed Answers presents one searchable answer control over the lower part of
  the player, the suggestion list and buttons remain fully reachable without
  overflowing or blocking essential media controls, and manual mode plus the
  saved-answer result phase retain their current layouts and behavior.
- [x] **Step 2 - Make unmatched Enter give up.** Show Submit answer only after
  the user selects a database-backed suggestion. If non-empty text has no valid
  selection, make Enter emit the existing Give up action while preserving
  suggestion selection, valid-answer submission, empty Enter, and IME guards.
  **Done when:** unmatched text followed by Enter reaches the existing failed
  result phase, Submit answer is absent until a valid suggestion is selected,
  and selecting then submitting a valid database answer still uses its AniList
  ID for grading.

## Verify

- Run `bun run test` and `bun run build` from `nuxt-app/`, then run
  `git diff --check` from the repository root.
- In `/study`, enable Typed Answers on video and audio-cover cards and confirm
  the answer search appears over the player, stays readable, and keeps focus.
- Type with keyboard and IME input, navigate suggestions with arrow keys, close
  them with Escape, select and submit with Enter, and confirm the first typed
  character still starts paused playback only once. With an empty search, press
  Space and confirm playback starts without changing the query; spaces within a
  typed anime title must continue to work normally.
- Confirm Submit answer is hidden for empty and unmatched text, then type an
  unmatched non-empty answer and press Enter. Confirm this uses the existing
  Give up path and shows a failed result. Select a valid database suggestion and
  confirm Submit answer appears and Enter still submits that selected answer.
- Confirm Correct, Not quite, Give up, and Continue behave unchanged; the search
  overlay disappears during the result phase and returns for the next card.
- Check desktop and narrow layouts for clipping, overlap with playback controls,
  internal scrolling, visible focus, and access to Submit answer and Give up.
- Turn Typed Answers off and confirm the existing side-panel manual review
  controls and player layout are unchanged.
