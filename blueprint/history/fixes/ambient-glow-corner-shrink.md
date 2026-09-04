# Ambient mode's glow shrank to a tiny corner box (regression)

## Type

Fix

## Status

verified

## The problem

Regression from the last merged fix (`4619058`, "stop Safari from exposing
horizontal overflow via arrow keys on Study"). That fix dropped
`.ambient-glow`'s explicit `width: 100vw; height: 100vh`, reasoning that
`inset: 0` alone would stretch a `position: fixed` box to the viewport.

That reasoning holds for a plain non-replaced element (a `<div>`), but
`.ambient-glow` is a `<canvas width="40" height="22">` - a **replaced**
element. Per the CSS spec, an absolutely/fixed-positioned replaced element
with `width`/`height: auto` resolves to its *intrinsic* size (the canvas's
40x22 attribute size), not the inset-defined box, when there's no explicit
CSS width/height forcing it to stretch. So the glow canvas now renders at a
tiny 40x22px box pinned to the top-left corner instead of covering the
background - "ambient mode is broken."

## The fix

Give `.ambient-glow` back an explicit `width`/`height` so the replaced
element actually stretches to the inset box, but use `100%` instead of the
original `100vw`/`100vh`. For a `position: fixed` element, `100%` resolves
against the same viewport-sized containing block `vw`/`vh` do, but without
`vw`'s scrollbar-inclusive quirk (the exact thing that caused the original
Safari overflow bug) - so this keeps both fixes at once: the glow fills the
screen again, and it does so with a unit that doesn't reintroduce the
Safari overflow.

```css
:global(.ambient-glow) {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  ...
}
```

Must not break: the `overflow-x: hidden` on `body` and the hotkey
`preventDefault()` calls from the same prior fix - both stay as they are,
they were not the cause of this regression.

## Build steps

- [x] Add `width: 100%; height: 100%;` back to `.ambient-glow` in
  `StudyMediaPlayer.vue`. Done when: Ambient mode's glow visibly covers the
  full viewport behind the player again (checked in a real browser), and
  the earlier Safari fix (no horizontal overflow/arrow-key page shift on
  `/study`) still holds. Confirmed working by the user in a real browser.

## Verify

- Turn Ambient mode on at `/study` and confirm the blurred glow fills the
  whole background again, not a small square in the corner.
- Re-check the previously-fixed Safari behavior isn't reintroduced: arrow
  keys on `/study` with Ambient on should still not shift the page
  horizontally (spot check is enough; the underlying `overflow-x: hidden`
  guard is untouched by this fix).
