# Fix: Auto Reveal timer lingers after an early manual reveal, and a mid-card settings change re-hides an already-revealed card

**Type:** Fix
**Status:** verified

## The problem

Both bugs are in `study/index.vue`'s Auto Reveal logic (feature 46, still
on `feature/auto-reveal-modes`, not yet merged), and both come from the
timer/reset watch not knowing about a reveal that already happened outside
its own `setTimeout` firing.

1. **Manually revealing early doesn't stop the timer.** If the user
   manually turns off a currently-targeted Hide toggle (e.g. clicks Hide
   Info, or presses `I`) while Auto Reveal's countdown is still running
   for it, nothing stops the timer or dismisses the countdown indicator.
   `StudyAutoRevealCountdown`'s `v-if` only checks `autoRevealMode !==
   'off' && hasStartedPlaybackThisCard && !autoRevealedThisCard` - none of
   which change from a manual toggle - so the ticking countdown UI (and
   the still-armed `setTimeout`) both linger uselessly toward revealing
   something that's already visible.
2. **Changing the mode/seconds mid-card re-hides an already-revealed
   card.** The `watch([presentationKey, autoRevealMode, autoRevealSeconds],
   ...)` block unconditionally resets `autoRevealedThisCard.value = false`
   and re-arms a fresh countdown on *any* change to mode or seconds, even
   when the current card already revealed (naturally, or via bug 1's early
   reveal). Opening the settings modal and nudging the seconds value, or
   switching modes, after the answer is already showing incorrectly
   re-hides it and restarts a countdown on the same card, instead of just
   applying the new setting starting from the next card.

## The fix

1. Add a small watcher on each of `hideVideo`, `hideCover`, and `hideInfo`
   that finalizes the reveal the moment a **still-targeted** toggle
   transitions to *not hidden* while the card **hasn't already
   auto-revealed**: sets `autoRevealedThisCard.value = true` and stops the
   pending timeout. Checking "still targeted" (`autoRevealTargetsVisual`/
   `autoRevealTargetsInfo` at the moment of the transition) is what keeps
   this from misfiring when the *mode-change* watcher itself sets a
   no-longer-targeted toggle to `false` (e.g. switching Video -> Info) -
   by the time that assignment lands, the target computeds already reflect
   the new mode, so `isTargeted` is correctly `false` there and this new
   watcher no-ops.
2. In the mode/seconds reset watch, short-circuit immediately when the
   change isn't a new card (`!isNewCard`) and `autoRevealedThisCard.value`
   is already `true` - skip the reset/rearm entirely so the setting change
   takes effect starting the next card, never on the current
   already-revealed one.

Must not break:

- The timer's normal natural-completion path (its own `setTimeout`
  callback setting `autoRevealedThisCard.value = true`) - unaffected,
  since that path never touches the `hideVideo`/`hideCover`/`hideInfo`
  refs directly.
- Switching mode while a countdown is still running and nothing has been
  manually revealed yet - still resets and re-arms immediately, exactly
  as feature 46 shipped.
- A new card presentation - still always resets and re-forces the active
  mode's targets on, regardless of the previous card's reveal state.
- Pausing/resuming playback - untouched, no overlap with this logic.

## Build steps

- [x] **Step 1 - stop the timer on an early manual reveal** - add the three
  `watch(hideVideo/hideCover/hideInfo, ...)` calls described above.
  *Done when:* with Auto Reveal targeting Info (or Both) and the countdown
  visibly running, manually turning Hide Info off (button or `I`)
  immediately dismisses the countdown indicator and the timer never fires
  afterward; the same holds for Hide Video/Hide Cover when Auto Reveal
  targets Video; switching mode away from a target (e.g. Video -> Info)
  still behaves exactly as before (no spurious early-reveal finalize).
- [x] **Step 2 - don't re-hide an already-revealed card on a mid-card
  settings change** - add the `!isNewCard && autoRevealedThisCard.value`
  early return to the mode/seconds watch. *Done when:* after a card's
  answer has already revealed (naturally, via the timer, or via Step 1's
  early reveal), opening the Auto Reveal settings modal and changing mode
  or seconds does not re-hide anything or restart a countdown on that
  card; the new setting applies starting cleanly on the next card.

## Verify

- Set Auto Reveal to Info (short countdown), start playback, and manually
  turn Hide Info off before the countdown finishes - confirm the countdown
  disappears immediately and never fires afterward.
- Repeat with Video mode on a video-capable card (Hide Video) and an
  audio-only card (Hide Cover).
- Let a card's countdown finish naturally, then open the settings modal
  and change the seconds value or switch mode - confirm the current card
  stays revealed (nothing re-hides) and the change only takes effect on
  the next card.
- Switch mode mid-countdown *before* anything is manually revealed (e.g.
  Video -> Both) and confirm it still resets/re-arms immediately, matching
  feature 46's existing behavior.
- Run `bun run build` as the final check (no `Verify` command is
  configured in `AGENTS.md` yet).
