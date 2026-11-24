# Party endless: live filter changes

**Type:** Fix
**Status:** verified (tests and build; host-panel browser check left to the user)

## The problem

Three things get in the way of changing what a running endless game plays
from:

1. **The change starts late.** A new endless setting (source, filters,
   difficulty, outside-library, downloaded-only) only affects songs generated
   afterwards. Endless keeps about 4 songs queued ahead
   (`ENDLESS_AHEAD`, `server/utils/partyStore.ts`), so the new filters only
   take effect after those have played.
2. **There's nowhere quick to change them.** The filters live in the New game
   form, which moves into the Settings dialog once a game starts.
3. **Starting a game wipes the filters.** The middle column's New game form
   (`PartyQueueBuilder`) unmounts on game start, and a fresh copy mounts
   inside Settings (`PartyHostDashboard.vue`). The fresh copy starts on
   All cards with no filters and reports that at once (`immediate: true`
   watch). The game keeps playing the original setup until anything is
   re-sent, but the form shows blanks. The first change there, even a
   difficulty click in `PartyEndlessPanel`, sends the blank source and
   filters and loses the original ones.

## The fix

- **Replace upcoming songs on a change (server).** When an `endless` command
  arrives while endless is already running, drop every queued song after the
  current one that endless added. Songs the host added by hand (`manual: true`)
  stay. `topUpEndless` then refills from the very next entry under the new
  settings. Starting endless on an existing queue still keeps that queue,
  and Stop endless keeps what is queued. The current song is never touched.
- **One New game form state (client).** Move `PartyQueueBuilder`'s form state
  (source type, picked deck, deck search text, filters, shuffle,
  downloaded-only) into a shared `usePartyNewGame()` composable (`useState`).
  Both copies of the form read and write it, so a remount shows the real
  settings. The dashboard's endless source is derived from it rather than
  emitted.
- **Re-send from the dashboard.** The "endless is running, re-send on a
  source or filter change" watch moves from `PartyEndlessPanel` to
  `PartyHostDashboard`. It builds the command from `state.endless` (current
  difficulty and toggles) plus the shared source and filters, so it works
  with Settings closed. The panel keeps re-sending its own difficulty and
  toggle changes.
- **Endless filters panel in the left column.** Shown above Add songs only
  while endless is running. Contents:
  - the source (All cards, or the deck name)
  - "N filters active"
  - **Edit filters**, which opens the existing `StudyFiltersModal` bound to
    the shared filters
  - **Clear filters**

  Each applies immediately through the dashboard's re-send. Difficulty stays
  in the Endless panel; changing the source deck stays in New game.

Must not break: the non-endless New game load and preview, `queueReroll`,
outside-library catalog fetching (`catalogGeneration` already drops stale
fetches), or host-added songs in an endless queue.

## Build steps

- [x] **1. Server: replace upcoming endless songs on a change.** Add the
  rule to the reducer's `endless` case in `server/utils/partyGame.ts`: if the
  previous and new config are both non-null, keep the queue up to and
  including `index`, plus later `manual` items. Add tests in
  `partyGame.test.ts`: a change replaces non-manual upcoming songs, keeps
  manual ones and the current song; start and stop leave the queue alone.
  **Done when:** tests pass; during a running endless game, a difficulty
  change replaces the "Up next" song at once.
- [x] **2. Client: shared New game state + dashboard re-send.** Add
  `usePartyNewGame()`, point `PartyQueueBuilder` at it, derive the endless
  source in the dashboard, and move the re-send watch there. **Done when:**
  start a game from a deck with a genre filter; Settings > New game shows
  that deck and filter; a difficulty click keeps them.
- [x] **3. Client: Endless filters panel above Add songs.** **Done when:**
  with endless running and Settings closed, editing a filter from the left
  column replaces the Up next songs with ones that match; the panel is hidden
  when endless is off.

## Verify

- `bun run test` and `bun run build` pass.
- In `bun run party`: start an endless game from a manual deck with a genre
  filter. Then:
  1. Open Settings > New game and confirm the deck and filter are shown.
  2. Change the difficulty and confirm the deck and filter are kept.
  3. Add a song by hand.
  4. Change the genre from the left-column panel. The Up next songs should
     change right away, the hand-added song should stay, and the current
     song should keep playing.
