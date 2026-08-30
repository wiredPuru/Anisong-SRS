# Feature: Immersive expanded study mode

**From build-plan:** feature 31
**Status:** verified

## Goal

Redesign `/study`'s expand mode into a genuinely immersive view: an `E`
hotkey toggles it, everything currently on the side info card (titles,
artist, language toggles) overlays directly on the video instead of sitting
beside it, Pass/Fail joins that overlay too, and - the key behavioral
change from today's expand - staying immersive carries across moving to the
next card instead of resetting every time a new card loads.

## In scope

- New `E` hotkey toggles immersive mode, alongside the existing expand
  button (click) and Escape/click-outside-the-video (both already
  collapse it).
- **Immersive state moves from `StudyMediaPlayer.vue` (local, remounts
  every card via its `:key="presentationKey"`) to `study/index.vue`
  (page-level, survives card transitions)**, so entering immersive mode
  and then passing/failing to the next card keeps the player immersive
  instead of collapsing it. This is the one genuinely new piece of
  behavior - everything else is a visual reorganization of what already
  exists.
- The info card overlays the video (transparent/scrim treatment, not the
  opaque card background it uses beside the player) instead of sitting in
  the `.side` column.
- Pass/Fail overlays the video too, in the same immersive state.
- `I` (hide info) keeps its existing meaning outside immersive mode
  (blur the info card, unchanged). **Inside immersive mode, `I` instead
  shows or hides the overlaid info entirely - no blur, a plain visibility
  toggle** - since blurring text floating over a video reads differently
  than blurring an opaque card. `I` only ever affects the info portion,
  matching today's scope - Pass/Fail stays visible/usable either way,
  exactly as `hideInfo` already never touches `StudyAnswerControls` today.
- Hide Video, Ambient mode, and the language/display toggles keep working
  exactly as today, unaffected by immersive mode - independent toggles.

## Out of scope

- `CardPreviewModal` - has no immersive concept and isn't touched. It
  doesn't pass the new `immersive` prop, so it defaults to `false` and
  renders exactly as it does today.
- Feature 32 (Study playback-mode option) - a later, separate feature that
  will eventually add a control inside this overlay; nothing here builds
  toward that beyond the overlay existing as a place it could go.
- Persisting immersive mode across a page reload or between study
  sessions (e.g. `localStorage`) - it's page-level state, which is enough
  to survive card-to-card navigation within one session; every other
  `/study` display toggle is session-only too, and this matches that
  convention.
- Exact pixel positioning/spacing of the overlay. A reasonable first pass
  is specified below, but this kind of layout call has needed live visual
  iteration every time it's come up on this screen so far this project -
  expect to adjust spacing/contrast after actually seeing it, not to nail
  it from prose alone.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lift immersive state to `study/index.vue`, add the `E`
  hotkey; no visual change yet** - `StudyMediaPlayer.vue`'s local
  `expanded` ref becomes a controlled prop, `immersive?: boolean`
  (default `false`, so `CardPreviewModal` is unaffected), plus
  `defineEmits<{ "update:immersive": [boolean] }>()`. Its three internal
  triggers - the expand button's click, `@click.self` on `.player-card`,
  and the `Escape` handler - emit `update:immersive` instead of mutating a
  local ref directly. The template's `:class="{ expanded: immersive }"`
  (CSS class name unchanged, only the source of truth moves) reads the
  prop. Add a tooltip to the expand button naming its hotkey (`Hotkey: E`),
  matching this app's established convention for every hotkeyed button.
  `study/index.vue` adds `const immersive = ref(false)`, binds it with
  `v-model:immersive="immersive"` on `<StudyMediaPlayer>`, and adds `e` to
  its existing `onKeydown` key checks. *Done when:* `bun run build`
  passes; pressing `E` (or clicking the expand button) expands the video
  exactly as it does today (same letterboxed 90% sizing, same
  Escape/click-outside collapse); the new, actually-different behavior -
  passing/failing to the next card while immersive keeps it immersive
  instead of collapsing - is verified manually, since it's the one thing
  that can't be checked by reading a single component in isolation.
