# Feature: Global search

**From build-plan:** feature 19b

**Status:** verified

## Goal

An autocomplete search box in the persistent nav bar, searching across
cards, artists, anime, and manual ("Created") decks at once. Selecting a
result jumps straight to it - no separate results page, no interaction
with 19a's pagination.

## In scope

- `GET /api/search?q=` - case-insensitive substring match (SQLite `LIKE`
  is ASCII-case-insensitive by default, and substring matching works on
  non-ASCII text like Japanese titles regardless) against: card song
  titles, artist names, anime titles (English, Romaji, *and* Native - a
  match on any one counts), and manual deck names. Capped at 5 results per
  category (20 total, worst case). A query under 2 characters (after
  trimming) returns all-empty without touching the database.
- A search input in `NavBar.vue`, debounced (250ms) as you type, showing a
  dropdown grouped by category (only categories with at least one result
  get a group). Loading and error states are both handled explicitly, not
  just the happy path.
- Selecting a result navigates and clears the search box:
  - Artist / Anime / manual Deck -> `/decks?type=<type>&id=<id>`, all
    already-working routes.
  - Card -> no card has its own page, so this reuses `/cards`' existing
    `CardPreviewModal`: the selected card's full data (the search response
    already returns the same shape `CardPreviewModal` needs) is handed off
    via a small shared `useState`, then `/cards` opens the Preview modal
    for it on load.
- Clicking outside the dropdown, or Escape, closes it without navigating.

## Out of scope

- Arrow-key navigation within the dropdown (up/down to highlight, Enter to
  select) - click-only, matching "click one to jump" as scoped.
- Escaping literal `%`/`_` wildcard characters in the user's query before
  building the `LIKE` pattern - a query containing one of those characters
  matches slightly more broadly than a literal search would. Cosmetic, not
  a security issue (the query is still parameterized, never
  string-concatenated into SQL); not worth the complexity here.
- Fuzzy or typo-tolerant matching - plain substring only.
- Searching review history, stats, or settings - only the four categories
  the build-plan line names.
- A dedicated "see all results" page beyond the capped dropdown - the
  scoping interview explicitly chose a standalone dropdown over a page
  that interacts with pagination.
- Highlighting the matched substring within result text.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server: `/api/search`** - add `searchCards(query: string):
  CardWithDetails[]` to `server/utils/cards.ts` (reuses the existing
  internal `cardQuery()` builder, `.where(like(song.title, ...))`,
  `.limit(5)`), and `searchArtists`, `searchAnime`, `searchManualDecks` to
  `server/utils/decks.ts` (each a plain `id`+name-ish shape, `LIKE`
  against the relevant name/title column(s), `.limit(5)`). Add
  `server/api/search.get.ts` aggregating all four into `{ cards, artists,
  anime, decks }`, short-circuiting to all-empty arrays when the trimmed
  `q` is under 2 characters. *Done when:* `curl
  /api/search?q=<2+ chars matching something in each category>` returns
  the right rows in each bucket, capped at 5 each; `?q=` (empty) and
  `?q=a` (1 char) both return all-empty without erroring; results are
  case-insensitive (`?q=NARUTO` matches "Naruto").

- [x] **Step 2 - Client: search dropdown in `NavBar.vue`** - a text input,
  debounced (250ms) `$fetch` to `/api/search`, a dropdown grouped by
  category (Cards / Artists / Anime / Decks, each shown only when
  non-empty), explicit loading/error/no-results states, close on Escape or
  a click outside (a `mousedown` listener on `window` checking against a
  container ref). Selecting an Artist/Anime/Deck result clears the search
  box, closes the dropdown, and navigates to
  `/decks?type=<type>&id=<id>`. Selecting a Card result stores the card
  (the exact object already returned by the search response) into a
  shared `useState<CardWithDetails | null>("pendingCardPreview", () =>
  null)`, then navigates to `/cards` - Step 3 makes `/cards` actually pick
  this up. *Done when:* in the browser, typing 2+ characters shows a
  grouped dropdown that updates as you type; typing a 1-character or empty
  query shows no dropdown; a 2+ character query matching nothing shows an
  explicit "No results" state, not an empty-looking dropdown; clicking an
  Artist/Anime/Deck result lands on the right deck detail view with an
  empty, closed search box; clicking outside or pressing Escape closes the
  dropdown without navigating. `bun run build` stays clean.

- [x] **Step 3 - Client: `/cards` picks up a pending card preview** - in
  `app/pages/cards/index.vue`, `watch` the same
  `useState<CardWithDetails | null>("pendingCardPreview", () => null)`
  with `{ immediate: true }` (not a one-time `onMounted` check - see
  Notes for the AI for why that would miss a real case here): whenever it
  holds a card, set it as the open `previewCard` and clear the state back
  to `null` (so a plain reload or later visit to `/cards` doesn't reopen
  it). *Done when:* in the browser, searching for a card and selecting it
  lands on `/cards` with that card's Preview modal already open;
  searching for a *different* card while already sitting on `/cards`
  (no route change, no remount) still opens the new card's preview;
  navigating to `/cards` normally (nav link, no pending card) behaves
  exactly as before - no modal auto-opens.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `searchCards`.
- `nuxt-app/server/utils/decks.ts` - `searchArtists`, `searchAnime`,
  `searchManualDecks`.
- `nuxt-app/server/api/search.get.ts` - new.
- `nuxt-app/app/components/nav/NavBar.vue` - the search input + dropdown.
- `nuxt-app/app/pages/cards/index.vue` - pending-preview pickup.

## Data / contracts

```ts
GET /api/search?q=<string>
  -> {
    cards: CardWithDetails[];   // same shape as /api/cards, up to 5
    artists: { id: number; name: string }[];               // up to 5
    anime: { id: number; titleEnglish: string; titleRomaji: string; coverImageUrl: string | null }[]; // up to 5
    decks: { id: number; name: string }[];                 // manual decks only, up to 5
  }
```

Shared client state (load-bearing between Steps 2 and 3):

```ts
useState<CardWithDetails | null>("pendingCardPreview", () => null);
```

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test`
entry). Step 1 rides on `curl` evidence against the dev server - the
2-character threshold and per-category capping are pure logic with clear
right/wrong answers, a good candidate to backfill once `/tests` sets up a
runner. Steps 2/3 are client interaction - no browser tool has been
available all session, so I'll verify what SSR HTML and `bun run build`
can confirm and flag the rest for a manual pass, consistent with every
other UI step this whole conversation.

## Notes for the AI

- `cardQuery()` in `cards.ts` is a local (unexported) function - call it
  from `searchCards` within the same file, don't export/re-import it.
- Reuse `like` from `drizzle-orm`, same import source already used
  elsewhere in these files.
- The `useState` key (`"pendingCardPreview"`) must match exactly between
  Steps 2 and 3 - Nuxt's `useState` is keyed by string, and a mismatched
  key silently creates two unrelated pieces of state instead of erroring.
- Step 3 must be a `watch(..., { immediate: true })`, not a one-time
  `onMounted` check. `navigateTo("/cards")` from Step 2 is a no-op route
  change when you're already on `/cards` (searching for a second card
  without leaving the page first) - Vue Router won't remount the page
  component for an identical path, so `onMounted` simply wouldn't fire
  again. A reactive watch on the state itself fires whether the page just
  mounted or was already sitting there.
- Don't add the pending-preview `useState` read to any page other than
  `/cards` - it's specifically about seeding that page's existing
  `previewCard` ref, not a general-purpose mechanism.
