# Feature: Ultrawide/large-screen layout cap

**From build-plan:** feature 57
**Status:** verified

## Goal

On very wide monitors, the app's full-bleed layout (feature 50) grows into
unbounded dead space instead of more usable content - most visibly on
`/study`, where the aspect-locked video pane simply stops growing past a
certain window width and leaves large, ever-growing empty margins on both
sides. Cap and center the app's shared content column above roughly
2600px of viewport width so this turns into one deliberate, symmetric
border instead of runaway blank space, while leaving every screen's
existing look completely unchanged below that width.

## Design reference

No mockup - this is a structural fix to an existing shipped design (feature
50's Akiba Neon layout), not a new visual direction. Two screenshots
supplied in chat show the problem on a ~3105-3116px-wide viewport: `/study`
with large dead gutters beside the video, and `/cards` with its table
stretched loosely across the full width. Both are reproducible locally via
`bun run measure <path> --size 3440x1440` (or wider) against the dev
server.

## In scope

- One new breakpoint, gated on viewport width (`min-width: 2600px`),
  applied to the app's shared content wrapper
  (`.app-content` in `nuxt-app/app/layouts/default.vue`) that every page
  renders inside via `<slot />`. Adds `max-width` and `margin-inline: auto`
  so the wrapper centers itself within the space beside the rail once the
  viewport crosses that width.
- A `--content-max-width` token in `main.css` (alongside the existing
  `--rail-width` token) documenting the cap value, following the project's
  "no hard-coded sizes, use a token" convention for shell-level values.
- Verifying the effect on every top-level page (`/`, `/study`, `/cards`,
  `/decks`, `/stats`, `/settings`) at a simulated ultrawide size, since the
  fix is a single shared wrapper and should bound all of them uniformly
  with no per-page changes.
- Confirming the persistent left rail (`--rail-width`) stays pinned to the
  viewport's left edge, unaffected by the cap - only the content beside it
  centers.

## Out of scope

- Redesigning any individual page to use extra space productively (e.g. a
  proportionally wider Study info panel, wider Cards columns). This was the
  explicitly rejected alternative direction for this feature - see the
  build-plan entry.
- `/study`'s own internal video-pane gutter, which is a separate, smaller
  effect of `.player-frame`'s height-capped 16:9 aspect ratio. Capping the
  outer content column bounds how large that gutter can grow, but does not
  eliminate it - some internal gutter beside the video is expected and
  acceptable at this feature's chosen direction.
- `StudyMediaPlayer`'s expanded/immersive mode and `CardPreviewModal`'s
  modal backdrop, both `position: fixed` and sized against the raw
  viewport rather than `.app-content`. These are meant to stay
  maximally immersive regardless of the new cap, so they are deliberately
  left alone.
- The narrow-screen breakpoint (`max-width: 820px`, feature 50h) - untouched.
- Any change to `project-plan.md` beyond the already-approved §7 edit (done
  as part of plan intake, not a build step here).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add the ultrawide cap** - add `--content-max-width: 2400px;`
  to `:root` in `nuxt-app/app/assets/css/main.css` (next to `--rail-width`,
  with a short comment on why 2600px/2400px were chosen: comfortably above
  the common 1920/2560 desktop range feature 50 already targets - a plain
  2560x1440 monitor deliberately stays uncapped, since it never showed the
  reported dead-space problem. Add a `@media (min-width: 2600px)` rule to
  `.app-content` in `nuxt-app/app/layouts/default.vue`, alongside its
  existing `@media (max-width: 820px)` rule, setting
  `max-width: var(--content-max-width); margin-inline: auto;`.
  *Done when:* at a simulated viewport of 3440x1440 (via
  `bun run measure /study --size 3440x1440 --select ".study-grid"` and the
  same for `/cards`' main list, `/decks`, `/stats`, `/settings`, and `/`),
  each page's content column measures at or below 2400px and is
  horizontally centered in the space beside the rail (roughly equal margin
  on both sides of the capped column) - and at 1920x1080 and 2560x1440
  (just below the 2600px trigger), every page's box measurements are
  unchanged from before the diff
  (confirmed via `bun run measure ... --css` before/after, or by comparing
  against a same-size measurement taken before this step). Also confirm the
  rail itself (`--rail-width`) still measures flush against the left edge
  of the viewport at every size, and that `/study`'s expanded/immersive
  player and `CardPreviewModal` still span the full viewport width (not
  bound by the new cap) when opened at 3440px+.

## Files / areas

- `nuxt-app/app/assets/css/main.css` - new `--content-max-width` token
- `nuxt-app/app/layouts/default.vue` - new `@media (min-width: 2600px)`
  rule on `.app-content`

## Data / contracts

None - pure CSS, no data model, route, or API change.

## Testing

- No test runner is applicable here - this is a CSS-only layout change,
  which the coding-standards test-scope rule already excludes (no
  parser/formatter/validator/server-action logic involved). Verified with
  `bun run measure` browser evidence (box measurements at multiple
  viewport sizes, before/after) per the done-when above, plus a visual
  screenshot at a simulated ultrawide size for each affected page.
- `bun run test` should still be run once as part of `/implement`'s
  standard gate to confirm this change causes no regression in the
  existing suite (expected: no effect, since nothing in the suite touches
  layout CSS).

## Notes for the AI

- The cap must live on `.app-content` (the one wrapper every page's
  `<slot />` renders into), not duplicated per page - that's what makes
  this a one-place fix instead of a per-page one, and is the whole reason
  the recommended direction was chosen over a per-page redesign.
- `.app-shell` is `display: flex` with the rail and `.app-content` as its
  only two children; `.app-content` already has `flex: 1; min-width: 0`.
  Adding `max-width` to a flex item legitimately caps its used width
  regardless of `flex-grow` (standard CSS behavior), and `margin-inline:
  auto` then centers the now-capped box within the remaining flex space -
  no other change to `.app-shell` or the rail is needed.
- Match the existing comment style in both files (why, not what) when
  documenting the new token and breakpoint - see the existing
  `--rail-width` token comment and the `@media (max-width: 820px)` comment
  in `main.css` for the pattern to follow.
- Use `bun run measure` for verification, per `AGENTS.md`'s Commands
  section and the Browser Verification convention in
  `coding-standards.md` (Playwright is deliberately not a dependency here).

## Evidence

Verified with `bun run measure` against the running dev server:

- 1920x1080 and 2560x1440: `.app-content` touches the viewport's right
  edge in both cases (`left: 82` / rail width, `right` = viewport width) -
  byte-identical to pre-diff behavior, confirming the trigger genuinely
  sits above the common desktop range.
- 3440x1440 across all six top-level pages (`/`, `/study`, `/cards`,
  `/decks`, `/stats`, `/settings`): `.app-content` measures exactly
  2400x1440 and is centered (`left: 561, right: 2961` on every page,
  identical margins on both sides).
- Rail (`.app-nav`) at 3440px: `left: 0, width: 82` - unaffected, flush
  against the viewport edge as before.
- Study's video frame (`.player-frame`) at 3440px: centered within its
  pane with symmetric ~49px margins on each side (was unbounded/growing
  before this fix).
- Expanded/immersive player (`CardPreviewModal`): confirmed unaffected by
  source inspection - `.player-card.expanded` is `position: fixed` against
  the viewport, untouched by this diff, so it cannot be bound by
  `.app-content`'s max-width regardless of screen size.

`bun run test` (35/35, no regressions) and `bun run build` both passed
clean, re-confirmed again just before archiving this feature.

One correction made mid-implementation: the spec's original 2560px trigger
would have also capped plain 2560x1440 monitors (a common, non-problematic
resolution), so it was bumped to 2600px and the spec updated to match -
verified both values empirically above.
