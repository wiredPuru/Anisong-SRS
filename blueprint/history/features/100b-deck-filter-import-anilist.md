# Feature: Import and add to the deck (100b)

**From build-plan:** feature 100b (second and last sub-feature of 100, "AniList matches in the deck filter window"; 100a is built)
**Status:** verified

## Goal

The "Not in your library yet" section from 100a becomes selectable. Each listed show gets a
tick box (ticked by default). **Add** then puts the ticked library shows' cards into the deck
as it does today, and imports the ticked AniList shows one at a time (with progress and Cancel)
and adds their cards to the same deck, ending in one combined summary. It works in the
"+ New deck from filters" form too.

## In scope

- Ticks on the AniList rows, kept as an unticked set by AniList id so a newly listed show
  arrives ticked (the same rule the library list uses). Tick all / Untick all for that
  section. The ticked set is `selectedForRun(unowned, unticked)` from `browseSelection.ts`,
  which already caps a run at 300 shows and reports `truncated`; a note says when ticked
  shows were left out.
- **Add** works when either part has something ticked. Order: make the deck first when
  creating (existing `ensureTargetDeck`), copy the library part (`/api/decks/copy-filtered`,
  skipped when none are ticked), then import each ticked AniList show with
  `importAnimeBatch` over `POST /api/lookup/import-cards` with `{ aniListId, deckId }`
  (feature 97a). Library cards land first, so a cancel or a failure keeps them.
- While running: a progress line and bar with a Cancel button (Cancel stops after the
  current show), the window cannot be closed, and ticks, Tick all, and Add are disabled.
  Changes to the filters do not refresh either list until the run ends.
- One combined summary from a pure helper: library cards added (and already in the deck),
  AniList shows imported with the cards that joined the deck, how many failed, how many had
  nothing addable under the Clip source and insert-song settings, and "Stopped early" on
  Cancel.
- After a run, both lists refresh: the library preview (the imported shows now appear in it)
  and, if AniList was searched, the AniList list (they drop out of it). The `copied` event
  reports the combined added count so the deck page refreshes its cards.
- The footer count reads "N shows, M cards" for the library part and adds "+ K from AniList"
  when any are ticked.

## Out of scope

- Any server change: 97a's route already takes `deckId` and links every card it created or
  found.
- AniList's full genre and tag lists, and OP/ED or Anime list filters on AniList results.
- Retrying failed shows, or resuming after Cancel (run Add again; shows already imported are
  now in the library and drop out of the list).

## Build loop

Build one step at a time. Plan, implement just that step, show the diff, approve, then
optionally checkpoint. `/complete` makes the real commit.

## Build steps

- [x] **Step 1 - Run summary helper** - `app/utils/deckFilterRun.ts`: a pure
  `summarizeDeckFilterRun` taking the library `CopyFilteredResult | null` and the AniList
  `ImportBatchResult | null` and returning the combined sentence, plus
  `combinedAddedCount` (library added + cards that joined from imports). Vitest next to it.
  *Done when:* tests cover library only, AniList only, both, cancelled, failures, shows with
  nothing addable, singular and plural wording, and the "already in deck" note, and pass.
- [x] **Step 2 - Select and import** - the ticks, Tick all / Untick all, the cap note, the
  footer counts, the extended `canAdd`, the combined Add run with progress and Cancel, the
  disabled state while running, and the refresh after. *Done when* (in the browser, using a
  throwaway deck and one small show, then removing the throwaway deck and the cards the
  import created): AniList rows are ticked by default and Untick all empties the AniList
  count; Add with only AniList ticked is enabled; Add imports the show, the deck gains its
  cards, the summary names both parts, the show moves from the AniList list into the library
  list, and the deck page behind the window refreshes; Cancel during a multi-show run stops
  after the current show with "Stopped early" and keeps the library part; the create form
  makes the deck first and keeps it if the import fails; `bun run test` and `bun run build`
  pass with no console errors.

## Files / areas

- `nuxt-app/app/utils/deckFilterRun.ts` (+ test, new)
- `nuxt-app/app/components/deck/DeckFilterCardsModal.vue`

## Data / contracts

- No route, schema, or stored-shape change. `ImportBatchResult`, `ImportOneResult`,
  `selectedForRun`, `CopyFilteredResult` are reused as is.
- The `copied` event keeps its `CopyFilteredResult` shape: `added` becomes library cards plus
  cards that joined from imports, `alreadyInDeck` stays the library part's.

## Testing

- Vitest for the summary helper (Step 1). The window rides on browser evidence
  (`playwright-cli`) and `bun run build`. The live import touches the owner's library, so use
  a throwaway deck and a single small show, and clean up what the test created (the throwaway
  deck, and by card id the cards the import created) when done; orphaned Song, Artist and
  Anime rows are kept by design (feature 61).
- Do not hammer AniList: the page budget and one search per filter change already bound it,
  and AniList rate-limited a test run once during 100a.

## Notes for the AI

- Follow the existing modal conventions: scoped styles with `var(--token)`, no inline
  styles, the `.anime-row` look, and `CardBrowseModal`'s progress block and Cancel button.
- `importAnimeBatch` already counts failures, nothing-addable shows, and cancellation; do not
  reimplement them.
- A failed run must never lose the created deck (existing behaviour) or the library cards
  already copied.
- Capture the ticked ids at the start of a run, so later list refreshes cannot change what is
  imported.

## Outcome

Built as specced. `deckFilterRun.ts` (8 tests) builds the combined summary and the combined added count. `DeckFilterCardsModal.vue`: the AniList rows gained tick boxes (an unticked set by AniList id, capped through `selectedForRun`), Tick all / Untick all, a footer that adds "+ N AniList shows to import", a wider `canAdd`, and an `add()` that makes the deck when creating, copies the library part, then runs `importAnimeBatch` over `/api/lookup/import-cards` with the deck id, with a progress line, Stop button, a locked window while it runs, and a refresh of both lists afterwards. Evidence: `bun run test` 1773 pass and `bun run build` passes; in a real browser on the owner's library, ticks defaulted on, Untick all disabled Add, ticking one re-enabled it; importing Grisaia no Kajitsu put 9 cards in a throwaway deck and moved the show from the AniList list to the library list; a four-show run showed "Importing 1 of 4" then "2 of 4", Stop gave "Stopped early" after two shows, and the close button and ticks were disabled during the run; the new-deck form created its deck and imported into it; no console errors. The two throwaway decks and the 12 cards the tests created were deleted afterwards (library back to 1442 cards); their Anime, Song and Artist rows remain by design. A show with no addable songs (Kizumonogatari I) imports zero cards and stays in the AniList list. Not exercised: a failed import partway, and a narrow window.

