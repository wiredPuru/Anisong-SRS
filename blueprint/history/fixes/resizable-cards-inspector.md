# Fix: Resizable inspector rail on /cards

## Resizable inspector rail on /cards

**Type:** Fix
**Status:** verified

### The problem

On `/cards`, `.cards-body` is a fixed `grid-template-columns: 1fr 400px`
(`nuxt-app/app/pages/cards/index.vue`). On wide displays the 400px inspector
rail is too small to watch an opening comfortably, while the table keeps
space it doesn't need. There's no way to change the split.

### The fix

Put a thin vertical drag handle on the border between the list pane and the
inspector, like resizing tiled windows:

- Dragging it left or right sets the inspector width, bound through a CSS
  custom property (`--inspector-width`) on `.cards-body`.
- Pointer events (`pointerdown` + `setPointerCapture`) so it works for mouse
  and touch, with `user-select: none` while dragging.
- Clamped: minimum 320px, maximum whatever leaves the list pane at least
  480px (recomputed on window resize).
- Double-clicking the handle resets to the 400px default.
- The chosen width persists in `localStorage` (`gaqSrs:cardsInspectorWidth`),
  same pattern as `gaqSrs:playerVolume`, wrapped in try/catch.
- Handle uses `col-resize` cursor and an accent highlight on hover/drag.

Must not break:

- The 820px narrow layout: panes still stack and the handle is hidden.
- Immersive/expanded Preview in the inspector (a fixed overlay).
- The inspector's own scroll and the list's infinite scroll.

### Build steps

1. [x] **Draggable, clamped, persisted splitter on /cards** - handle,
   pointer-drag logic, clamp, double-click reset, `localStorage` persistence.
   Clamp math is a pure function with a colocated Vitest test.
   **Done when:** dragging the border resizes the inspector live, the width
   survives a reload, double-click restores 400px, it can't be dragged past
   the bounds, and at <=820px the handle is gone and the layout stacks.

### Verify

- `bun run test` and `bun run build` pass.
- By hand: open `/cards`, drag the divider wider, the video grows; reload,
  width kept; double-click, back to 400px; under 820px, layout stacks with no
  handle.
