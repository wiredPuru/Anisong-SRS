# Current Feature

## Clickable artist and anime names link to their deck page

**Type:** Fix
**Status:** verified

## The problem

An artist name or anime title shown next to a card is plain text everywhere it
appears. Seeing "Yoasobi" on a card gives no way to reach that artist's other
cards without going to `/decks`, switching to the right tab, and searching for
the name by hand. The grouping page already exists (`/decks?type=artist&id=N`
and `/decks?type=anime&id=N`, features 5 and 35b/c) - nothing points at it.

Two blockers in the current code:

| Blocker | Detail |
|---|---|
| No ids on the wire | `CardWithDetails` (`server/utils/cards.ts`) carries `artistName` and the three anime title fields, but not `artistId`/`animeId`, so no client surface can build a deck link. |
| `/cards` row is a `<button>` | The list row (`app/pages/cards/index.vue:390`) is a button, so a nested link would be invalid HTML. The inspector panel beside it is the clean place instead. |

## The fix

Add `artistId` and `animeId` to the shared card shape, then render the artist
name and anime title as links to that deck's detail page on three surfaces:

1. **`/cards` inspector panel** - `selectedCard.artistName` and
   `selectedCard.animeTitleEnglish` (`app/pages/cards/index.vue:464-465`).
2. **`CardPreviewModal`'s info panel** - `StudyInfoPanel`'s anime title block
   and its Artist row, via new optional props, in both the normal and
   immersive-overlay renders.
3. **`/decks` deck detail card rows** - the
   `{{ artistName }} - {{ animeTitleEnglish }}` sublabel
   (`app/pages/decks/index.vue:857`).

Route format stays the app's existing query-string convention
(`/decks?type=artist&id=N`), built by one shared helper so the three surfaces
cannot drift.

**Must not break:**

- **`/study`'s live info panel stays plain text.** `StudyInfoPanel` is shared
  between Study and Preview, so the links are gated behind optional
  `artist-href`/`anime-href` props that only `CardPreviewModal` passes.
  Deliberately excluded: clicking mid-session would abandon the queue.
- Accepted consequence: `CardPreviewModal` is also reachable *from* `/study`
  (features 51/52 Previous + session log), so a link there does navigate away
  from a session. One component, one behavior - not worth a per-host split.
- `/cards`' row click still selects the card; the row stays a `<button>` and
  gains no nested link.
- Deck detail's existing per-row Preview/Remove/download buttons keep working;
  a link inside the row text must not swallow their clicks.
- Every client-side copy of `CardWithDetails` (8 files) stays field-for-field
  in the server declaration's order, per `coding-standards.md`.

## Build steps

- [x] **Step 1 - carry `artistId`/`animeId` on the card shape.** Add both to
      `CardWithDetails` and `cardSelection` in `server/utils/cards.ts`
      (`artistId: artist.id` before `artistName`, `animeId: anime.id` before
      `animeTitleEnglish`), so every card route returns them from the one shared
      selection. Mirror the two fields, in the same positions, into all eight
      client copies: `app/composables/useStudySession.ts`,
      `app/components/card/CardPreviewModal.vue`, `CardAddAnimeResults.vue`,
      `CardAddSongResults.vue`, `CardAddArtistResults.vue`,
      `app/components/nav/NavSearch.vue`, `app/pages/cards/index.vue`,
      `app/pages/decks/index.vue`.
      **Done when:** `GET /api/cards` returns `artistId` and `animeId` on each
      card, and `bun run build` plus `bun run test` pass.

- [x] **Step 2 - shared deck-link helper.** Add
      `app/utils/deckLinks.ts` exporting `artistDeckPath(id)` and
      `animeDeckPath(id)` returning `/decks?type=artist&id=N` /
      `/decks?type=anime&id=N`, with `deckLinks.test.ts` beside it covering both
      builders (test gate is on - see Testing in `coding-standards.md`).
      **Done when:** `bun run test` passes with the new tests green.

- [x] **Step 3 - link the three surfaces.** `/cards`' inspector artist/anime
      lines and `/decks`' deck-row sublabel become `<NuxtLink>`s using the
      helper; `StudyInfoPanel` gains optional `artistHref`/`animeHref` props
      that wrap its Artist row value and its anime title block in a `NuxtLink`
      when present and render today's plain `<span>` when absent, with
      `CardPreviewModal` passing both in its normal and immersive renders.
      Link styling uses existing `var(--token)` colors, no new tokens.
      **Done when:** the names read as links on all three surfaces, `/study`'s
      own panel is unchanged plain text, and `bun run build` passes.

## Verify

1. `bun run dev`, go to `/cards`, select a card - the inspector's artist name
   and anime title are links; each opens that artist's / that anime's deck
   detail with the right cards listed.
2. Click Preview on that card - artist and anime in the modal's info panel link
   the same way; press `E` for immersive and confirm they link there too.
3. Open a deck on `/decks` - each card row's `Artist - Anime` sublabel links to
   the other grouping; the row's Preview / Remove / Download buttons still
   fire on their own clicks, not the link's.
4. Go to `/study` - the artist name and anime title in the side info panel are
   still plain, unclickable text.
5. `bun run test` and `bun run build` both pass.
