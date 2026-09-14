# Center the Decks header controls

**Type:** Fix

**Status:** verified

**Branch:** `fix/center-decks-header-controls`

**Completed:** 2026-09-14

## The problem

On `/decks` the most-used controls sit at the far right edge of the top bar:
the By title / By artist / Created tabs and the Study all button. On a wide
monitor that puts them well over a thousand pixels from the search box and
from the middle of the poster grid the user is looking at.

`.decks-header` (`app/pages/decks/index.vue:1095`) is a three-column grid,
`1fr minmax(0, 520px) 1fr`: the page title on the left, the 520px search box
alone in the center column, and `.header-controls` in the right column with
`justify-content: flex-end`. A selected deck's detail view shares the same
header classes, so its "Study this deck" button is pinned far right too.

## The fix

Group the search box and the controls into one centered row, on both headers.

Decided with the user:

- **One centered row**, not two rows and not a swap: search, tabs, and Study
  all sit together in the middle of the top bar, keeping the header one row
  tall.
- **The detail view matches.** Back to decks stays left; its search and
  "Study this deck" form the same centered group, so Study sits in the same
  place on both screens.

Approach:

- New `.header-center` wrapper holds the search input and `.header-controls`
  in both headers. `.decks-header` becomes `1fr auto 1fr`, with the left
  column holding the title (or Back to decks) and the right column left empty
  as a spacer. An empty matching right column is what keeps the group truly
  centered on the page rather than centered in the leftover space.
- The search box flexes inside the group (`flex: 1 1 320px`, `max-width:
  520px`), so the group shrinks on a narrower window before anything crowds
  the title.
- `.header-controls` drops `justify-content: flex-end`, since it no longer
  lives at the right edge.
- At the existing 820px breakpoint the header stays one column, and the group
  wraps (search on its own line, tabs and Study below it), extending the
  current narrow-window rule rather than adding a new breakpoint.

Must not break:

- Tab switching, Study all, Study this deck, and both search boxes.
- The detail view hides "Study this deck" until `deckLabel` loads; the group
  must not jump or leave an odd gap while it is hidden.
- No horizontal overflow at any width. Feature 57's 2560px content cap still
  applies above that width.

Out of scope: `/cards` and `/stats` headers, which have their own layouts.

## Build steps

### Step 1 - centered group on both Decks headers  (done)

- `app/pages/decks/index.vue`: wrap each header's search input and
  `.header-controls` in `<div class="header-center">`; add the right-hand
  spacer; update `.decks-header`, add `.header-center`, adjust
  `.header-controls`, and extend the 820px rule so the group wraps.

**Done when:** `bun run measure` shows `.header-center` horizontally centered
in `.decks-header` (left and right gaps within a few pixels) on both the grid
and a deck's detail view at 1920 and 2560 wide, nothing in the header
overflowing at 1100 and 820 wide, and a screenshot at 1920 shows search, tabs,
and Study all together in the top middle.

## Verify

1. `cd nuxt-app && bun run build` - completes. (No logic, so no new test.)
2. `bun run dev`, open `/decks` on a wide window: search, By title / By artist /
   Created, and Study all sit together in the middle of the top bar.
3. Switch tabs and click Study all - both still work.
4. Open a deck: Back to decks on the left, its search and "Study this deck"
   centered, and Study this deck opens that deck's session.
5. Narrow the window to about 1100px, then below 820px: nothing overlaps or
   scrolls sideways; below 820px the group wraps onto separate lines.

## Notes from the build

- Measured gap left/right of `.header-center`: 799.2/799.2 at 2560 and
  479.2/479.2 at 1920 on the grid; 899.9/899.9 and 579.9/579.9 on a deck's
  detail view. Wraps below 820px with no overlap.
- Around 1100px the grid header's group sits 59px right of centre: the title
  column cannot shrink past "Decks" while the empty spacer can. No overlap;
  exact from about 1200px up.
- "Study this deck" is now always rendered and hidden with `visibility` until
  `deckLabel` loads, instead of `v-if`, so the centred group keeps its width
  and does not shift when the label arrives.
