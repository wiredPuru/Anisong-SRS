# Current Feature

## Title links open the main app in a new tab

**Type:** Fix

**Status:** verified

## The problem

Clicking an anime title or an artist name only opens a page in the main app
(GAQ SRS) from Study and Listen (features 105a and 106). Everywhere else it
either does nothing or stays in the same tab:

- **Party host panel** (`/party/host`, inside `gaq-party`). Now playing, the
  queue (Up next, the queue rows, the Played log) and the Add songs search
  results show titles and artists as plain text. `gaq-party` doesn't serve the
  main app's pages: its control door lets through only `/party/host` and
  `/api/party/**` (`launcher/partyDoors.ts`), so a relative `/cards` link would
  404 there.
- **Card Preview** (`CardPreviewModal`) and the **`/cards` and `/decks`
  inspector** (`CardInspector`) link to the artist and anime deck pages in the
  same tab, which closes the Preview or replaces the list being worked on.

## The fix

Decided with the user:

- **Party links open the separately running main app**, at
  `http://127.0.0.1:3000` by default (the port `gaq-srs` and `bun run dev`
  use). A new `GAQ_PARTY_MAIN_APP_URL` env var overrides it. `gaq-party`'s doors
  don't change, so nothing new is exposed on the LAN.
- **Preview and the Cards inspector switch to new tabs**, keeping today's
  targets (the artist deck and anime deck pages).

Party link targets:

| Shown | Target |
|---|---|
| Anime title, from a queue item | `/cards?q=<romaji>` (`animeCardsSearchPath`, as feature 106) |
| Artist, from a queue item | `/decks?type=artist&id=<artistId>` (`artistDeckPath`) |
| Anime title, from a search result | `/cards?q=<title shown>` |
| Artist, from a search result with no artist id | `/cards?q=<artist name>` |
| Artist group row in Add songs (row id is the artist id) | `artistDeckPath(id)` |

`/cards?q=` also lists Anime, Song and Artist add-candidates, so a title or
artist from outside the library still lands somewhere useful.

How it's built:

- `runtimeConfig.public.mainAppUrl` (default `http://127.0.0.1:3000`). The party
  launcher sets `NUXT_PUBLIC_MAIN_APP_URL` from `GAQ_PARTY_MAIN_APP_URL`, so a
  packaged `gaq-party` picks it up at run time.
- A pure `mainAppHref(base, path)` in `app/utils/deckLinks.ts` joins them,
  coping with a trailing slash on the base.
- `PartyQueueItem` gets an `artistId` (every item is built from a
  `CardWithDetails` in `toQueueItem`), copied into the host view's queue
  entries only. It stays out of `PartyAnswer`, so it never reaches the display
  or a phone, the same way `cardId` doesn't.
- A small `PartyMainAppLink.vue` renders the `<a target="_blank"
  rel="noopener">` with a title along the lines of "Open in GAQ SRS (needs it
  running on this computer)". Where the text is plain (Now playing), the text
  itself becomes the link. Where it sits inside a clickable row (queue rows
  jump, search rows expand), nesting a link in a `<button>` is invalid, so the
  row gets a small "↗" link beside its button, with `@click.stop`.

Must not break:

- The display and player doors and their allowlists. No answer, id or link
  reaches the display or a phone before the reveal.
- Queue drag-to-reorder, tap-to-jump, the Add songs keyboard navigation, and
  the Cue next / Add buttons.
- Study and Listen links, and the inspector's existing rule of showing plain
  text for the deck you're already on (`isCurrentDeck`).

Known limit, accepted: on a phone acting as the host remote, `127.0.0.1` is the
phone itself, so the links do nothing there. They're meant for the computer
running the party.

## Build steps

1. [x] **Preview + inspector open new tabs.** `CardPreviewModal` passes
   `artist-new-tab` and `anime-new-tab` to `StudyInfoPanel`. `CardInspector`'s
   two `NuxtLink`s get `target="_blank" rel="noopener"`.
   **Done when:** clicking the artist or anime in Preview (from `/cards` and
   `/decks`) and in the inspector on both pages opens the deck page in a new tab
   and leaves the original tab as it was.
2. [x] **Party plumbing.** Add `mainAppUrl` to `runtimeConfig.public`, the
   `GAQ_PARTY_MAIN_APP_URL` mapping in `launcher/party.ts`, and `mainAppHref`
   with a test (trailing slash, path joining). Add `artistId` to
   `PartyQueueItem` (`toQueueItem`) and to the host queue entries (`toHostState`
   and the client copy in `usePartyHost.ts`, in the same field order). Add tests
   that the host view carries `artistId` and that the display state doesn't.
   Document the env var in `AGENTS.md`'s party mode command.
   **Done when:** `bun run test` passes with the new tests, and `GET
   /api/party/host/state` shows `artistId` on each queue entry.
3. [x] **Party host links.** Add `PartyMainAppLink.vue` and use it in
   `PartyNowPlaying` (title and artist), `PartyQueueList` (Up next, the queue
   rows, the Played log), and `PartyQueueSearch` (show results, anime and
   artist group rows, the songs inside an opened group, the song results, and
   the catalog results).
   **Done when:** with `bun run party` and the main app running on 3000,
   clicking a title or artist (or its ↗) in each of those places opens the
   matching main-app page in a new tab, while tapping the row itself still
   jumps, expands or adds as before.

## Verify

1. `bun run test` and `bun run build` pass.
2. Main app (`bun run dev`): in `/cards`, select a card. Click its artist in the
   inspector, then its anime: each opens a deck page in a new tab and `/cards`
   keeps its selection. Do the same from Preview, and from a `/decks` detail
   view.
3. Party (`bun run build`, `bun run party`, plus the main app on port 3000):
   load a queue on `/party/host`.
   - Now playing: the anime title opens `/cards?q=<romaji>` and the artist opens
     that artist's deck, each in a new tab.
   - The queue: ↗ on a row opens the anime search; tapping the row still jumps
     to that song, and dragging still reorders.
   - Add songs: search for a show, an artist and a song. Each result's links
     open the right main-app page, and Enter and the arrow keys still drive the
     list.
4. With `GAQ_PARTY_MAIN_APP_URL=http://127.0.0.1:3100`, the links point at port
   3100.
5. The display (`/party/display`) shows no new links and, before the reveal,
   no answer text.
