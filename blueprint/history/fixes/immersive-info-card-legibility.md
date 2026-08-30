# Fix: Immersive info card overlay hard to read over busy video

**Type:** Fix
**Status:** verified

## The problem

Feature 31's immersive info card overlay (titles, artist, song) relied
entirely on `text-shadow` for contrast against the video underneath, with
no background at all. Against a busy, high-contrast frame (e.g. a
diagonal-striped credits sequence) that wasn't enough - the text was hard
to read. The same problem was fixed for the Pass/Fail overlay in the
previous fix (`immersive-info-overlay-squish.md`, Step 3) by giving it a
frosted scrim background; the info card still needed the same treatment
(the user's report initially named Pass/Fail, but Pass/Fail was already
fine - the info card was the actual problem).

## The fix

`StudyInfoPanel.vue`'s `.info-card.overlay` now has a real background
again instead of `none`: the same scrim used for `.answer-slot`
(`rgba(10, 6, 14, 0.75)`, `border: 1px solid var(--glass-border)`,
`backdrop-filter: var(--glass-blur)`), reusing the base `.info-card`'s
existing `padding`/`border-radius` (untouched by the `.overlay` modifier).
Also removed the `.info-card.overlay .meta-row { border-top: none; }`
override added when the card had no background at all - now that it has
one again, the artist row's divider looks normal instead of needing to be
suppressed. The existing `text-shadow` rule on the title/song text is left
in place (harmless now, was doing real work before).

## Build steps

- [x] **Step 1 - Frost the info card overlay's background** -
  `nuxt-app/app/components/study/StudyInfoPanel.vue`: `.info-card.overlay`
  background changed from `none` to the shared scrim; removed the now-
  unneeded `.meta-row` border override. *Done when:* `bun run build`
  passes.

- [x] **Step 2 - Per-button frosted backgrounds instead of one bar** - the
  user's follow-up: Pass/Fail's own scrim (from the previous fix) wrapped
  *both* buttons in one undifferentiated rectangle, which read as a weird
  slab rather than two buttons, and wasn't styled consistently with the
  info card's per-element treatment. `study/index.vue`'s `.answer-slot`
  dropped its own background/border/backdrop-filter/padding (back to a
  plain positioning wrapper); a new `.answer-slot :deep(.answer-btn)` rule
  gives each button its own frosted background
  (`rgba(10, 6, 14, 0.75)` + `var(--glass-blur)`), reaching into
  `StudyAnswerControls.vue`'s own scoped `.answer-btn` via `:deep()`
  without needing to touch that component. Its existing pass/fail-tinted
  `border-color` was left alone so the two buttons stay visually distinct
  at a glance. *Done when:* `bun run build` passes.

- [x] **Step 3 - Match the info card to Pass/Fail's per-element treatment**
  - the user asked to "copy the style of Pass/Fail onto the information,"
  i.e. apply the same per-element granularity Step 2 just gave Pass/Fail
  (two separate frosted buttons, not one bar) to the info card too, rather
  than one frosted card wrapping everything. `.info-card.overlay` reverted
  to no background of its own; `.title-block`, `.song-block`, and
  `.meta-row` (the artist row) each become their own frosted chip
  (`rgba(10, 6, 14, 0.75)` + `var(--glass-border)` + `var(--glass-blur)`,
  `padding: 12px 16px`), matching Pass/Fail's per-element look exactly.
  `.lang-toggles` is untouched - its pill buttons already had their own
  independent background. *Done when:* `bun run build` passes.

- [x] **Step 4 - Match Pass/Fail's background exactly** - the user asked
  for the chips to look glassy "like Fail and Pass," then clarified
  directly: replicate Pass/Fail's actual blur/background, not a
  lighter alternative (an intermediate lighter-purple experiment was
  tried in response to the first phrasing and corrected before it was
  ever committed). The chips' background is `rgba(10, 6, 14, 0.75)` -
  numerically identical to `.answer-btn`'s own background - so the two
  overlay regions now share the exact same color and blur. *Done when:*
  `bun run build` passes.

- [x] **Step 5 - Fix `.answer-btn`'s override not actually winning** - the
  user's next screenshot showed Pass/Fail rendering noticeably *lighter*
  than the info chips, despite Step 4 supposedly making them identical -
  `.answer-slot :deep(.answer-btn)`'s background/backdrop-filter weren't
  reliably beating `StudyAnswerControls.vue`'s own scoped `.answer-btn`
  rule (`background: var(--surface)`), likely a specificity tie resolved
  by source order rather than intent. Added `!important` to both
  properties on the `:deep()` override so it unconditionally wins,
  regardless of how the two components' scoped stylesheets happen to
  order in the final bundle. *Done when:* `bun run build` passes; the
  override's declarations carry `!important` so there's no ambiguity left
  about which rule applies.

