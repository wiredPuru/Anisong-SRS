# Feature: Movable, resizable display layout

**From build-plan:** feature 91b
**Status:** verified

## Goal

Let the host arrange the party display to fit their screen or stream. A layout
mode on `/party/display` makes each floating piece draggable and resizable from
a corner handle, with everything inside it scaling together. The layout is saved
in that display's browser and survives a resolution change.

## In scope

- Seven movable pieces (`PartyPieceId`): `reveal` (answer card), `scoreboard`,
  `round` (91a's round points panel and its pops), `timer`, `count` (the
  "3 / 20" chip), `join` (the in-game join chip), and `hints` (the lightning
  clues/tags/title card, not its full-screen backdrop).
- Each piece's placement is `{ x, y, scale }`. `x` and `y` are fractions of the
  display (0-1) giving where the piece's fixed **anchor** sits; the anchor is a
  corner, edge midpoint or centre, set per piece in code (for example the
  scoreboard is anchored top-right, the reveal card bottom-centre). `scale` is a
  multiplier (0.4-3) on the piece's current `vw`-based size. Defaults
  approximate today's layout (today's `clamp(px, vh, px)` offsets become plain
  fractions, so a piece may sit a few pixels off its old spot at some sizes).
- Layout mode, toggled by `L` or a button beside the full-screen button (shown
  and hidden with the pointer, like that button), and left with `L`, `Escape`
  or a Done button. In layout mode:
  - each piece shows a dashed outline and its name, and can be dragged anywhere
    (the anchor point stays on screen);
  - a corner handle on the side away from the anchor scales it, keeping the
    anchor point where it is;
  - pieces not currently showing appear with sample content, so the whole
    layout can be arranged before a game;
  - a Reset layout button puts every piece back to its default;
  - pieces sit above the buzz-in, banner and results takeovers.