- [x] **Step 2 - `StudyInfoPanel` gains an overlay treatment and
  immersive-aware `I` behavior** - new optional prop `immersive?: boolean`
  (default `false`). Template root becomes
  `v-if="!(immersive && blurred)"` (fully hides instead of rendering
  blurred, only when both are true); `:class` adds `overlay: immersive`
  and only applies the existing `blurred` class when `!immersive`. New
  `.info-card.overlay` CSS: no opaque background/border/shadow, text gets
  a drop-shadow (`text-shadow`) for legibility over arbitrary video
  instead of relying on a solid card background. Not wired to the real
  immersive state yet - `immersive` defaults `false` everywhere until
  Step 3, so this step is verified the same way Step 1 was: the existing,
  default (non-immersive) path must behave identically to before. *Done
  when:* build passes; with no caller passing `immersive`, `StudyInfoPanel`
  looks and behaves exactly as it does today (both on `/study` and in
  Preview) - `I` still blurs, doesn't hide.
- [x] **Step 3 - Overlay the info card and Pass/Fail on the video, wire
  `StudyInfoPanel`'s `immersive` prop** - went through two real revisions
  once the user could actually see it (screenshot-driven), landing
  somewhere more precise than the original plan. `study/index.vue` calls
  `useNavHeight()` directly and applies `--nav-height` via `:style` on
  `.study`. The first cut positioned `.side` as a `position: fixed` box
  inset a flat 24px from the viewport edges - the user's screenshot showed
  the real problem: on a wide screen the letterboxed video is *narrower*
  than the viewport, so Pass/Fail spanned past the video into empty space,
  and the info card's language toggles ran into the expand button's
  corner. Fixed by anchoring both `.info-slot` and `.answer-slot` (now
  separate wrapper divs, not direct children) to a `--video-width` custom
  property that mirrors `StudyMediaPlayer.vue`'s own sizing formula
  exactly (`min(90vw, calc((100vh - var(--nav-height)) * 0.9 * 16 / 9))`),
  so they track the video's real box instead of the full viewport - by
  default both slots sit *inside* that box (info top-left with clearance
  for the theme badge/expand button, Pass/Fail along the bottom with
  clearance for the playback-controls bar). A second round of feedback
  added a `@media (min-width: 1400px)` variant: on wide screens the info
  card moves to the true left margin beside the video (matching where it
  sits outside immersive mode) and Pass/Fail moves to the true right
  margin, vertically centered - "show on the left when there's space,
  pass/fail can be on the right when there's space, otherwise everything
  stays in the same area as the video." Pass `:immersive="immersive"`
  into `<StudyInfoPanel>`. *Done when:* build passes; confirmed working
  and looking right by the user directly (this was pure CSS layout math
  with no way for the agent to verify it visually beforehand).
- [x] **Step 4 - Verify cross-card persistence and polish overlay
  legibility** - the actual point of this feature, and not verifiable by
  reading code: enter immersive mode, pass or fail to move to the next
  card, confirm the player stays immersive and the new card's info is
  correctly overlaid. *Done when:* confirmed manually by the user - "works
  perfectly as intended."
- [x] **Step 5 - `I` also hides the OP/ED theme badge** - small follow-up
  request. `StudyMediaPlayer.vue`'s `.theme-badge` (shows `card.themeSlot`,
  e.g. "OP1") is a mild spoiler alongside the rest of what `hideInfo`
  already conceals, but today it's unaffected by that toggle in any mode.
  New optional prop `hideThemeBadge?: boolean`, gating the badge with
  `v-if="!hideThemeBadge"` (plain visibility, not blur - it's a small
  label, not a text block). `study/index.vue` passes
  `:hide-theme-badge="hideInfo"`, reusing the same `I` hotkey/ref rather
  than adding a new one. Applies in both immersive and normal mode - the
  badge sits on the video either way. *Done when:* `bun run build` passes;
  pressing `I` hides the theme badge alongside whatever else `hideInfo`
  already hides in the current mode, and shows it again on the next press.
- [x] **Step 6 - Fix the expand button's tooltip getting clipped** - a bug
  in Step 1's own addition, caught by the user via screenshot: the shared
  `.tooltip` class opens upward (`bottom: calc(100% + 8px)`), which works
  for `.play-btn` (near the bottom of `.player-frame`, room to open
  upward) but not `.expand-btn` (near the very *top* of `.player-frame`) -
  its tooltip had nowhere to go before hitting the frame's
  `overflow: hidden` and got clipped to a sliver. Added a
  `.expand-btn .tooltip` override (`top: calc(100% + 8px); bottom: auto;`)
  so it opens downward instead. *Done when:* build passes.

