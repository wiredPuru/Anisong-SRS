# Current Feature

## Party queue search: Cue next, Add to end, arrow keys, and Download

**Type:** Fix

**Status:** in progress

## The problem

This is the party host panel's "Add songs" search (`app/components/party/PartyQueueSearch.vue`,
inside `PartyHostDashboard`). With a game running from a deck, from all cards,
or from an endless queue, searching for a song and pressing **Play next** or
**Add** often does nothing useful:

1. **Songs already in the playlist can't be moved.** A deck or All-cards game
   loads every song of that scope, so most library search results are already
   queued somewhere later. Those rows show "In queue" with no buttons, and the
   server's `load` with `append` (`runPartyCommand` in
   `server/utils/partyStore.ts` and the reducer in `server/utils/partyGame.ts`)
   drops any card id already in the queue, including songs played earlier. So
   "play this next" is impossible for the exact songs the host is most likely
   to search for.
2. **Play next isn't atomic.** The client appends with `load`, then sends one
   `queueMove` per song, using `queue.length` and `index` from its own copy of
   the state. If the server state moved in between (an endless top-up landing,
   the song advancing, an SSE update not yet received), the moves use stale
   positions and the song lands in the wrong place or stays at the bottom.
   `addCatalog` has the same two-request pattern.
3. **No keyboard use.** The results can only be clicked. Study's answer boxes
   (`StudySongAnswer.vue`, `StudyArtistAnswer.vue`) already move a highlight
   with ArrowUp/ArrowDown and pick with Enter.
4. **No way to pre-download** a song before it comes up, and no sign of which
   results are already in the library or already downloaded.

## The fix

**Naming.** "Play next" becomes **Cue next** everywhere in the search (single
songs, "All N songs" of a show, and deck/artist/anime rows). "Add" / "Add all"
stay and mean "to the bottom of the queue".

**Server-side placement.** The `load` command gains `position?: "next" | "end"`,
only meaningful with `append` on a running game (absent means `"end"`, today's
behaviour). The reducer places songs in one step:

| Song's place in the queue | Cue next | Add |
|---|---|---|
| Not queued | inserted right after the current song | appended to the bottom |
| Upcoming (after the current song) | moved right after the current song | moved to the bottom |
| On screen now | skipped | skipped |
| Already played (before the current song) | a fresh copy (new token) inserted next | a fresh copy appended |

Several songs keep their given order. `runPartyCommand` resolves clips only
for songs that need a new item, and returns `{ loaded, moved }`.
`/api/party/host/catalog-add` takes the same `position`. The client's
`queueMove` loops go away.

**Search rows.** A song already upcoming shows an "In queue" chip *and* its
Cue next / Add buttons (they move it). The song on screen shows "Playing now"
with no buttons.

**Arrow keys.** In the search box, ArrowDown/ArrowUp move a highlight through
the visible rows in order (shows, decks/artists/anime, songs, not-in-library,
including the rows of an opened show or deck), wrapping, scrolled into view,
with `aria-activedescendant` on the input. **Enter** on a song row does Cue
next. Enter on a show, deck, artist, or anime row opens or closes it, as a
click does, so Enter never cues a whole deck by accident. Escape clears the
highlight; typing resets it.

**Download + indicators.** Library song rows (Songs, a deck's songs, a show's
themes that already have a card) show small check chips: **In library** and
**Downloaded** (has a local video or audio file). A library song with no local
file gets a **Download** button: a new host route `POST
/api/party/host/download { cardId }` downloads the clip the party would play
(the same video/audio choice `resolveQueue` makes, honouring Playback mode and
Clip source) into the default download folder and saves the path on the card,
reusing `/api/cards/download`'s download code (moved into a shared util, not
copied). If that song is already upcoming in the queue, its clip switches to
the local file (`withLocalClip`). The row shows Downloading... then the
Downloaded chip, or a short error. Shows from AniList show an **In library**
chip when the library already has cards for them. Not-in-library catalog songs
get no Download button: they have no card to save a path on, and Party's own
auto-download already covers them once queued.

**Must not break:** endless top-ups (they still never pick a song already in
the queue), the queue list's remove/reorder/reroll, End game, `load` without
`append` (replacing the queue), and the host-door rule that no path or URL
reaches the page.

## Build steps

- [x] **1. Atomic placement on the server.** `position` on `load` and
  `catalog-add`, the move / fresh-copy rules above in the reducer and
  `runPartyCommand`, returning `{ loaded, moved }`. Tests in
  `server/utils/partyGame.test.ts` cover each table row for both positions,
  multi-song order, the current song being skipped, and `position` absent
  behaving as today.
  **Done when:** `bun run test` passes with those cases.
- [x] **2. Cue next in the search UI.** Rename the buttons, send `position`
  instead of the `queueMove` loop, show In queue / Playing now as above, and
  word the status note from `loaded` and `moved` ("cued next", "moved to the
  end", ...).
  **Done when:** in a running deck game, Cue next on a song already later in
  the queue makes it the next song in the queue list, and Add moves it to the
  bottom; the same works on an endless queue and for a not-in-library song.
- [x] **3. Arrow-key navigation.** Highlight, wrap, scroll into view, Enter
  cues a song next or toggles a show/deck row, Escape clears.
  **Done when:** typing a search, pressing ArrowDown twice and Enter cues the
  second song row next, without touching the mouse, and the party hotkeys do
  not fire while typing.
- [ ] **4. Download and library chips.** Shared download util, the host
  route, `downloaded` / `inLibrary` flags on the host search routes
  (`card-search`, `deck-songs`, `anime-search`, `anime-themes`), the chips,
  and the Download button with its states. Tests for any new pure logic (the
  clip-kind choice if it moves into a helper).
  **Done when:** a streamed library song shows Download; pressing it ends on
  a Downloaded chip, the file is in the default download folder, and if the
  song was queued it now plays from the local file.

## Verify

- `bun run test` and `bun run build` pass.
- `bun run build && bun run party`, log in to the host panel, start a deck
  game: search a song from that deck, Cue next it, check the queue list; Add
  another, check it is last. Repeat with All cards and an endless queue.
- Keyboard only: type, arrows, Enter.
- Download a streamed song and confirm the chip and the local file; search it
  again and see Downloaded with no Download button.
