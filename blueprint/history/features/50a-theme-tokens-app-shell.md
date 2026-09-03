# Feature: Theme tokens + app shell

**From build-plan:** feature 50a
**Status:** verified

## Goal

Port the Akiba Neon palette, type and radii into `main.css`, and replace the
top nav bar with the design's left rail. This is the foundation every other
50x sub-feature builds on: once the tokens carry the new values, every
component that already styles itself with `var(--token)` moves with them, and
the per-screen sub-features only have to change layout.

## Design reference

`blueprint/reference/akiba-neon-canvas.html` - the decoded Claude Design
canvas. Every artboard carries a `data-screen-label` attribute, so open the
file and search for the one you need:

- `1a Home` - the rail in its normal state, with HOME active. This is the
  artboard for this sub-feature.
- `1a Narrow` - the rail collapsed to icons. **Reference only here**, the
  responsive pass is 50h.

The canvas is a mockup, not a component library: it uses inline styles and
literal hex values. Read exact values off it, then express them as tokens.

## In scope

- **Token values in `nuxt-app/app/assets/css/main.css`.** Same token names,
  new values (see Data / contracts - the names are load-bearing).
- **Font swap** in `nuxt-app/nuxt.config.ts`: M PLUS Rounded 1c out,
  RocknRoll One (display) and Zen Kaku Gothic New (body) in, via the same
  Google Fonts `<link>` mechanism already there.
- **`layouts/default.vue`** becomes a two-column shell: fixed-width rail,
  then the content column.
- **`components/nav/NavBar.vue`** becomes that rail - 82px wide, `#0c0c16`
  ground, right border, a 40x40 sakura logo tile with 歌, then one 60px
  icon-over-label item per existing link in its `links` array.
- **Relocating the global search** out of the nav and into a slim strip at
  the top of the content column, so it keeps working on every page. Its
  behavior (features 19b/26/47) is untouched.

## Out of scope

- **Every per-screen layout.** Pages keep their current internal layout and
  their `max-width: 720px` centered columns. The canvas fills the width, but
  that is each screen's own sub-feature (50b-50g), not this one. Expect the
  app to look like the new theme in an old layout after this lands, and that
  is the correct intermediate state.
- **The responsive/narrow pass** - 50h.
- **Any behavior change.** No route, endpoint, component API, or stored shape
  changes. Search, study, playback and every toggle behave exactly as today.
- **Feature 14's ambient glow logic.** It samples colors from the video or
  cover art at runtime, so it is unaffected by token values. It will simply
  read as cyan-adjacent where it previously read purple, because
  `--accent-secondary` changed.
- **Removing the glass treatment** (feature 24). Its tokens get new values
  here; whether frosted glass still suits the arcade direction is a question
  for 50b, where the study player actually shows it.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Token values + fonts.** Change the values in `main.css`'s
  `:root` block and swap the Google Fonts link in `nuxt.config.ts`. Touch no
  markup and no component styles. Derive the glow and glass tokens from the
  new accents rather than leaving them on the old purple.
  *Done when:* `bun run dev` renders every page in the new palette with no
  console errors; text is RocknRoll One / Zen Kaku Gothic New; panel corners
  are visibly tight rather than 18px; the study player's glass surfaces still
  read as frosted rather than opaque or invisible; no component shows a
  hard-coded purple that the tokens failed to reach.

- [x] **Step 2 - Rail shell.** Turn `layouts/default.vue` into a flex row
  (rail + content column, content scrolling independently) and restyle
  `NavBar.vue`'s template and `<style>` block into the vertical rail: logo
  tile, then one item per link with its glyph above its label. Active item
  gets `#16162a` fill, a 1px `--accent` border and `--accent` text - a border
  and glow, matching the convention feature 24 set for active states. Leave
  the search markup in place inside the rail for this step even though it
  looks wrong there; moving it is Step 3, and splitting the two keeps both
  diffs readable.
  *Done when:* the rail sits on the left at 82px on every page, all links
  navigate, the current page's item shows the active treatment, and no page
  content is hidden behind or overlapped by the rail.

- [x] **Step 3 - Search relocation.** Move the search input and its dropdown
  out of the rail into a strip at the top of the content column, inside the
  layout. Keep the component's script, its state, and its emit/navigation
  behavior byte-for-byte; this is a markup and CSS move, not a rewrite.
  *Done when:* typing 2+ characters from any page still shows the Cards,
  Anime and Artist groups; Enter still lands on `/cards?q=`; Escape still
  closes the dropdown; clicking outside still closes it; and the dropdown
  still gets its denser background under ambient glass (see the note about
  that selector below).

## Files / areas

- `nuxt-app/app/assets/css/main.css` - token values (Step 1); check the
  `[data-ambient-glass="true"] .search-dropdown` rule still matches after
  Step 3.
- `nuxt-app/nuxt.config.ts` - the Google Fonts `<link>` (Step 1).
- `nuxt-app/app/layouts/default.vue` - two-column shell (Step 2), search
  strip (Step 3).
- `nuxt-app/app/components/nav/NavBar.vue` - template and `<style>` only
  (Steps 2 and 3). Its `<script setup>` should come out of this feature
  unchanged.

## Data / contracts

**Load-bearing: the token names do not change.** Every component in the app
styles itself with `var(--bg)`, `var(--accent)`, `var(--radius)` and so on.
Keeping the names and changing only the values is exactly what makes Step 1 a
small diff and the rest of the app move for free. Renaming or removing a
token would break components this feature never opens.

Measured from the canvas (current value -> new value):

