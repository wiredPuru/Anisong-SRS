# Feature: Decks by Artist/Title

**From build-plan:** feature 5
**Status:** verified

## Goal

Let cards be browsed as automatic, query-time "decks" grouped by artist or
by anime title - no separate deck entity, exactly as
`project-overview.md`'s Data model section locks in ("No Deck table...
Deck screens query `Card` joined through `Song` by `artistId` or by
`animeId`"). A `/decks` page lists these groupings and lets you drill into
one to see its cards. Read-only browsing only; card management stays on
`/cards` (feature 4).

## In scope

- `GET /api/decks?type=artist|anime` - list decks of the requested kind,
  each with a card count; only artists/anime that have at least one card
  appear (an imported artist/anime with zero cards isn't a deck yet)
- `GET /api/decks/cards?type=artist|anime&id=<number>` - the cards inside
  one deck, joined the same way `/cards` already displays them, plus a
  `deckLabel` for the page heading (works even as a fresh deep link, not
  just after browsing the list first)
- `/decks` page - toggle between "By Artist" and "By Anime", list of decks
  with names/titles and card counts, click through to a deck's card list,
  back to the deck list; current selection reflected in the URL query
  string (`?type=artist&id=3`) so a deck view is shareable/bookmarkable and
  the browser back button works
- Locking the `{ type: "artist" | "anime", id: number }` deck-identifier
  shape now - feature 6 (Study session) needs to scope a review queue "by
  deck," and this is the natural reference for that

## Out of scope

- Any card editing/deleting from within a deck view - that's `/cards`'s
  job (feature 4); the deck card list here is read-only display (song
  title, theme slot, which sources are attached), not the inline-edit rows
  `/cards` has
- A stored `Deck` entity, manual deck curation, renaming, or reordering -
  explicitly ruled out by the locked data model
- Actually starting a study session scoped to a deck - feature 6 owns that;
  this feature only defines and exposes the deck identifier shape it will
  need
- Sorting/filtering decks beyond alphabetical by name/title - no stated
  need for anything fancier yet
- Any change to `Card`, `Song`, `Artist`, or `Anime` - purely additive
  read queries over what already exists

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Deck server routes** - add `nuxt-app/server/utils/decks.ts`
  (`listArtistDecks(): ArtistDeck[]`, `listAnimeDecks(): AnimeDeck[]`, each
  grouping from `card` inward via inner joins so only artists/anime with
  >=1 card appear, ordered alphabetically), extend
  `nuxt-app/server/utils/cards.ts` with two new exports
  (`listCardsByArtist(artistId)`, `listCardsByAnime(animeId)`) reusing its
  existing private `cardQuery()` builder, and add
  `nuxt-app/server/api/decks.get.ts` (`?type=`) and
  `nuxt-app/server/api/decks/cards.get.ts` (`?type=&id=`). *Done when*,
  against a running dev server: with song id `1` ("Seishun Complex" / OP1
  / Kessoku Band / Bocchi the Rock!, already in the DB) and one card
  created for it (`curl -X POST -d
  '{"songId":1,"animethemesVideoUrl":"https://v.animethemes.moe/x.webm"}'
  -H 'content-type: application/json' localhost:3000/api/cards`):
  `curl 'localhost:3000/api/decks?type=artist'` includes `{"id":1,"name":
  "Kessoku Band","cardCount":1}`; `curl 'localhost:3000/api/decks?type=anime'`
  includes the Bocchi the Rock! anime row with `"cardCount":1`;
  `curl 'localhost:3000/api/decks?type=nonsense'` returns `400`;
  `curl 'localhost:3000/api/decks/cards?type=artist&id=1'` returns `200`
  with `deckLabel:"Kessoku Band"` and one card with `songTitle:"Seishun
  Complex"`; `curl 'localhost:3000/api/decks/cards?type=artist&id=999999'`
  returns `404`; deleting the test card afterward (`curl -X DELETE -d
  '{"id":<created id>}' ...`) makes `localhost:3000/api/decks?type=artist`
  go back to not including Kessoku Band; build + `tsc --build` clean.
- [x] **Step 2 - `/decks` list view** - add `nuxt-app/app/pages/decks/index.vue`:
  a By Artist/By Title toggle (default By Artist, `type=anime` internally
  since that's the DB-level term, but labeled "By Title" in the UI to
  match this feature's own name - "Decks by Artist/Title"), reflected in
  `?type=`, fetches `GET /api/decks` for the active type, renders each
  deck's name/title and card count, empty state when there are no decks of
  that type yet. Follows the established conventions from `settings.vue`/
  `cards/index.vue`: `useFetch`, explicit loading and fetch-error states
  (not just the happy path), scoped `<style>` using `var(--token)`. *Done
  when:* with at least one card in the DB, loading `/decks` shows the By
  Artist list with that artist and its count; switching to By Title shows
  the anime grouping instead and updates the URL to `?type=anime`; a type
  with zero decks shows an empty state, not a blank area; build + `tsc
  --build` clean.
- [x] **Step 3 - deck detail view** - extend `decks/index.vue` (or split
  out a detail section within the same page - implementer's call, but
  still one file) so clicking a deck fetches `GET /api/decks/cards` for
  its `{type, id}`, sets `?id=` in the URL alongside `?type=`, and renders
  the deck's `deckLabel` as a heading plus each card's song title, theme
  slot, and which sources are attached (read-only - no edit/delete
  controls here); a "back to decks" control clears `?id=` and returns to
  the list. Loading `/decks?type=artist&id=1` directly (a fresh page load,
  not a click-through) must also work, proving the URL round-trips.
  *Done when:* clicking a deck shows its card(s) with the correct heading
  and song details; the URL reflects the selection; loading that same URL
  fresh (simulated via a direct `curl` of the SSR'd route plus the
  `/api/decks/cards` call it depends on) renders the same deck; "back"
  returns to the list; build + `tsc --build` clean.

## Files / areas

- `nuxt-app/server/utils/decks.ts` - new
- `nuxt-app/server/utils/cards.ts` - add `listCardsByArtist`,
  `listCardsByAnime`
- `nuxt-app/server/api/decks.get.ts` - new
- `nuxt-app/server/api/decks/cards.get.ts` - new
- `nuxt-app/app/pages/decks/index.vue` - new

## Data / contracts

No schema changes - pure read queries over `Card`/`Song`/`Artist`/`Anime`,
consistent with the locked "no Deck table" data model decision.

**Deck identifier shape** (load-bearing - feature 6 will reference this to
scope a study queue to one deck):

```ts
type DeckRef = { type: "artist"; id: number } | { type: "anime"; id: number };
```

**Deck list shapes:**

```ts
interface ArtistDeck { id: number; name: string; cardCount: number; }
interface AnimeDeck { id: number; titleEnglish: string; titleRomaji: string; cardCount: number; }
```

**API contract**

- `GET /api/decks?type=artist` -> `200 { decks: ArtistDeck[] }`, alphabetical
  by `name`.
- `GET /api/decks?type=anime` -> `200 { decks: AnimeDeck[] }`, alphabetical
  by `titleEnglish`.
- `GET /api/decks` with a missing/invalid `type` -> `400`.
- `GET /api/decks/cards?type=artist&id=<n>` -> `200 { deckLabel: string,
  cards: CardWithDetails[] }` (reusing feature 4's `CardWithDetails`
  shape); `deckLabel` is the artist's `name` or the anime's
  `titleEnglish`. `400` if `type` isn't `artist`/`anime` or `id` isn't a
  number. `404` if no `Artist`/`Anime` row with that id exists at all
  (distinct from "exists but has zero cards," which is `200` with `cards:
  []` - an edge case reachable only by a hand-built URL, since the deck
  list itself never links to a zero-card deck).

## Testing

Still no test runner configured. This feature is entirely read-side
grouping logic with no destructive operations, so the curl sequence in
Step 1 (including the "zero cards after delete" check) is the real
coverage - proving the inner-join grouping actually excludes
cardless artists/anime, not just that it includes ones with cards. Steps 2
and 3 are UI and ride on browser/SSR evidence plus build, per the scope
rule in `coding-standards.md`.

## Notes for the AI

- Reuse `cards.ts`'s existing private `cardQuery()` builder for the two new
  `listCardsBy*` functions rather than duplicating the join - that's
  exactly why feature 4 flagged `CardWithDetails` as load-bearing.
- Drizzle's `count()` aggregate (from `drizzle-orm`) plus `.groupBy()` is
  the natural way to build `listArtistDecks`/`listAnimeDecks`; starting the
  query `.from(card)` and inner-joining outward is what makes "only
  artists/anime with a card" fall out for free, with no separate
  `HAVING`/filter step needed.
- No dynamic route segments (`[id].ts`) exist anywhere in this codebase;
  stay with query-string parameters (`?type=&id=`) for both the API and
  the page, consistent with that existing convention.
- `/decks` is read-only. Resist the urge to add edit/delete affordances to
  the deck card list just because `cards/index.vue` has them right there
  to copy from - that duplication is deliberate scope, not an oversight.
- The deck-identifier shape (`{ type, id }`) is intentionally simple and
  matches the URL query shape directly - don't invent a different internal
  representation that then needs translating at the API boundary.