## Files / areas

- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - `expanded` ->
  controlled `immersive` prop + `update:immersive` emit (Step 1).
- `nuxt-app/app/pages/study/index.vue` - owns `immersive`, the `E`
  hotkey, `useNavHeight()` and the `--video-width` custom property for
  `.info-slot`/`.answer-slot` positioning, wires `StudyInfoPanel`'s new
  prop (Steps 1, 3).
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - `immersive` prop,
  overlay styling, blur-vs-hide split for `I` (Steps 2-3).
- `nuxt-app/app/components/card/CardPreviewModal.vue` - not touched;
  confirmed unaffected in Steps 1-2's done-whens.

## Data / contracts

No server, schema, or API changes - client-side component/state
reorganization only.

- `StudyMediaPlayer` props gain `immersive?: boolean` (default `false`,
  replacing its former fully-local `expanded` ref) and emit
  `update:immersive: [boolean]`. Load-bearing: the parent must own this
  ref for cross-card persistence to work at all - this is the crux of the
  feature.
- `StudyInfoPanel` props gain `immersive?: boolean` (default `false`) -
  changes what the existing `blurred` prop does (blur vs. fully hide) and
  swaps the card's visual treatment.

## Testing

No test runner is configured in `AGENTS.md` yet. Nothing here is logic
worth a unit test even once a runner exists - a controlled-prop
conversion, one template conditional, and CSS layout. Verify via
`bun run build` at every step, plus a manual browser pass - especially
Step 4's cross-card persistence check, which is the one behavior that
can't be confirmed by reading the code in isolation (it depends on the
component actually remounting via `presentationKey` while the parent's
state doesn't).

## Notes for the AI

- This replaces the retired "Study settings panel" idea (build-plan
  feature 31 was rewritten for this feature - see
  `blueprint/history/fixes/study-player-polish.md` for what was tried and
  rolled back there, including the `H` hotkey + eye/blind icon that
  already ships and stays unrelated to this work).
- `StudyMediaPlayer.vue`'s `Escape`-collapses-immersive and
  `@click.self`-collapses-immersive handlers both stay local to that
  component (they just emit now instead of mutating a local ref) - no
  need to move either up to `study/index.vue`.
- `.player-card.expanded`'s existing CSS (fixed positioning, letterbox
  sizing, `--nav-height` inset) is unchanged by this feature - only the
  *source* of the `expanded`/`immersive` boolean moves, not what it does
  to the video itself.
- Reuse `useNavHeight()` directly in `study/index.vue` rather than
  threading `--nav-height` down through props - it's already a shared
  `useState` singleton (same pattern as `useAmbientGlass()`), designed
  for exactly this kind of cross-component need.
- `StudyAnswerControls.vue` needs no changes - its buttons already have
  an opaque background (`var(--surface)`) that should read fine directly
  over video without a style change, and its own hotkeys (arrow keys)
  already work regardless of where it's rendered in the DOM.
- Match this app's established tooltip convention (a `<span class="tooltip">`,
  not the native `title` attribute) for the expand button's new `Hotkey: E`
  label in Step 1.
- **Known layout risk flagged before building, confirmed real by the
  user's screenshot:** the expand button and theme badge live inside
  `.player-frame` at `z-index: 2-3`; positioning overlay content by
  viewport edges rather than the video's own (centered, letterboxed) box
  let the info card and Pass/Fail run past the video into empty space and
  toward the expand button's corner. Resolved by the `--video-width`
  technique below, not by z-index alone - worth remembering that z-index
  only decides who wins when boxes overlap, not whether they should
  overlap in the first place.
- **The `--video-width` technique, worth reusing anywhere else on
  `/study` needs to track the letterboxed video's real box:** define a
  CSS custom property equal to the exact same sizing formula
  `StudyMediaPlayer.vue`'s `.player-card.expanded .player-frame` uses
  (`min(90vw, calc((100vh - var(--nav-height)) * 0.9 * 16 / 9))`) on a
  shared ancestor, then position other fixed elements relative to it
  (e.g. `left: calc(50vw - (var(--video-width) / 2) + <inset>)` for
  something that should sit at the video's own left edge, since the video
  is horizontally centered). Avoids DOM nesting or JS measurement -
  that formula is the single source of truth for the video's box; keep it
  in sync in both places if it ever changes.
