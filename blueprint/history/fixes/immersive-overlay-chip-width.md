# Fix: Immersive overlay chips stretch to full width instead of hugging their text

**Type:** Fix
**Status:** verified

## The problem

In the immersive overlay (`StudyInfoPanel.vue`'s `.overlay` styles, used by
both `/study`'s immersive mode and Preview's, feature 31/36), the title,
song, and artist blocks each get their own frosted `backdrop-filter` chip
background. But `.info-card` is `display: flex; flex-direction: column;`
with no `align-items` set - which defaults to `stretch` - so every child
(`.title-block`, `.song-block`, `.meta-row`) stretches to the container's
full width (up to `.info-slot`'s `max-width: 55%` of the video frame),
regardless of how short its actual text is. A one-word song title like
"starlog" or a short artist name like "ChouCho" ends up inside a wide chip
with a lot of empty blurred space to its right, blurring more of the video
than the text needs.

## The fix

Add `align-items: flex-start` to the existing `.info-card.overlay` rule in
`StudyInfoPanel.vue`. This is scoped to the immersive overlay only (the
`.overlay` class); the non-immersive side panel (a normal fixed-width
sidebar, where full-width blocks are the intended list-like layout) is
untouched.

With `align-items: flex-start`, each direct child of `.info-card` (the
language-toggle row, `.title-block`, `.song-block`, `.meta-row`) becomes
shrink-to-fit width instead of stretching - CSS `fit-content` sizing, which
is bounded by the available container width, not unlimited, so a long title
still wraps and uses the space it needs exactly as it does today; it just
no longer forces short chips to match its width. No change needed inside
`.title-block` itself - its own children (EN/Romaji/JP lines) keep the
default `stretch` so they still share one common chip width, which is the
correct look (one title chip, not three staggered ones).

**Must not break:**

- The non-immersive side panel (`.info-card` without `.overlay`) - untouched,
  no `align-items` change there.
- The proportional cqw-based scaling from the earlier immersive-overlay fix
  (padding, gap, font-size clamps) - unrelated property, no interaction.
- Text wrapping for a long anime title - `fit-content` sizing still wraps
  within the available width; only short text shrinks its chip now.

## Build steps

- [x] **Step 1 - `align-items: flex-start` on `.info-card.overlay`** - one
  property added to the existing rule in `StudyInfoPanel.vue`. *Done when:*
  in immersive mode (`/study` or Preview), a card with a short song title
  and/or artist name shows those chips sized to hug the text rather than
  stretching to the title block's width; the title block (and any other
  genuinely wide content) still looks correct and still wraps as it does
  today; the non-immersive side panel is visually unchanged.

## Verify

- `/study`, press `E` for immersive, on a card with a short song title/
  artist name - the SONG and ARTIST chips should now be no wider than their
  text (plus padding), not stretched to match the title chip's width.
- Same check in Preview (`/cards` -> Preview -> `E`).
- A card with a long anime title - confirm it still wraps and displays
  correctly, not compressed or broken by the alignment change.
- The non-immersive side panel (`/study` without immersive, or Preview
  without immersive) - should look exactly as it did before this fix.
- No test runner is configured and this is pure CSS, not logic - ride on
  the browser checks above plus `bun run build`.
