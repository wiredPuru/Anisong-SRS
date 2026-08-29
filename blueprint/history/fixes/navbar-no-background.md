# Fix: Navbar has no background, in any state

**Type:** Fix
**Status:** verified

## The problem

Feature 15 made the nav bar merely translucent (`color-mix(... 45%, transparent)`
+ `backdrop-filter: blur(10px)`) while `/study`'s Ambient mode is on. That still
visibly blocked part of the ambient glow behind it. Iterating on the fix in
chat, the user first wanted a fully unobstructed glow with the text kept
legible via an outline, then decided plain text was fine, then decided the
bar looks better with no background in any state - not just during Ambient
mode.

**File:** `nuxt-app/app/components/nav/NavBar.vue`

## The fix

Final state: the nav bar (`.app-nav`) has no `background` or `border-bottom`
in any state, default or `/study`'s Ambient mode alike. Nav link text is
plain, no outline/shadow. Because the bar no longer has any state-dependent
styling, `NavBar.vue` no longer needs to know about Ambient mode at all -
removed its `ambient` class binding, deleted the `useAmbientMode.ts`
composable that only existed to share that state with the layout, and
reverted `study/index.vue`'s `ambientMode` to a plain local `ref(false)`,
matching its sibling toggles (`hideVideo`, `hideInfo`, `randomStart`).

Must not break:
- The active-link pill (`var(--accent)` background) - the one element that
  still has its own background, so the current page stays clearly
  indicated even with no bar background.
- `/study`'s actual Ambient-mode glow effect (feature 14/10) - unaffected;
  only the nav bar's own background was ever in scope.

## Build steps

- [x] **Step 1 - Remove ambient-mode background** - in `NavBar.vue`: change
  `.app-nav.ambient` to `background: transparent`, `border-bottom-color:
  transparent`, remove the `backdrop-filter` lines. *Done when:* with
  Ambient mode on and a video card showing the glow, the nav bar has no
  visible background/blur/border and the ambient colors are fully visible
  where the bar used to sit.
- [x] **Step 2 - Drop the text outline/shadow** - tried
  `-webkit-text-stroke` + `text-shadow` on non-active nav links for
  legibility, then removed it at the user's request - plain text is fine.
  *Done when:* `.app-nav.ambient .nav-link` has no outline/shadow rule left
  in `NavBar.vue`.
- [x] **Step 3 - Remove the nav bar background in every state, not just
  Ambient mode** - `.app-nav` itself loses `background: var(--surface)`
  and `border-bottom: 1px solid var(--border)`; the now-redundant
  `.app-nav.ambient` override rule and the `ambient` class binding come
  out entirely, since there's no longer a state-dependent difference to
  express. That also removes NavBar's only reason to know about Ambient
  mode at all, so revert it back to being purely a `/study` concern: drop
  `NavBar.vue`'s `useAmbientMode()` usage, revert `study/index.vue`'s
  `ambientMode` to a plain local `ref(false)` (matching its sibling
  toggles `hideVideo`/`hideInfo`/`randomStart`), and delete the
  now-unused `useAmbientMode.ts` composable. The active-link pill
  (`var(--accent)` background) is unaffected - that's a different element
  from the bar itself. *Done when:* the nav bar has no background/border
  in any state (default and while on `/study` with Ambient mode toggled
  either way), `useAmbientMode.ts` no longer exists, and `study/index.vue`
  has no import of it.

## Verify

- `bun run dev`, confirm the nav bar has no visible background/border on
  every page (`/`, `/study`, `/cards`, `/cards/new`, `/decks`, `/stats`,
  `/settings`), regardless of Ambient mode.
- On `/study`, start a video card and turn Ambient mode on/off: the glow
  is unobstructed either way (the bar never had a background to remove),
  and the nav links (including the active pill) stay legible.
- `grep -rn "useAmbientMode" nuxt-app/app/` returns nothing.
- `bun run build` succeeds with no type errors.
