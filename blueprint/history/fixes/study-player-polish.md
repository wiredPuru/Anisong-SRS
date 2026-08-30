# Fix: Study player polish - expand mode, video controls, and a toggle-buttons hide/show

**Type:** Fix
**Status:** verified

## The problem

Originally scoped as build-plan feature 31 ("Study settings panel"): move
`/study`'s two toggle-button rows (display toggles + language toggles) off
the study screen to reduce clutter. Three live design iterations - a
gear/dropdown panel, the same panel overlaid on the video, plain buttons in
the nav bar, then icon-only buttons in the nav bar - were each built and
tried, but none read right to the user ("I dont like the way they look on
the nav bar"). The relocation goal itself was explicitly dropped rather than
kept iterating - **feature 31 remains unbuilt and unchecked in the build
plan**; this fix does not claim to have completed it.

What's left on the branch is a smaller, different answer to the same
"avoid clutter" complaint, plus a handful of `/study` player fixes that got
bundled in along the way (nav bar covering expanded video, playback
controls sitting in an awkward static block, no way to click out of expand
mode) and a correction to feature 30's title display.

## The fix

- **Toggle buttons stay put, gain a hide/show toggle instead of moving.**
  An `h` hotkey and a small, deliberately low-contrast eye/blind icon (👁
  shown / 🙈 hidden) in `.scope-row` hide or show both toggle rows
  together, defaulting to visible. `StudyDisplayToggles` gets a plain
  `v-if`; the language-toggle row (self-contained inside
  `StudyInfoPanel.vue`) gets one new optional prop, `hideToggles?:
  boolean` - `CardPreviewModal` doesn't pass it, so Preview is unaffected.
- **Expand mode no longer covered by the nav bar.** New `useNavHeight()`
  composable (`useState`-backed, same pattern as `useAmbientGlass()`);
  `NavBar.vue` measures and publishes its own real height (updated on
  mount and window resize, since `.nav-links` can wrap to two rows on
  narrow viewports); `StudyMediaPlayer.vue`'s expanded state insets from
  `var(--nav-height)` instead of the full viewport, and letterbox-centers
  the video at 90% of the remaining space
  (`width: min(90vw, calc((100vh - var(--nav-height)) * 0.9 * 16 / 9))`,
  `height: auto` against the existing `aspect-ratio: 16/9`).
- **Playback controls overlay the video.** `.player-controls` (play/pause,
  scrub, time, volume) moved from a block below `.player-frame` to an
  absolutely-positioned overlay bar pinned to the bottom of the frame
  itself, with a dark gradient scrim for legibility, in both default and
  expanded modes.
- **Click outside the video collapses expanded mode.**
  `@click.self="expanded = false"` on `.player-card` - `.self` means only
  a direct click on the letterbox padding around the frame collapses it,
  not clicks on the video, controls, or the expand/theme-badge chrome
  inside `.player-frame`.
- **Song/anime title-repeat fix.** `StudyInfoPanel.vue`'s toggle-gated
  native-title line (feature 30) now only renders when it differs from
  the plain-text line above it, for both the anime and song blocks -
  feature 30 had deliberately accepted the redundant-when-equal display,
  but seeing it live changed that call.

**Abandoned along the way, not part of the final diff** - documented so
they aren't retried without a new reason to revisit them:

1. A gear button opening/closing a dropdown panel (`StudySettingsPanel.vue`)
   with both toggle rows, top-right of the study page.
2. The same panel, overlaid directly on the video (matching
   `StudyMediaPlayer.vue`'s `expand-btn` convention) - required a generic
   `overlay` slot on `StudyMediaPlayer.vue` that was reverted with it.
3. Both rows moved into the nav bar via `<Teleport>`, always visible, full
   text labels.
4. Same nav-bar placement, icon-only buttons with hover tooltips.

If a panel/dropdown is ever reintroduced, note for next time: a
`position: fixed` full-viewport backdrop for close-on-outside-click breaks
once nested inside anything with `ambient-glass` styling -
`backdrop-filter` on an ancestor makes it a containing block for
`position: fixed` descendants in current browsers. `NavBar.vue`'s own
`onClickOutside` (`mousedown` + `Node.contains()`, for its search dropdown)
is this codebase's working pattern instead.

## Build steps

- [x] **Step 1 - Expand mode no longer covered by the nav bar** - new
  `useNavHeight()` composable; `NavBar.vue` measures and publishes its
  height; `StudyMediaPlayer.vue`'s expanded state insets and letterbox-
  centers accordingly. *Done when:* `bun run build` passes; expanded
  mode's positioning uses `var(--nav-height)`.
- [x] **Step 2 - Playback controls overlay the video** - `.player-controls`
  moved inside `.player-frame`, absolutely positioned at the bottom with a
  scrim gradient. *Done when:* build passes; `.player-controls` is a DOM
  child of `.player-frame`, not a sibling.
- [x] **Step 3 - Click outside the video collapses expanded mode** -
  `@click.self="expanded = false"` on `.player-card`. *Done when:* build
  passes.
- [x] **Step 4 - Song/anime title-repeat fix** - toggle-gated native-title
  lines only render when they differ from the plain-text line above them.
  *Done when:* build passes; verified against a real due card whose
  `songTitleNative` equals `songTitle` - the duplicate line no longer
  renders for it.
- [x] **Step 5 - Full rollback of the toggle-relocation attempts** -
  deleted `useLanguageDisplay.ts`, `StudyLanguageToggleButtons.vue`, and
  `StudySettingsPanel.vue`; reverted `StudyInfoPanel.vue`, `study/index.vue`,
  `CardPreviewModal.vue`, and `StudyDisplayToggles.vue` to their exact
  master (pre-attempt) versions via `git checkout master -- <file>`, then
  re-applied Step 4's title-repeat fix on top of the reverted
  `StudyInfoPanel.vue`; removed just the nav-bar teleport target and its
  CSS from `NavBar.vue`, keeping its `useNavHeight()` wiring intact. *Done
  when:* build passes; `grep` confirms no reference to any deleted
  component/composable remains anywhere in `app/`; every route still
  returns 200.
- [x] **Step 6 - `H` hotkey + eye/blind icon hides both toggle rows** -
  new `showControls` ref in `study/index.vue` (default `true`,
  session-only), flipped by the `h` hotkey and a subtle icon button in
  `.scope-row`; gates `StudyDisplayToggles` via `v-if` and
  `StudyInfoPanel`'s language row via the new `hideToggles` prop. *Done
  when:* build passes; pressing `H` or clicking the icon hides/shows both
  rows together; the icon's glyph and tooltip track `showControls`.

## Files / areas

- `nuxt-app/app/composables/useNavHeight.ts` - new (Step 1).
- `nuxt-app/app/components/nav/NavBar.vue` - nav-height measurement
  (Step 1); a teleport target was added then removed (Step 5).
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - expand-mode CSS
  (Step 1), controls overlay (Step 2), click-to-collapse (Step 3). Never
  part of the reverted relocation work beyond one detour (an overlay slot,
  added and reverted within the same session).
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - title-repeat fix
  (Step 4), reverted to master then re-applied (Step 5), gained
  `hideToggles` (Step 6).
- `nuxt-app/app/pages/study/index.vue` - reverted to master (Step 5), then
  gained `showControls`/hotkey/icon (Step 6).
- `nuxt-app/app/components/card/CardPreviewModal.vue`,
  `nuxt-app/app/components/study/StudyDisplayToggles.vue` - reverted to
  master exactly (Step 5); zero net diff.
- `nuxt-app/app/assets/css/main.css` - zero net diff.

## Data / contracts

No server, schema, or API changes.

- `useNavHeight()` returns `{ height: Ref<number> }` (a `useState`
  singleton) - load-bearing for `StudyMediaPlayer.vue`'s expanded layout.
- `StudyInfoPanel` gains one optional prop, `hideToggles?: boolean`
  (default falsy/shown).

## Verify

No test runner configured in `AGENTS.md`; nothing here is logic worth a
unit test (a DOM-height measurement, one template conditional, CSS
layout). `bun run build` was run after every step. `curl` against a
scratch dev server confirmed every route (not just `/study`) returns 200
throughout, including after the rollback. A `grep` sweep after the
rollback confirmed no stray reference to any deleted file remained.

Manually verified by the user directly in the browser (no Playwright or
browser tool available in this environment for the agent to drive itself):
the `H` hotkey and eye/blind icon correctly hide/show both toggle rows,
confirmed working and looking right.
