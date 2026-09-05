# Current Feature

## Title
Reveal before grading on Study, not after

## Type
Fix

## Status
verified

## The problem
On `/study` with Hide Info on (the default), the order is backwards: pressing
Fail/Pass grades the card immediately **while the answer is still hidden**,
then reveals it, then shows a "Continue" button to advance
(`blueprint/history/fixes/study-hide-info-reveal-confirm.md`,
`blueprint/history/fixes/study-continue-and-default-hide-info.md`). You end up
grading blind and only comparing your guess to the real answer after the
grade is already locked in - the opposite of the normal Anki/Migaku flow
(see the answer, self-assess, then grade).

## The fix
Swap the order: show a **Reveal** button in place of Fail/Pass while the
card's info is still hidden. Clicking it (or pressing Enter) reveals the
current card only - same per-card mechanism `autoRevealedThisCard` already
uses, so Hide Info stays on for the *next* card - without grading or
recording anything. Once revealed (by this button, the `i` hotkey, clicking
the blurred info panel, or Auto Reveal's countdown - all of which already
flip the same underlying state), Fail/Pass render normally and grade **and
advance immediately** in one press, exactly like today's "Hide Info off"
case already does.

This removes the need for the staged "grade now, confirm advance later"
flow entirely - `pendingAdvance`, `confirmAdvance()`, and the `continue`
emit/button all become dead code once grading can no longer happen while
hidden, so they're removed rather than kept alongside the new Reveal button.

When Hide Info is off, nothing changes: Fail/Pass show directly and behave
exactly as they do today.

Only touches `/study` (`StudyAnswerControls.vue`, `pages/study/index.vue`) -
`CardPreviewModal` has no Pass/Fail controls, so nothing there changes.

## Build steps

- [x] **1. Replace the reveal-after-grade flow with reveal-before-grade.**
  - `StudyAnswerControls.vue`: rename the `pendingAdvance` prop to
    `awaitingReveal` and the `continue` emit to `reveal`; relabel the button
    from "Continue" to "Reveal" (same full-width grid slot, same styling
    convention, class renamed to `.reveal-btn`). While `awaitingReveal` is
    true, ArrowLeft/ArrowRight still no-op (nothing to grade yet) and Enter
    emits `reveal` instead of `continue`.
  - `study/index.vue`: delete `pendingAdvance`, `confirmAdvance()`, and the
    `needsReveal` branch inside `submitReview()` - `submitReview()` always
    calls `refreshStudySession()` after a successful grade now, matching the
    pre-existing "already visible" path. Add a `revealCurrentCard()`
    function that sets `autoRevealedThisCard.value = true`, calls
    `stopAutoRevealTimeout()`, and clears `autoRevealRemainingMs` (the exact
    three lines the old `needsReveal` branch used, minus the grading and
    `pendingAdvance` parts). Pass `:awaiting-reveal="hideInfo &&
    !autoRevealedThisCard"` (the same condition already driving
    `StudyInfoPanel`'s `:blurred`) to `StudyAnswerControls`, and handle
    `@reveal="revealCurrentCard"`.
  *Done when:* with Hide Info on and a fresh card, the answer area shows
  only a Reveal button (no Fail/Pass); clicking Reveal (or Enter) un-blurs
  the info panel with no grade recorded and no advance to the next card;
  Fail/Pass then appear and pressing either grades and immediately advances
  to the next card in one step, which loads hidden again. With Hide Info
  off, Fail/Pass show from the start and grade+advance in one press,
  unchanged from today. Auto Reveal's countdown still works: once it fires,
  the Reveal button is replaced by Fail/Pass on its own, with no manual
  click needed.

## Verify
On `/study` with Hide Info on: confirm a new card shows a Reveal button, not
Fail/Pass. Click Reveal - info un-blurs, no session-history entry is added
yet, still on the same card. Press Pass or Fail (arrow key or click) - card
grades and the next card loads immediately, hidden again. Turn Hide Info
off and confirm Fail/Pass show immediately with no Reveal step. Turn Auto
Reveal on (Info or Both mode), let the countdown finish, and confirm
Fail/Pass appear on their own without needing to click Reveal.
`bun run test` should stay green (35/35) since this is UI/interaction
behavior, not new logic - rides on browser verification per
`coding-standards.md`'s testing scope rule.

## Evidence

Driven end-to-end against the running dev server with a one-off Chrome
DevTools Protocol script (Playwright isn't installed; `bun run measure`
reloads per action and can't hold state across a multi-click sequence, same
approach used for `study-hide-info-reveal-confirm.md`):

- Fresh card, Hide Info on: Reveal button only, info blurred, no Fail/Pass.
- Click Reveal: same card stays put (no advance), info un-blurred, no
  session-history entry recorded, Fail/Pass now present.
- Click Pass: advances to a new card immediately, which loads hidden again
  (Reveal button back, blurred).
- Hide Info off: Fail/Pass show directly, no Reveal step - `.reveal-btn`
  confirmed absent from the DOM.
- Auto Reveal's countdown: not separately driven end-to-end, verified by
  construction instead - both it and `:awaiting-reveal` read the identical
  `hideInfo && !autoRevealedThisCard` expression already used for
  `StudyInfoPanel`'s `:blurred`, so Auto Reveal flipping
  `autoRevealedThisCard` necessarily flips both at once.

`bun run test` (35/35, no regressions) and `bun run build` both passed clean.
