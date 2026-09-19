# Fix: Answer controls belong with the anime box, not in the chrome

**Type:** Fix
**Status:** verified

> Built directly in chat before this spec was written, which is the
> prompt-directly path `ai-interaction.md` allows alongside the skills. The
> spec is written after the fact so the change still gets reviewed, logged and
> archived like any other. Its build step records the evidence that was
> actually captured, so the next step is `/complete`, not `/implement`.

## The problem

Feature 66's two bonus answer categories ended up scattered across the study
screen's chrome instead of sitting with the question they belong to:

- **Opening/Ending number** (66a) rendered in `header-right`, in the same
  row as Hide Video / Ambient / Audio only - a row of *display settings*.
- **Song name** (66b) rendered at the top of the `.side` column, above the
  info panel.

Both read as app settings rather than as answer fields, and neither was
anywhere near the anime title box floating over the video. A player answering
a round had to look in three places. 66a's own archive records the
Opening/Ending picker being pushed to the header only because two attempts at
overlaying it inside the player frame collided with the existing overlay
content; that was a workaround, not a placement decision.

## The fix

One `.answer-stack` container inside the player's `#overlay` slot holds all
three controls, centred over the video above the playback bar:

- The anime title box keeps the full-width row and its existing size, because
  it is the only answer that grades the card. Visual priority is explicit.
- The Song name box and the Opening/Ending picker share a smaller, quieter
  row beneath it.

Must not break:

- Grading. All three controls keep their existing props, events and per-card
  `:key` resets, so `gradeBonusCategories` and `saveTypedAnswer` are untouched.
- The anime box's Enter/Submit/Give-up path, its suggestion list anchoring,
  and its autofocus.
- The category-off default: with both bonus categories off, the stack contains
  only the anime box and renders as it did before feature 66.

## Build steps

- [x] **Step 1 - Move the controls into one overlay stack.** Add the
  `.answer-stack` wrapper in `study/index.vue`'s overlay slot containing
  `StudyTypedAnswer` plus a `.bonus-answers` row with `StudySongAnswer` and
  `StudyThemeSlotAnswer`; remove both from `header-right` and `.side`. Move
  the absolute placement off `StudyTypedAnswer`'s `.overlay` class onto the
  stack, leaving that class `position: relative` so its suggestion list still
  anchors to it. Restyle `StudySongAnswer` as a compact glass strip whose
  dropdown opens upward, and give `StudyThemeSlotAnswer` the same glass
  surface. Collapse the six-term disabled expression, then repeated three
  times, into one `answerControlsDisabled` computed.
  *Done when:* all three controls render inside the player frame with the
  anime box visually dominant; nothing is left in `header-right` or `.side`;
  a full round still grades both bonus categories; the song dropdown stays
  inside the frame; `bun run test` and `bun run build` pass.

## Verify

Evidence captured at 1600x950 with both categories on:

| Check | Result |
|---|---|
| Layout | Anime box full width on top, Song name + OP/ED in a smaller row beneath, all inside the player frame (screenshot) |
| Nothing left behind | `.header-right .theme-slot-answer` = 0, `.side .song-answer` = 0, `.answer-stack` children = 3 |
| Grading still works | Anime "Not quite", `✕ Song name TORCH → DuDiDuWa∗lalala +0`, `✓ Opening/Ending ED1 +50`, total 50 |
| Song dropdown | Opens upward, top 579 / bottom 630 inside a frame of 241-769 |
| Automated | `bun run test` 558 passing, `bun run build` clean |

## Known limitation, deliberately not fixed here

Below the 600px breakpoint the 16:9 frame is about 133px tall and cannot fit
three controls. Measured on this branch by hiding the bonus row to reproduce
the pre-fix layout exactly: the anime box was **already clipped by 8px before
this change**. Stacking made that 106px, so the stack is top-anchored under
600px instead of bottom-anchored. At 390px the anime input is now fully
visible inside the frame (322-386 within 315-448), better than before, and the
optional bonus row is what overflows.

Fixing narrow widths properly means moving the stack out of `.player-frame`'s
`overflow: hidden` - most likely rendering it as a sibling inside
`.player-pane`, which is already `position: relative` and is where
`.grade-flash` sits. That is a structural change with its own verification and
belongs in its own fix, not here.
