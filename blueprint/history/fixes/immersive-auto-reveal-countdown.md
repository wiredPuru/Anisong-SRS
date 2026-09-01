# Current Feature

## Title

Auto-reveal countdown missing in immersive study mode

## Type

Fix

## Status

Verified

## The problem

On `/study`, the Auto Reveal countdown (`StudyAutoRevealCountdown`) never
appears while immersive mode (`E`) is active, even when Auto Reveal is set to
"Info" or "Both" and a card's info is currently hidden.

Root cause, in [`StudyInfoPanel.vue`](../../nuxt-app/app/components/study/StudyInfoPanel.vue#L127):

```html
<div v-if="!(immersive && blurred)" class="info-card" ...>
```

While immersive and blurred, the whole `.info-card` is removed from the DOM
(`v-if`), not just visually hidden. In
[`study/index.vue`](../../nuxt-app/app/pages/study/index.vue#L474-L482), the
immersive slot renders `StudyAutoRevealCountdown` and `StudyInfoPanel` as
siblings inside `.info-slot`:

```html
<div class="info-slot" ...>
  <StudyAutoRevealCountdown v-if="..." ... :immersive="true" />
  <StudyInfoPanel :blurred="hideInfo && !autoRevealedThisCard" ... />
</div>
```

`StudyAutoRevealCountdown` centers itself (`position: absolute; top/left:
50%`) on its nearest positioned ancestor, which is `.info-slot`
(`position: absolute` itself, sized by shrink-to-fit around its in-flow
content). With `StudyInfoPanel`'s root gone from the DOM, `.info-slot` has no
in-flow content left, so it collapses to a 0x0 box. `.info-slot`'s own
`overflow-x: hidden` then clips the countdown pill entirely, since an
absolutely-positioned descendant is clipped against a 0-size ancestor
regardless of its own transform offset.

Non-immersive mode doesn't hit this: there, `StudyInfoPanel`'s `v-if` always
evaluates true (`immersive` is false), so the card stays mounted and blurs via
a CSS filter instead of unmounting - `.info-panel-wrap` never collapses.

## The fix

Stop removing `.info-card` from the DOM in immersive mode; hide it with
`visibility: hidden` instead, keeping its layout box (and therefore
`.info-slot`'s size) intact. This also better matches feature 31's own
documented intent for immersive info-hiding ("a plain visibility toggle", not
a blur) - `v-if` removal was already a mismatch from that intent, independent
of this bug.

In `StudyInfoPanel.vue`:

- Drop the `v-if="!(immersive && blurred)"` guard on the root `.info-card`
  div so it always renders.
- Add `'info-hidden': immersive && blurred` to its existing `:class` binding.
- Add a scoped `.info-card.info-hidden { visibility: hidden; }` rule.

No changes needed to `study/index.vue` or `StudyAutoRevealCountdown.vue` -
the countdown's existing "center on positioned ancestor" behavior is correct
once that ancestor stops collapsing.

Must not break: non-immersive Hide Info blur behavior (unaffected - its own
`v-if` condition was already always-true there), the immersive video/cover
auto-reveal path (mode "video", untouched by this component), or the
Learning-streak popover inside the info card (still un-interactable while
`visibility: hidden`, matching today's intent).

## Build steps

1. [x] Edit `StudyInfoPanel.vue`: replace the `v-if` removal with an
   `info-hidden` class + `visibility: hidden` CSS rule as described above.
   **Done when:** with Auto Reveal set to "Info" or "Both" and immersive mode
   on, the countdown pill is visible (centered over the info card's usual
   spot) for the full duration until it reveals, on both a fresh card and a
   repeat card after a fail; non-immersive Auto Reveal and immersive Auto
   Reveal "Video" mode still behave exactly as before.

## Verify

Manual, in the browser (`/study`, immersive mode `E`):

1. Settings popup (gear icon on the Auto Reveal toggle) → set mode to "Info"
   (or "Both"), a few seconds.
2. Start a card, press `E` to enter immersive mode.
3. Confirm the "Revealing in N" pill is visible, centered near where the info
   card sits, counting down - and that the info itself appears once it hits
   zero.
4. Repeat with mode "Both" and mode "Video" (video/cover case should already
   have worked - confirm no regression).
5. Exit immersive mode and confirm the non-immersive countdown still shows
   next to the side info panel as before.
