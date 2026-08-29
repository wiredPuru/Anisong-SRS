# Fix: Hotkeys bleed into text fields + ambient-mode search dropdown is covered

**Type:** Fix
**Status:** verified

## The problem

Two independent bugs found during manual testing of the search work:

1. **Hotkeys fire while typing.** Four separate `window.addEventListener("keydown", ...)`
   listeners exist - `StudyMediaPlayer.vue` (`s` play/pause, `Escape` collapse),
   `pages/study/index.vue` (`i`/`v`/`a` display toggles), `StudyAnswerControls.vue`
   (arrow keys pass/fail), `CardPreviewModal.vue` (`Escape` close) - and none of
   them check whether the keydown actually originated from a text field. Typing
   into the nav search box (a plain `<input>` in `NavBar.vue`) bubbles to
   `window` and triggers all matching handlers: typing "s" toggles play/pause,
   "v" toggles Hide Video, "i" toggles Hide Info, arrow keys register
   pass/fail, etc.

2. **Ambient mode covers the search dropdown.** On `/study` with ambient mode
   on, the nav search dropdown gets visually covered by the song info panel.
   Root cause: `main.css`'s `[data-ambient-glass="true"] .app-nav { ...
   backdrop-filter: var(--glass-blur) !important; }` gives `.app-nav` a
   `backdrop-filter` when ambient mode is on. `backdrop-filter` (like
   `transform`/`filter`) forces an element into its own stacking context even
   without an explicit `z-index` - `.app-nav` has neither `position` nor
   `z-index` set, so this promotes it to an implicit stacking context at
   effective `z-index: 0`. `StudyInfoPanel.vue`'s own `.ambient-glass` class
   does the same to the info panel, and since the info panel renders later in
   DOM order than the nav bar (`NavBar` before `<slot />` in
   `app/layouts/default.vue`), same-effective-z-index stacking contexts paint
   in DOM order - the info panel wins and covers the nav bar's dropdown
   (`.search-dropdown`'s own `z-index: 20` only matters *within* `.app-nav`'s
   local stacking context, not against a sibling stacking context). This is
   invisible outside ambient mode because `.app-nav` isn't promoted to a
   stacking context at all then, so `.search-dropdown`'s `position:
   absolute` lands it in the root's positive-z-index paint step, which always
   comes after any `z-index: 0`/`auto` context.

## The fix

1. **Shared hotkey guard.** Add `app/composables/useHotkeyGuard.ts`,
   following the existing `useAmbientGlass()` pattern (plain function,
   nothing stateful needed): returns `isTypingTarget(event: KeyboardEvent):
   boolean`, true when `event.target` is an `HTMLElement` that's an
   `INPUT`/`TEXTAREA`/`SELECT` or has `isContentEditable`. Import it in all
   four existing `keydown` handlers and return early when it's true, before
   any of their existing key-matching logic. No new hotkey-registration
   abstraction - just the one shared guard, wired into what's already there.

2. **Nav bar wins every stacking context.** In `NavBar.vue`'s `.app-nav`
   style, add `position: relative; z-index: 100;` - always on, not
   conditional on ambient mode, so the nav bar (a persistent, page-spanning
   layout element) reliably paints above per-page content regardless of what
   stacking contexts that content creates. `100` clears every existing
   z-index in the app (`StudyMediaPlayer.vue`'s expanded player at `60` is
   the current highest) with headroom. `.search-dropdown`'s own `z-index: 20`
   is untouched - it still only needs to beat other elements inside `.app-nav`.

Must not break: existing hotkeys still work when focus is anywhere else on
the page (not a form field); the nav bar's own layout/appearance is otherwise
unchanged outside of now always having `position: relative`; ambient mode's
glass look on the nav bar itself is unaffected (only its stacking order
changes).

3. **Dropdown legibility, found after Step 2 shipped.** Now that the
   dropdown actually renders on top (Step 2), its existing ambient-glass
   background - the same shared `--glass-surface: rgba(42, 31, 56, 0.2)`
   token every small chrome control (buttons, the nav bar itself, the
   search input) already uses - turns out to be too transparent for a
   scrollable list of text rows sitting over an arbitrary, colorful ambient
   background; it was never actually visible before Step 2's fix, so this
   is the first time anyone could see it. The other glass elements (nav
   links, toggle/answer/expand buttons, the search input itself) are small
   chrome controls, not dense text panels, and aren't reported as illegible
   - so the fix is scoped to `.search-dropdown` only, not a change to the
   shared token everything else relies on. Add a new `--glass-surface-panel`
   custom property (same hue, notably higher opacity - a "frosted, but
   readable" variant for dense-content glass panels) in `main.css`, and a
   second, more specific rule right after the existing shared block that
   overrides just `.search-dropdown`'s background to use it (same
   `--glass-blur` backdrop-filter, unchanged).

## Build steps

- [x] **Step 1 - Add `useHotkeyGuard` and wire it into all four keydown
  handlers** - New composable `app/composables/useHotkeyGuard.ts`. Add
  `const { isTypingTarget } = useHotkeyGuard();` and an early `if
  (isTypingTarget(event)) return;` at the top of the keydown handlers in
  `StudyMediaPlayer.vue`, `pages/study/index.vue`, `StudyAnswerControls.vue`,
  and `CardPreviewModal.vue`.
  *Done when:* focusing the nav search input and typing "s"/"v"/"i"/"a"/arrow
  keys/Escape does not toggle play/pause, Hide Video, Hide Info, ambient
  mode, pass/fail, or close/collapse anything; the same keys still work as
  before when focus is elsewhere on the page (e.g. clicking the video then
  pressing `s`).

- [x] **Step 2 - Give `.app-nav` an explicit stacking context above the rest
  of the page** - In `NavBar.vue`'s `<style>`, add `position: relative;
  z-index: 100;` to `.app-nav`.
  *Done when:* on `/study` with ambient mode on, opening the search dropdown
  shows it fully on top of the song info panel, matching non-ambient-mode
  behavior; ambient mode's glass look on the nav bar itself is unchanged.

- [x] **Step 3 - Denser glass background for the search dropdown** - In
  `app/assets/css/main.css`: add `--glass-surface-panel` next to
  `--glass-surface` (same rgb hue, higher alpha - a readable-panel variant).
  Add a rule immediately after the existing shared
  `[data-ambient-glass="true"] ...` block: `[data-ambient-glass="true"]
  .search-dropdown { background: var(--glass-surface-panel) !important; }`
  (source order after the shared block breaks the specificity tie in its
  favor; `backdrop-filter` stays whatever the shared rule already set).
  *Done when:* on `/study` with ambient mode on, the open search dropdown's
  text is clearly legible against its background regardless of what's
  playing behind it; every other ambient-glass element (nav bar, search
  input, toggle/answer/expand buttons) still looks exactly as before this
  step.

## Verify

- `bun run build` clean after each step.
- Manual: on `/study`, click into the nav search box and type each hotkey
  letter/arrow key/Escape - confirm nothing on the study page reacts, and the
  characters appear in the search box normally. Then click away from the
  search box (e.g. the video) and confirm the same keys still work as
  hotkeys. Turn on ambient mode, open the search dropdown, confirm it renders
  fully above the info panel instead of being covered.
- No test runner configured in `AGENTS.md`; both are UI/CSS behavior, so this
  rides on manual/browser verification and build evidence.

## Verification evidence

- `bun run build` - clean after every step and at the final safety pass.
- Step 1: dev-server route checks (`/study`, `/cards` -> `200`, no runtime
  error from the new auto-imported composable).
- Step 2: confirmed in compiled CSS output (`.app-nav{z-index:100;...
  position:relative}`).
- Step 3: confirmed in compiled CSS output - the shared rule sets
  `.search-dropdown` to `--glass-surface`, and the new, later rule (same
  selector specificity) overrides it to `--glass-surface-panel`, which
  compiled to `#2a1f38d1` (~82% alpha) as intended.
- Gap: Playwright is not installed in this project, so none of the three
  fixes were clicked through in a live browser - verified by code
  read-through plus the build/CSS/route evidence above.
- Side effect: Escape no longer closes `CardPreviewModal` while typing in its
  own edit-mode fields (song title, paths), a consequence of applying
  Step 1's guard uniformly across all four handlers.

## Findings

None raised against this fix.
