# Feature: Home page + navigation bar

**From build-plan:** feature 15
**Status:** verified

## Goal

Give the app a front door and a way to get between sections without editing
the URL by hand. A `/` home page acts as a launcher hub, and a persistent top
nav bar (shared across every page) links to Home, Study, Cards, Decks, Stats,
and Settings.

## In scope

- A new `/` route: a launcher hub with a link/card per section (Study, Cards,
  Decks, Stats, Settings). No live data (no due-card count, no stats) - just
  navigation.
- A shared Nuxt layout with a persistent top nav bar, applied to every
  existing page (`/`, `/study`, `/cards`, `/cards/new`, `/decks`, `/stats`,
  `/settings`) automatically via Nuxt's default-layout convention.
- Active-route highlighting in the nav (the current section reads as
  visually distinct from the rest).
- Nav's "Study" link goes to plain `/study` (no query - the study page
  already treats a missing `type` query as "all decks", matching
  `/decks`'s own "Study all decks" link).
- The nav bar becomes more transparent while feature 10's "Ambient mode"
  toggle (on `/study`) is on, requested mid-build after Steps 1-2 landed.

## Out of scope

- Any live data on the home page (due-card counts, recent pass rate, etc.) -
  explicitly deferred; the hub is links only.
- A sidebar or any layout other than a top bar.
- Mobile/responsive nav collapse (hamburger menu) - not asked for; revisit
  if the app is ever used on a narrow viewport.
- Changing `/cards/new`'s existing "Back to cards" link or any other
  in-page link - those stay as they are.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight
   on. Checkpoints are optional; `/complete` makes the real feature-level
   commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the
step was too big, so split it.

## Build steps

- [x] **Step 1 - Home page** - add `app/pages/index.vue`: a launcher hub
  with a card/link per section (Study -> `/study`, Cards -> `/cards`, Decks
  -> `/decks`, Stats -> `/stats`, Settings -> `/settings`), styled with the
  existing theme tokens (rounded corners, `var(--surface)`,
  `var(--accent)`, etc. from `main.css`). No data fetching. *Done when:*
  visiting `/` renders the hub and each link navigates to its target page.
- [x] **Step 2 - Shared layout + top nav bar** - add
  `app/layouts/default.vue` and a nav component (e.g.
  `app/components/nav/AppNav.vue`) with links to Home (`/`), Study
  (`/study`), Cards (`/cards`), Decks (`/decks`), Stats (`/stats`), Settings
  (`/settings`). Highlight the active link using the current route. Because
  Nuxt applies the `default` layout to every page automatically, no
  per-page opt-in is needed - verify none of the existing pages already set
  an explicit conflicting layout. *Done when:* the same nav bar with
  correct active-link highlighting appears on `/`, `/study`, `/cards`,
  `/cards/new`, `/decks`, `/stats`, and `/settings`, and every nav link
  navigates correctly.
- [x] **Step 3 - Transparent nav bar in Ambient mode** - share the
  `ambientMode` toggle (currently a local `ref` in `study/index.vue`,
  wired to `StudyDisplayToggles`) via a small `useAmbientMode()` composable
  (`useState`-backed, so it's readable from the nav bar's layout context),
  and have `NavBar.vue` apply a more transparent background whenever it's
  true. Reset the shared value to `false` on every `/study` mount, matching
  feature 10's "reset every time a session starts, not persisted"
  convention for the other display toggles. *Done when:* turning on
  Ambient mode on `/study` visibly lightens/transparentizes the nav bar
  immediately, turning it off restores the normal nav bar, and leaving
  `/study` and returning resets it to off.

## Files / areas

- `nuxt-app/app/pages/index.vue` (new)
- `nuxt-app/app/layouts/default.vue` (new)
- `nuxt-app/app/components/nav/NavBar.vue` (new - named `NavBar` rather than
  `AppNav` so the folder-prefix stripping convention from feature 11 applies
  cleanly: filename starts with the folder name `nav`, so Nuxt auto-imports
  it as `<NavBar>` instead of double-prefixing to `<NavAppNav>`)
- `nuxt-app/app/app.vue` (changed) - wrapped `<NuxtPage />` in
  `<NuxtLayout>`, required for the `default` layout to actually apply;
  not listed in the original spec draft but necessary for Step 2's done-when
- `nuxt-app/app/composables/useAmbientMode.ts` (new, Step 3) - shared
  `useState`-backed boolean so `NavBar.vue` (in the layout) and
  `study/index.vue` (a page) can read/write the same Ambient-mode value
- `nuxt-app/app/pages/study/index.vue` (changed, Step 3) - `ambientMode`
  now comes from `useAmbientMode()` instead of a local `ref`, reset to
  `false` on every mount to preserve feature 10's "resets every session"
  behavior
- `nuxt-app/app/assets/css/main.css` - reuse existing tokens only; no new
  tokens expected (Step 3 derives its translucent colors from `var(--surface)`/
  `var(--border)` via `color-mix()` rather than adding new tokens)

## Data / contracts

None. No new DB tables, API routes, or shared types - this feature is
client-side routing and layout only.

## Testing

No test runner is configured in `AGENTS.md`, so this rides on browser and
build evidence, which also matches the Testing gate's scope rule (UI/layout
work is exempt from the unit-test gate even when a runner exists). Verify by:

- Loading `/` and clicking each launcher link, confirming it lands on the
  right page.
- Checking the nav bar renders identically (same links, same active-link
  behavior) across `/`, `/study`, `/cards`, `/cards/new`, `/decks`,
  `/stats`, `/settings`.
- Confirming `/study`'s ambient glow (feature 14, `position: fixed` behind
  everything) still renders correctly with the nav bar present - it's
  layered independently (`z-index: -1`) so should be unaffected, but check
  visually since this is the one page with an unusual full-viewport layout.
- `bun run build` succeeds with no type errors.

## Notes for the AI

- Follow the no-dynamic-route-segment convention already established
  (`?type=&id=` query params, no `[id].ts`) - this feature doesn't need any
  new dynamic routes, so it's not at risk here, but don't introduce one.
- `/study` treats a missing `type` query as `{ type: "all" }` (see
  `app/pages/study/index.vue`), so the nav's Study link is just `/study`,
  no query string needed.
- Keep the nav bar visually slim - `/study` centers its video and already
  assumes most of the viewport; don't let the nav bar crowd that layout.
- Use `<NuxtLink>` for all nav links (existing convention throughout the
  app), and reuse `var(--surface)`, `var(--border)`, `var(--accent)`,
  `var(--radius)` etc. from `main.css` rather than introducing new colors.
- No inline styles - scoped `<style>` blocks only, per
  `coding-standards.md`.
