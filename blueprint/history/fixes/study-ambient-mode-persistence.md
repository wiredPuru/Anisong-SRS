# Fix: Ambient mode persistence, desktop default, and hotkey

**Type:** Fix
**Status:** verified

## The problem

`/study`'s Ambient mode toggle (`ambientMode` in `study/index.vue`) is
session-only by design today, matching Hide Video/Hide Info/Start at
random times - it always starts `false` and forgets the choice on
refresh. Three related gaps:

1. It doesn't persist across a page reload, even though (unlike the other
   session toggles) there's no real reason a user wouldn't want their
   ambient preference to stick.
2. It has no sensible default - always starts off, even on a desktop
   viewport where the ambient glow (feature 14) and glass surface
   (feature 24) are the intended showcase.
3. It has no keyboard hotkey, unlike Hide Video (`v`) and Hide Info (`i`)
   in the same toggle row - `StudyDisplayToggles.vue`'s hotkeyed buttons
   each show a tooltip naming their key; Ambient mode currently has
   neither.

## The fix

- Add `localStorage` persistence for `ambientMode` (key
  `gaqSrs:studyAmbientMode`), using the same best-effort try/catch pattern
  already used for `gaqSrs:previewAmbient` and `gaqSrs:playerVolume`.
- On mount, if no stored value exists yet, default `ambientMode` to
  `window.innerWidth > 820` - the same breakpoint `.study-grid` already
  uses to distinguish desktop from the responsive one-column layout, so
  "desktop" means the same thing everywhere in this component tree. This
  is a one-time default at mount, not a live/reactive check - resizing
  the window mid-session does not retroactively flip it.
- Once a stored value exists (the user has toggled it, or it was set via
  the desktop default), that stored value always wins on future loads,
  overriding the desktop-default logic entirely.
- Add an `a` hotkey to `study/index.vue`'s existing `onKeydown` handler
  (alongside `i`/`v`), and a matching tooltip (`Hotkey: A`) on the
  "Ambient mode" button in `StudyDisplayToggles.vue`, following the exact
  same pattern as Hide Video/Hide Info.

**Must not break:** the existing `watch(ambientMode, ...,
{ immediate: true })` that syncs `useAmbientGlass()` (feature 24) currently
fires once immediately at setup, while `ambientMode` still holds its
initial `false` value, before `onMounted` has a chance to read the real
stored value. If persistence writes happen inside that same immediate
watch, the initial spurious fire would write `"0"` to `localStorage`
*before* `onMounted` reads it back - permanently clobbering any real
stored `"1"` on every single page load. The fix removes `{ immediate: true }`
from that watch (the `setAmbientGlass` sync still fires correctly on every
real change, including the one `onMounted` makes when restoring a stored
or default value - it just doesn't need to fire redundantly at t=0 when
the value can't have changed yet), and does the `localStorage.setItem`
call inside that same non-immediate watch callback.

## Build steps

- [x] **Step 1 - Persist ambient mode, default it for desktop, add the
  hotkey + tooltip**
  - `nuxt-app/app/pages/study/index.vue`:
    - Remove `{ immediate: true }` from the existing
      `watch(ambientMode, (value) => setAmbientGlass(value))` call, and
      extend its callback to also best-effort
      `localStorage.setItem("gaqSrs:studyAmbientMode", value ? "1" : "0")`
      in a try/catch.
    - Add a new `onMounted` that best-effort reads
      `localStorage.getItem("gaqSrs:studyAmbientMode")`: if it's `"1"` or
      `"0"`, set `ambientMode.value` accordingly; if it's `null`
      (never set), default to `window.innerWidth > 820`. Same
      try/catch-and-fall-back pattern as everywhere else in this codebase
      that touches `localStorage`.
    - Extend the existing `onKeydown` function: add
      `else if (key === "a") { ambientMode.value = !ambientMode.value; }`.
  - `nuxt-app/app/components/study/StudyDisplayToggles.vue`: add
    `<span class="tooltip">Hotkey: A</span>` inside the "Ambient mode"
    button, matching the existing Hide Video/Hide Info buttons exactly.

  *Done when:* turning Ambient mode on, then reloading `/study`, shows it
  still on; turning it off and reloading shows it still off; on a fresh
  browser profile (no stored value - test via a private/incognito window
  or clearing site data) with the window wider than 820px, Ambient mode
  starts on by default; narrower than 820px, it starts off; pressing `a`
  toggles it and the button shows a "Hotkey: A" tooltip on hover/focus,
  matching Hide Video/Hide Info's existing style.

## Verify

- No test runner configured; this is UI/localStorage-only (no new
  branching logic beyond a two-value read and a viewport-width check,
  the same shape as other untested toggle-persistence code in this app) -
  rides on browser/manual evidence.
- Manual check: open `/study`, toggle Ambient mode on, reload the page,
  confirm it's still on. Toggle it off, reload, confirm it's still off.
  Clear site data (or use a private window) and confirm the default
  matches the window-width rule. Press `a` and confirm it toggles with
  the same visual feedback as clicking it; hover/focus the button and
  confirm the "Hotkey: A" tooltip appears.
- `bun run build` clean.

Verified via automated Playwright checks (ad hoc, not a project
dependency): fresh+wide viewport defaults on, fresh+narrow defaults off,
toggling on in a narrow viewport (which would default off) survives a
reload - confirming persistence overrides the default rather than
coincidentally matching it - the `a` hotkey toggles correctly, and the
tooltip renders. No console errors.
