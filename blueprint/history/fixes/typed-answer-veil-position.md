# Fix: Kai sits at the top of the player during typed answers

**Type:** Fix
**Status:** verified
**Branch:** `fix/typed-answer-veil-position`

## The problem

With Typed Answers on, the player's veil (Kai plus "Ready?", "Paused",
"Guess?", or an error) is pinned to the very top of the frame, leaving a large
empty gap between Kai and the answer box (see the user's screenshot of a large
player).

The cause is 84d's `.veil.raised` rule in `StudyMediaPlayer.vue`:
`justify-content: flex-start` plus a small top padding. It assumed the answer
boxes cover the frame's lower half. In fact `.answer-stack`
(`pages/study/index.vue`) is anchored `bottom: 88px` and is only as tall as
its rows. That's one row for the anime box, and more when Song, Artist, or
OP/ED are also asked. On a big frame it covers a thin strip, so pinning to the
top overcorrects.

## The fix

Center the veil's content in the space above the answer boxes, not at the top
of the frame:

- `pages/study/index.vue` measures how far the answer stack's top edge sits
  above the frame's bottom, using the existing `answerStackRef` and a
  `ResizeObserver` on the stack and the frame. It passes that value to
  `StudyMediaPlayer` as a new optional `guessingInset` prop (px).
- `StudyMediaPlayer` binds it as a CSS variable on the veil
  (`:style="{ '--guess-inset': ... }"`, the same pattern `/cards` and
  `/decks` use for `--inspector-width`).
- `.veil.raised` becomes `justify-content: center` with
  `padding-bottom: calc(var(--guess-inset) + <small gap>)`. Before the first
  measurement lands, it falls back to today's top-aligned layout.

Must not break:
- The veil content must never overlap the answer boxes. This includes 3-4
  answer rows and a short frame, where the gap may be small and Kai scales
  down with `cqw` as before.
- The error veil's retry and download buttons must stay above the answer box.
- Preview (no typed answers, no `guessing`) must look unchanged.
- Non-typed Study must look unchanged.

## Build steps

- [x] **Step 1 - Measure the answer stack and center the raised veil** - make
  the page measurement, the prop, the CSS variable, and the `.veil.raised`
  rule change. *Done when:* `bun run measure` on `/study` with Typed Answers
  on shows the veil content's vertical center roughly midway between the
  frame top and the answer stack top, and no overlap with `.answer-stack`, at
  both `1920x1100` and `1280x720`, with the anime box only and with the OP/ED
  category on. Screenshots confirm. Build and tests pass.

## Verify

1. On `/study`, turn on Typed Answers. Before playing, "Ready?" Kai sits
   centered in the open space above the answer box, not stuck to the top.
2. Play, then pause. "Paused" Kai sits in the same place.
3. Turn on the OP/ED or Song categories so the answer stack grows. Kai moves
   up to stay clear of it.
4. Turn Typed Answers off. The veil is centered in the whole frame as before.

## Additions made while building

- **Kai is capped to the open space.** With three answer rows on a small frame
  the space above the stack was exactly Kai's height (2px overlap measured), so
  `.veil.raised.measured` sets `--kai-max-height` from the frame's 16:9 height
  (`56.25cqw`, since `.player-frame` is an inline-size container) and
  `StudyPlayerKai`'s `.kai` honours it.
- **Tiny-frame fallback.** Below 48px of open space (at 1000x640 the stack is
  taller than the 190px frame and overflows its top) the page passes no inset,
  so the veil keeps its previous top-aligned layout. The stack overflowing a
  very short frame predates this fix and is not addressed here.

## Completion evidence

- `bun run test`: 83 files, 1321 tests passing. `bun run build`: passing.
- Geometry on the dev server (px from the frame top; Kai centre vs ideal
  centre of the open space, and gap to the answer stack):
  - 1920x1100, anime only: 261 vs 260, gap 153.
  - 1920x1100, + song + OP/ED: 235 vs 234, gap 126.
  - 1280x720, anime only: 81 vs 80, gap 27.
  - 1280x720, + song + OP/ED: 55 vs 54, gap 8 (Kai capped to 89px).
  - 1000x640, + song + OP/ED: fallback to top layout (`measured` off).
  - Typed Answers off: no `raised` class or style; Kai centred at the frame
    midpoint (354 of 708).
- Screenshots at 1920x1100 (anime only) and 1280x720 (three rows) confirm.
