# Fix: info panel flashes unblurred on the next card after Auto Reveal

**Type:** Fix
**Status:** verified

## The problem

On `/study`, with Hide Info + Auto Reveal on: once a card's info auto-reveals
(blur removed), advancing to the next card briefly shows that next card's real
song/artist/anime text before it blurs - a visible flash, not an instant blur.

**Root cause:** `StudyInfoPanel.vue`'s `.info-card` has
`transition: filter 0.4s ease` (`nuxt-app/app/components/study/StudyInfoPanel.vue:180`),
so a blur-state change animates smoothly - intentional for a same-card toggle
(clicking Hide Info, or Auto Reveal itself finishing its countdown). But
`StudyInfoPanel` is deliberately **not** remounted per card (unlike
`StudyMediaPlayer`, which is keyed by `presentationKey`) - it keeps its own
local language-display toggles (`showEn`/`showRomaji`/`showJapanese`/
`showFurigana`) alive across the whole session, not just one card. Because the
same DOM element persists, when a new card arrives already blurred (`blurred`
prop flips `false -> true` in the same tick `presentationKey` changes), the
browser still animates that filter change from the previous card's unblurred
state - the flash is that 0.4s transition playing out on the new card's text.

## The fix

Suppress the CSS transition for exactly the moment the card itself changes,
while keeping it for genuine same-card toggles (manual Hide Info click, and
Auto Reveal's own countdown finishing).

- Add a `presentationKey: number` prop to `StudyInfoPanel.vue`.
- Watch it; on change, add a `skip-blur-transition` class (new CSS rule:
  `transition: none`) for one double-`requestAnimationFrame` window, then
  remove it - long enough for the browser to paint the new blur state with no
  animation, short enough that a toggle a moment later still transitions
  normally.
- Pass `:presentation-key="presentationKey"` at both call sites in
  `app/pages/study/index.vue` (the immersive overlay instance and the
  non-immersive side-panel instance - both currently lack this and share the
  same bug).

**Must not break:** the existing smooth fade when Hide Info is toggled
mid-card, or when Auto Reveal's countdown finishes and un-blurs the *current*
card - both should keep animating exactly as they do today. Must not remount
`StudyInfoPanel` (that would reset its own language-toggle state every card,
a real regression, not a fix).

## Build steps

- [x] **Step 1 - Suppress the blur transition on card change** - add the
  `presentationKey` prop, the `skip-blur-transition` watch/class mechanism,
  and the new CSS rule to `StudyInfoPanel.vue`; wire `:presentation-key` at
  both call sites in `study/index.vue`. *Done when:* with Hide Info + Auto
  Reveal on, letting a card auto-reveal then advancing to the next card shows
  the next card's info already blurred with no flash of readable text;
  manually toggling Hide Info mid-card still fades smoothly; Auto Reveal's
  own countdown finishing on the current card still fades smoothly; language
  toggle selections (EN/Romaji/Japanese/Furigana) still persist across cards.

## Verify

Manual, on `/study` (no test runner configured for this project):

1. Turn on Hide Info and Auto Reveal (with a short auto-reveal seconds value
   for a fast test). Play a card, let it auto-reveal.
2. Pass or fail to advance to the next card - confirm the new card's info is
   blurred from the very first frame, no flash of readable text.
3. Toggle Hide Info manually (off/on) mid-card - confirm the blur still fades
   in/out smoothly (not an instant cut).
4. Let Auto Reveal's countdown finish naturally on a card - confirm that
   reveal still fades smoothly (not an instant cut).
5. Set EN/Romaji off, Japanese+Furigana on (or any non-default combination),
   advance a couple of cards - confirm the language display choice persists
   (not reset to defaults).
6. Repeat steps 1-2 in immersive mode (`E` hotkey) - same fix applies to that
   `StudyInfoPanel` instance too.
