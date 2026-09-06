# Current Feature

**Title:** Rail nav loses stickiness on short viewports, plus themed scrollbars

**Type:** Fix

**Status:** verified

## The problem

Two related issues with the persistent left rail (`NavBar.vue`) and scrolling in general.

**1. The rail can scroll out of view.** `.app-nav` is already `position: sticky; top:
0; height: 100vh`, which is correct in principle, but the rail has no `overflow`
handling of its own: the logo plus all 6 nav links are laid out in plain flow
inside that fixed-height box. Measured with `bun run measure`, that content is
about 480px tall. Whenever the browser's usable viewport height is shorter than
that (a smaller/non-maximized window, a laptop with a lot of browser chrome,
or the page zoomed in), the rail's own content overflows past its box. Because
nothing clips it, that overflow quietly extends the whole document's scrollable
height too - and it only extends it by the small overflow amount, not by a full
extra viewport. That leaves the sticky rail almost no "runway": scrolling down
by just that little bit is enough to hit the bottom of its containing block, at
which point it releases and scrolls normally - its top (the logo, Home) slides
up and off-screen. Confirmed directly: at a 440px-tall viewport, scrolling the
page down just 22px already pushes the rail's top to `-22px`, and further
scrolling doesn't move it again because it has already fully released. This is
exactly the reported "if I scroll past it, the navigation goes away" - it isn't
that sticky is missing, it's that the rail's own unbounded content undermines
the small amount of stickiness it has.

Every other page-level scroll area already checked (`/cards`, `/decks`,
`/stats`, `/study`, `/settings`, `/` at normal desktop widths) stays properly
bounded inside its own internal pane (`overflow-y: auto` on `.list-pane`,
`.inspector`, `.settings-body`, etc.), so the document itself doesn't scroll
there and the rail is unaffected. The rail's own content is the one place
nothing bounds the overflow.

**2. Scrollable areas use the default OS scrollbar.** `.list-pane`, `.inspector`,
`.settings-body`, the search dropdown, and other `overflow-y: auto` regions all
render whatever scrollbar the OS/browser provides, which clashes with the
Akiba Neon theme (feature 50).

## The fix

**Rail:** give the nav links their own bounded, independently-scrolling region
instead of letting them flow unbounded inside `.app-nav`. `.app-nav` keeps its
existing `height: 100vh; position: sticky; top: 0` unchanged - that part is
already correct. `.nav-logo` stays a fixed-size flex item; `.nav-links` becomes
`flex: 1; min-height: 0; overflow-y: auto`, so if its content is ever taller
than the rail (a short viewport, or more links added later), it scrolls inside
itself instead of pushing the outer page - and the rail's `top: 0` position
never has a reason to move. Must not change the rail's current look at normal
viewport heights (today's common case, where nothing scrolls and no scrollbar
shows), and must not break the icon-only collapse below 820px width.

**Scrollbars:** add one global themed scrollbar rule to `main.css` (`scrollbar-
width`/`scrollbar-color` for Firefox, `::-webkit-scrollbar*` for Chrome/Safari/
Edge) - a slim, dark track with a subtle thumb that picks up the accent color
on hover, so it applies everywhere automatically (rail included, if it ever
scrolls) rather than needing a rule per component.

## Build steps

- [x] **Step 1 - bound the rail's nav links to their own scroll region** -
  in `NavBar.vue`, change `.nav-links` to `flex: 1; min-height: 0; overflow-y:
  auto;` (keeping its existing `display: flex; flex-direction: column; align-
  items: center; gap: 6px`), and give `.nav-logo` an explicit `flex: none` so it
  never shrinks to make room.
  **Done when:** at a constrained viewport height (verified via `bun run
  measure` at a short `--size`, e.g. `1440x440`), scrolling the page no longer
  moves `.app-nav` - its `top` stays `0` throughout - because any overflow is
  now contained inside `.nav-links` instead of the page. At today's normal
  desktop heights, the rail is visually unchanged (no internal scrollbar
  appears, since everything already fits).

- [x] **Step 2 - themed scrollbar globally** - in `main.css`, add scrollbar
  theming (`scrollbar-width: thin; scrollbar-color: var(--border) var(--surface-
  sunken);` plus matching `::-webkit-scrollbar`/`-track`/`-thumb`/`-thumb:hover`
  rules, thumb hover picking up `var(--accent-secondary)`) applied broadly so
  every existing scroll region (cards list/inspector, deck lists, settings
  panel, search dropdown, modals) and the rail from Step 1 all pick it up with
  no per-component changes.
  **Done when:** scrolling any of the app's existing scroll panes shows a slim
  dark scrollbar with a themed thumb instead of the OS default, in both Chrome
  and Firefox.

## Verify

- `bun run measure /cards --size 1440x440 --select .app-nav` (or any page),
  then compare `.app-nav`'s `top` before and after a scroll - it should stay
  pinned at the viewport's top edge instead of moving.
- Resize the actual browser window short (or zoom in) on any page and confirm
  the rail never slides out of view; if the links don't all fit, they scroll
  inside the rail with the new themed scrollbar rather than the page moving.
- Open `/cards` or `/settings` at a normal window size and scroll a list -
  confirm the scrollbar is now themed, not the OS default, and that nothing
  else about the layout shifted.

## Verification gaps

- Step 1 is confirmed with real before/after `bun run measure` numbers at a
  1440x440 viewport (page went from scrolling, with the rail's top sliding to
  -22px after a 22px scroll, to not scrolling at all) plus a pixel-identical
  screenshot at a normal 1440x900 size showing no regression.
- Step 2's colors are confirmed via computed style (`scrollbarWidth: "thin"`,
  `scrollbarColor` resolving to the exact `--border`/`--surface-sunken` RGB
  values) rather than a screenshot: headless Chrome on this machine renders
  scrollbars in macOS's overlay style, which only draws while a real
  scroll gesture is in progress, so a static screenshot never shows a thumb
  either way. Worth a quick look by hand with a real trackpad/mouse scroll on
  `/cards` or `/settings` to see the themed color directly.
