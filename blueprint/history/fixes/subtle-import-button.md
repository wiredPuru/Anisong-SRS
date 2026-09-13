# Current Feature

## Move the list-import button into the Cards header, and quiet it down

**Type:** Fix
**Status:** verified

## The problem

On `/cards`, the "Import from AniList / MyAnimeList" toggle sits alone in its own row between the header and the card table (`nuxt-app/app/pages/cards/index.vue`, `.import-panel` around line 429). It has a cyan `--accent-secondary` pill border and cyan bold text, so it competes with the search box and the table for attention even though it's a rarely used action (feature 58). The row also costs vertical space when collapsed.

## The fix

- **Move the toggle into the header.** Put it in the `.cards-header` grid's right column, which has been empty since the `center-search-bar` fix. Align it to the right end.
- **Make it subtle.** Style it as a ghost button:
  - At rest: no border, `--muted` text, normal weight, 13px.
  - On hover or focus: `--text` color and a `--border` outline.
  - While the panel is open: a quiet active state (border, no fill), following feature 24's border-not-fill rule.
  - Label and state: a shorter label, "Import list", with `aria-expanded` bound to the open state. "Hide import" goes away; the active state shows that the panel is open.
- **Keep the panel where it is.** The username form, status lines, errors, and `CardImportListResults` still render below the header. Render the `.import-panel` wrapper only when the form is open or it has something to show (pending/done status, the blank-username hint, an error, or results). That way the collapsed page has no empty gap, and results that were already showing stay visible after the form is closed, as they do today.

It must not break:

- Import behavior, outage/error messages, or the results picker. This is template and CSS only, apart from the new `v-if` condition.
- The centered search box. The right column is the same width as the left, so the search stays centered.
- The 820px narrow layout. The header stacks, and the button sits on its own line.
- Tokens only. No inline styles.

"Nav bar" is read as the `/cards` page header bar (the top bar with the title and search). It is not the app's left rail, which only holds page links.

## Build steps

1. [x] Move the toggle into the `/cards` header's right column with ghost styling, and gate the panel wrapper on having something to show.
   **Done when:** all of these hold, and `bun run build` passes:
   - At 1920x1080 and 1400x800, `bun run measure /cards` shows the button inside `.cards-header` at its right end, with the search input still centered.
   - No `.import-panel` element exists while collapsed with no results.
   - Clicking the button (`--click .import-toggle`) shows the username form below the header.
   - At 800px the header stacks without overflow.
   - A screenshot shows muted, borderless text at rest.

## Verify

- Open `/cards`: a small, muted "Import list" control sits at the right end of the header, and the table starts directly under the header.
- Click it: the AniList/MyAnimeList form appears below the header. Import a public username and confirm results still show and can be expanded and added.
- Close it with results showing: the results stay.
- Narrow the window below 820px: nothing overlaps.
- No test needed: layout only.
