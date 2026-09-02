# Current Feature

**Title:** OP/ED number (theme badge) not showing after Auto Reveal finishes

**Type:** Fix

**Status:** verified

## The problem

On `/study`, the OP/ED number badge (`card.themeSlot`, e.g. "OP1") shown in the
corner of `StudyMediaPlayer`'s frame stays hidden after Auto Reveal's countdown
finishes, when Auto Reveal's mode targets info (`"info"` or `"both"`).

In [study/index.vue:470](nuxt-app/app/pages/study/index.vue#L470), the badge's
visibility is wired straight to the raw `hideInfo` ref:

```
:hide-theme-badge="hideInfo"
```

Every other toggle Auto Reveal can force - `hide-video` (line 466), `hide-cover`
(line 473), and `StudyInfoPanel`'s `blurred` prop (line 490, and its immersive
counterpart) - instead uses the compound pattern `<condition> && !autoRevealedThisCard`,
so that once the countdown timer fires and flips `autoRevealedThisCard` to `true`,
the reveal actually takes effect regardless of `hideInfo`'s own value. The theme
badge was never given that `!autoRevealedThisCard` term, so:

1. Auto Reveal mode "Info" or "Both" starts a new card by forcing `hideInfo.value = true`
   (`study/index.vue`, the `presentationKey`/mode watcher).
2. The countdown timer fires and sets `autoRevealedThisCard.value = true`, which
   correctly un-blurs `StudyInfoPanel` (`hideInfo && !autoRevealedThisCard` -> `false`)
   and reveals video/cover.
3. `hideInfo.value` itself is never flipped back to `false` by the timer - only a
   manual reveal or a new card resets it - so `hideThemeBadge` (bound to bare
   `hideInfo`) stays `true` and the badge never reappears for the rest of that card.

## The fix

Change the binding at [study/index.vue:470](nuxt-app/app/pages/study/index.vue#L470)
from `:hide-theme-badge="hideInfo"` to `:hide-theme-badge="hideInfo && !autoRevealedThisCard"`,
matching the exact pattern already used for `blurred` on `StudyInfoPanel` two
lines below it (line 490). No other file needs to change - `StudyMediaPlayer.vue`'s
`hideThemeBadge` prop and template usage are already correct; only the value fed
into it from `study/index.vue` is wrong.

Must not break:

- Manual Hide Info toggle (Auto Reveal off) - `autoRevealedThisCard` is always
  `false` in that case, so the expression reduces to today's plain `hideInfo`,
  unchanged.
- Auto Reveal mode "Video" (targets visual only, not info) - `hideInfo` is never
  forced on by that mode, so the badge's visibility already tracks the user's own
  manual Hide Info state either way.
- A new card starting - `autoRevealedThisCard` resets to `false` and `hideInfo` is
  re-forced `true` when the mode targets info, so the badge correctly hides again
  at the start of the next card.

## Build steps

1. [x] Update the `hide-theme-badge` binding on `StudyMediaPlayer` in
   [study/index.vue](nuxt-app/app/pages/study/index.vue#L470) to
   `hideInfo && !autoRevealedThisCard`.
   **Done when:** with Auto Reveal mode set to "Info" or "Both", starting a card,
   letting the countdown finish (or manually revealing early), the OP/ED badge
   reappears at the same moment the info panel un-blurs - and reverts to hidden
   again on the next new card.

## Verify

1. On `/study`, open the Auto Reveal settings popup, set mode to "Info" (or
   "Both") with a short interval (e.g. 3s).
2. Start a card; confirm the theme badge (top-left "OP1"/"ED2"-style label on the
   player) is hidden while the info panel is blurred.
3. Let the countdown finish; confirm the badge appears at the same moment the info
   panel un-blurs.
4. Advance to the next card; confirm the badge hides again at the start of the new
   card.
5. Repeat with Auto Reveal off and Hide Info toggled manually - badge should hide/
   show exactly as it does today.