- Saved to `localStorage` (`gaqSrs:partyLayout`) as each drag or resize ends.
  Reads and writes are wrapped in try/catch, and the display works without
  storage (the layout just doesn't persist). A missing, malformed or
  unknown-version value, an unknown piece id, or an out-of-range number falls
  back to that piece's default.

## Out of scope

- Full-screen takeovers keep their fixed layout: buzz-in, banner, the round
  summary, and the start and waiting screens (including the waiting screen's
  join box). The lightning hints' full-screen backdrop also stays; only its
  card moves.
- The video/cover itself, the lightning countdown bar, and the full-screen and
  layout buttons.
- Separate width and height (resizing keeps proportions), snapping, layout
  presets, and syncing a layout to the server or another screen.
- Hiding a piece altogether.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Layout math** - a pure `app/utils/partyLayout.ts`: the
  types and piece list below, `PIECE_ANCHORS`, `DEFAULT_LAYOUT`,
  `parseLayout(raw)` (a JSON string or null in, a full valid layout out),
  `serializeLayout(layout)` (only pieces moved from default), `movePlacement(
  placement, dx, dy)` (fractions, anchor point clamped to 0-1),
  `resizePlacement(placement, anchorPx, startPointerPx, pointerPx)` (scale by
  the ratio of pointer distances from the anchor, clamped to 0.4-3, unchanged
  when the start distance is near zero), and `frameStyle(placement, anchor)`
  (the `left`/`top`/`transform`/`transform-origin` values). *Done when:* unit
  tests pass for defaults, malformed and partial saved values, unknown ids and
  versions, round-tripping through serialize and parse, clamping on move and
  resize, and the style output for a corner and a centre anchor.
- [x] **Step 2 - Frame and first pieces** - `usePartyLayout()` (shared state
  through `useState`, loaded from `localStorage` on the client, with `save()` and
  `reset()`) and `PartyLayoutFrame.vue` (`piece` prop; positions its slot from
  the layout, no editing yet). Wrap `count`, `round`, and `reveal`, moving their
  own absolute positioning into the frame and changing any `%` width to `vw`
  (a frame shrink-wraps its content). *Done when:* screenshots of a revealed
  song with round points at 1280x720 and 1920x1080 match the same screens
  before the change to within a few pixels, and the build passes.
- [x] **Step 3 - Remaining pieces** - split `PartyDisplayOverlays` so `timer`,
  `scoreboard`, and `join` each sit in a frame, and split the lightning hints
  into the full-screen backdrop (unchanged, in the player) and a framed card.
  *Done when:* screenshots of a timer, the scoreboard, the join chip, and a
  clues round at both sizes match the before shots to within a few pixels.
- [x] **Step 4 - Layout mode** - the `L` key and layout button, outlines and
  labels, pointer-event dragging and corner resizing (pointer capture, so a fast
  drag doesn't drop the piece), saving on release, Reset layout, Done and
  `Escape`. Double-click-to-full-screen and the idle cursor hide are off in
  layout mode. *Done when:* dragging the scoreboard to the bottom-left and
  doubling the round panel's size survive a reload; resizing the window keeps
  both in proportion; Reset layout restores the defaults; `F` still toggles full
  screen; nothing can be dragged outside layout mode.
- [x] **Step 5 - Samples** - in layout mode, any piece with nothing to show
  renders sample content (an answer card, three players, round points, a timer,
  "3 / 20", a join chip, a clues card) that disappears on leaving layout mode.
  *Done when:* on the waiting screen with no game loaded, layout mode shows all
  seven pieces, and a layout arranged there carries over to a real game.

## Files / areas

- `nuxt-app/app/utils/partyLayout.ts` (+ `.test.ts`) - new, pure.
- `nuxt-app/app/composables/usePartyLayout.ts` - new.
- `nuxt-app/app/components/party/PartyLayoutFrame.vue` - new.
- `nuxt-app/app/components/party/PartyDisplayOverlays.vue` - split per piece.
- `nuxt-app/app/components/party/PartyLightningHints.vue` and
  `PartyDisplayPlayer.vue` - backdrop and card split.
- `nuxt-app/app/components/party/PartyRevealOverlay.vue`,
  `PartyRoundPoints.vue` - positioning moves to the frame.
- `nuxt-app/app/pages/party/display.vue` - frames, layout mode, keys, samples.

## Data / contracts

Client-only; nothing on the server, and no stored state beyond this browser's
`localStorage`.

```ts
export const PARTY_PIECES = ["reveal", "scoreboard", "round", "timer", "count", "join", "hints"] as const;
export type PartyPieceId = (typeof PARTY_PIECES)[number];
export interface PartyPlacement { x: number; y: number; scale: number }
export interface PartyAnchor { ax: 0 | 0.5 | 1; ay: 0 | 0.5 | 1 }
export type PartyLayout = Record<PartyPieceId, PartyPlacement>;
// localStorage "gaqSrs:partyLayout":
// { "v": 1, "pieces": { [id]: PartyPlacement } }, only pieces moved from default
```

Load-bearing for any later display piece: a new floating piece joins
`PARTY_PIECES` with an anchor and default, and older saved layouts simply lack
it.

## Testing

- Vitest is on: Step 1's `partyLayout.test.ts` covers all layout math and
  parsing.
- Steps 2-5 are UI and ride on browser evidence: a scratch party server with a
  copied database on spare ports (as 91a's check did, never the user's running
  server or real host password), driven with `playwright-cli` at 1280x720 and
  1920x1080, with before/after screenshots and a console check. Plus
  `bun run build`.

## Notes for the AI

- Frames position against `.display`, which is the full viewport. The player
  (`.party-player`, `inset: 0`) has the same box, so the hints frame inside it
  uses the same fractions.
- A frame shrink-wraps its content, so a piece's width must come from `vw`,
  `min()` or its content, never `%` of its parent (the reveal card's
  `calc(100% - 32px)` becomes `calc(100vw - 32px)`).
- Scaling uses `transform: scale()` with `transform-origin` at the anchor, so
  the piece's own `clamp(..vw..)` sizes still apply underneath and text stays
  real DOM text.
- Outside layout mode frames keep `pointer-events: none`, as the overlays do
  today.
- Keep `display.vue` readable: the layout-mode toolbar and keys can live in a
  small `PartyLayoutToolbar.vue`.
- Colors and outlines come from `main.css` tokens (`--outline`, `--accent`).