- [x] **Step 6 - Wrong direction: Step 5 should have gone the other way**
  - Step 5's assumption was backwards. The user liked how Pass/Fail
  rendered *before* Step 5 (transparent, blur-only "glass," no color tint
  - the specificity bug in Step 5 wasn't a bug from the user's point of
  view, it was accidentally the preferred look) and wanted the info chips
  to match *that*, not for Pass/Fail to become a dark scrim like the
  chips. Reverted the tint: both `.answer-slot :deep(.answer-btn)` and
  the info chips now use `background: transparent` (still `!important` on
  the button override, since that part of Step 5's diagnosis - the
  specificity fight - was correct, only the target color was wrong) with
  just `backdrop-filter: var(--glass-blur)` for the frosted effect and
  `border: 1px solid var(--glass-border)` to keep each region legible as
  a distinct shape. `text-shadow` on the title/song/artist text (from
  Step 1) matters again now that there's no background tint to lean on.
  *Done when:* `bun run build` passes.

- [x] **Step 7 - Root cause: an ancestor's `filter` breaks
  `backdrop-filter` on descendants** - the user's next screenshot made the
  real bug visible for the first time: Pass/Fail's blur was clearly
  softening the video behind it, while the info chips sat over perfectly
  *sharp*, unblurred video - `backdrop-filter` wasn't doing anything
  there at all, no matter what background color was tried in Steps 4-6.
  Root cause: `.info-card`'s base rule (unrelated to any of this - it's
  there for the *non-immersive* Hide Info blur toggle) sets
  `filter: blur(0)`. Per the CSS spec, `filter` on an ancestor - even a
  visual no-op like `blur(0)` - makes that ancestor a new sampling root
  for any `backdrop-filter` on its descendants, so the chips were
  blurring an empty intermediate layer instead of the real video behind
  everything. `.info-card.overlay` now resets `filter: none` - safe,
  since immersive mode never uses the blur-transition mechanism that
  property exists for (it hides the info block outright via `v-if`
  instead, per Step 2 of the original feature). *Done when:* build
  passes.

- [x] **Step 8 - Lighter blur so the video shows through more** - once the
  blur was actually working (Step 7), the user asked for less of it, to
  let more video show through. Both the info chips and Pass/Fail switched
  from the shared `--glass-blur` token (`blur(20px) saturate(1.6)` - used
  app-wide: nav bar, search dropdown, etc., left untouched there) to a
  local `blur(10px) saturate(1.3)`, defined identically in both places so
  they stay visually matched. *Done when:* build passes.

- [x] **Step 9 - Drop the text-shadow** - now that the backdrop-blur is
  actually working (Step 7) and giving real contrast, the text-shadow
  added back in the original feature (as a stopgap before any blur was
  functioning) started looking redundant/muddy on top of it. Removed
  `.info-card.overlay :is(.en, .romaji, .jp, .song-title, .label, .name)`'s
  `text-shadow` rule entirely, per the user's direct request. *Done when:*
  build passes.

- [x] **Step 10 - A light dark tint on top of the blur** - with the blur
  amount confirmed good (Step 8), the user asked for both regions to be
  "a little darker" for legibility - not back to Step 4-5's near-opaque
  scrim, just a light assist on top of the now-working blur. Both switch
  from `background: transparent` to `rgba(10, 6, 14, 0.3)` (30% opacity,
  same color family as every earlier scrim attempt on this file, just far
  lighter), defined identically in both places. *Done when:* build
  passes.

- [x] **Step 11 - Revert Step 10's tint, restore Step 9's text-shadow, add
  it to Pass/Fail too** - the user took back the "darker" request:
  reverted both regions' background to `transparent` (undoing Step 10).
  Also asked for the text-shadow back (undoing Step 9's removal) *and*
  extended to Pass/Fail, which never had it. `.info-card.overlay`'s
  `:is(.en, .romaji, .jp, .song-title, .label, .name)` text-shadow rule
  is restored verbatim; `.answer-slot :deep(.answer-btn)` gains the same
  `text-shadow` values (inherits naturally to its `.key` hint span, no
  competing rule to fight so no `!important` needed there unlike
  background/backdrop-filter). *Done when:* build passes.

## Verify

No test runner configured; pure CSS. `bun run build` passes, `/study` and
`/cards` return 200 against a scratch dev server. Not independently
re-verified in a browser by the agent (no browser tool available) - eleven
rounds of user-reported visual feedback total, including one full
reversal of direction on the blur/color question (Steps 5-6) and one on
the shadow/tint question (Step 9 vs. 11), plus the root-cause fix in Step
7. Worth an actual look on `/study` before treating this as settled.