| Token | Current | New |
|---|---|---|
| `--bg` | `#150f1c` | `#07070d` |
| `--surface` | `#1f1729` | `#12121f` |
| `--surface-raised` | `#2a1f38` | `#16162a` |
| `--border` | `#392c4a` | `#23233c` |
| `--text` | `#f5eef8` | `#f2f0ff` |
| `--muted` | `#ab9abf` | `#8c88b0` |
| `--faint` | `#6d5c82` | `#5b5880` |
| `--accent` | `#ff5da2` | `#ff3e88` |
| `--accent-strong` | `#ff3d94` | `#ff5470` |
| `--accent-ink` | `#2b0f1c` | `#07070d` |
| `--accent-secondary` | `#b18cff` | `#34e7e4` |
| `--pass` | `#7ee2b8` | `#46e39b` |
| `--fail` | `#ff6b6b` | `#ff5470` |
| `--radius` | `18px` | `6px` |
| `--radius-sm` | `10px` | `4px` |
| `--radius-pill` | `999px` | unchanged |
| `--font-sans` | M PLUS Rounded 1c | Zen Kaku Gothic New |

Derived tokens with no direct canvas equivalent - recompute rather than
copy: `--accent-glow`, `--accent-secondary-glow`, `--accent-secondary-ink`,
`--glass-surface`, `--glass-surface-panel`, `--glass-border`,
`--shadow-soft`, `--shadow-accent`.

A display face is new: the canvas uses RocknRoll One for headings and the
logo, Zen Kaku Gothic New for body and labels. Add `--font-display` rather
than overloading `--font-sans`.

Rail geometry, read off the `1a Home` artboard: rail 82px wide, `#0c0c16`,
1px right border in `--border`, 18px vertical padding, 6px item gap. Logo
40x40, `--radius`, `--accent` ground, `--accent-ink` glyph, 19px display
face, 14px bottom margin. Item 60px wide, 10px vertical padding,
`--radius`, 5px gap, 17px glyph over a 10px/700 label with 0.5px tracking.
Glyphs: ◈ HOME, ▶ STUDY, ▤ CARDS, ◫ DECKS, ◲ STATS, ⚙ SET - plain text, no
icon font to add.

No schema, route, endpoint or stored shape changes.

## Testing

No test runner is configured (`AGENTS.md` declares no `test` command), and
this feature adds no logic worth unit testing - it is token values and
markup. It rides on browser and build evidence, per the Testing gate in
`coding-standards.md`.

- After Step 1, walk `/`, `/study`, `/cards`, `/decks`, `/stats`,
  `/settings` and confirm the palette, type and radii changed everywhere with
  no page left visibly on the old theme.
- Check the two surfaces most likely to break on a token change: the study
  player under ambient mode (glass) and the nav search dropdown (which has
  its own `!important` background rule).
- After Steps 2 and 3, click every rail link and run a search from at least
  two different pages.
- `bun run build` passes at the end of each step.

## Not yet verified in a browser

**Merged without this check, by explicit user decision on 2026-09-02.** The
gap was raised at `/complete` and the user chose to merge and carry it into
50b rather than browser-verify first. It is not a silent omission, and 50b
opens `/study` first thing, which is where the highest-risk item below lives.

Everything below passed on server-side evidence only. `/complete`'s final
safety pass re-confirmed that evidence: `bun run build` clean; `/`, `/study`,
`/cards`, `/decks`, `/stats`, `/settings` all 200 off the built server; the
served CSS carrying `--bg:#07070d`, `--surface:#12121f`, `--accent:#ff3e88`,
`--accent-secondary:#34e7e4`, `--radius:6px` and `--font-display:"RocknRoll
One"`; and `app-shell` / `app-nav` / `app-topbar` present in the served
markup. No Playwright is installed and none was added, so actual **rendering**
is still unconfirmed. Carry these into 50b:

- **`/study` with a real card, expanded and immersive.** Highest risk in the
  feature. `useNavHeight` now returns 0 because the rail takes no vertical
  space, and `StudyMediaPlayer` still uses it as `--nav-height` for `top:`
  and for `100vh - var(--nav-height)`. The math should be correct, but it was
  never exercised - it needs study data to render at all.
- **The search dropdown stacking.** Moving it out of the rail cost it
  `.app-nav`'s z-index; `.app-topbar` now supplies one. Confirm results draw
  above page content, not behind it.
- **Ambient mode on `/study`.** Glass over the much darker ground, plus the
  rail's active item now going glass with it (it used to be excluded).
- **The rail itself** - active tab outlined in sakura, no 2px jump between
  pages.

## Notes for the AI

- **Read values off the artboard, don't invent them.** Open
  `blueprint/reference/akiba-neon-canvas.html`, find
  `data-screen-label="1a Home"`, and work from the inline styles there.
- **"Purple glow gone" is this token swap, not a feature removal.** It means
  `--accent-secondary` goes purple to cyan. Feature 14's ambient video glow
  stays exactly as it is.
- The app already loads fonts from Google Fonts over the network, so swapping
  families changes nothing about the packaged binary's offline behavior: it
  falls back to `system-ui` without a network either way. Keep a real
  fallback stack on both faces.
- `NavBar.vue` is 431 lines, but almost all of it is the search dropdown's
  script. Steps 2 and 3 should not need to touch `<script setup>` at all. If
  a diff starts rewriting that logic, the step has gone off course.
- Expect the intermediate state to look unbalanced: new theme, old 720px
  centered page layouts. That is correct after 50a and is fixed per screen in
  50b-50g. Do not start widening pages here.
- Keep the existing conventions: scoped `<style>` blocks, `var(--token)`
  everywhere, never a hard-coded color.
