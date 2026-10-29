# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
> Build one thing at a time; `/complete` archives it under
> `blueprint/history/` and resets this file.

## Downloading from /cards search results leaves the card looking undownloaded

**Type:** Fix
**Status:** verified (tests and build pass; a live download was not exercised in the browser)

### The problem

On `/cards`, a download started from a search result (the Anime, Song, Artist or
imported-list add-candidate groups, singly or with "Download all") succeeds on
disk, but the rest of the page never hears about it:

- The inspector rail for that card still lists "Remote video" / "Remote audio",
  still offers Download buttons, and the edit form's "Local video path" stays
  empty.
- The inspector's player still believes the clip is remote, so it keeps
  streaming or shows "Loading" instead of switching to the local file.

Cause (found by reading, not yet reproduced): each add-candidate group keeps the
downloaded card in its own `addedCards` map (for example
`CardAddAnimeResults.vue` `downloadMedia`, `addedCards[songId] = updated`) and
emits only `refresh` and `preview`. `/cards`' own `cards` list, which backs the
inspector's `selectedCard`, is not told. `previewInInspector` also copies the
card object into the list once, so it goes stale the moment a download lands.
The inspector's own Download button is not affected: it emits `updated`, which
`replaceCard` handles.

### The fix

Reproduce first (select a card from an Anime result, download it from the result
row, watch the inspector). Then have the four add-candidate groups report a
completed download upward, as a new `updated` event carrying the card, and have
`/cards` route it through the existing `replaceCard` (and keep the inspector's
open edit form in step, as `CardInspector.downloadMedia` already does). Cover
single downloads and the bulk "Download all" loops in all four groups, and
`CardAddArtistResults`' own `downloadMedia`.

If the reproduction shows the inspector player still showing "Loading" after its
card is updated, fix that at its source (the player's clip source recomputation
in `StudyMediaPlayer.vue`) rather than working around it in the page. Do not
change the download route, the stored shape, or the per-card Download button.

### Build steps

- [x] Reproduce, then emit `updated` from the four add-candidate groups after
  each successful download and handle it on `/cards` with `replaceCard`.
  **Done when:** downloading an OP from an Anime search result updates the
  inspector at once - its Sources show Local video, the Local video path field is
  filled, the Download button is gone - without a refresh, and the same holds for
  Song, Artist and imported-list results and for "Download all".
- [ ] (Not done: needs a live browser check) Only if still reproducible after step 1: make the inspector player leave
  "Loading" and play the local file once its card gains a local path.
  **Done when:** after a download the player plays the local clip with no stuck
  "Loading" state.

### Verify

- Run the dev server, search for an anime on `/cards`, select one of its added
  themes, then download it from the result row. Confirm the inspector, the edit
  form's path and the player as described above, then repeat with "Download all".
- As built, step 1 also syncs `CardInspector`'s open edit form when the card's
  local paths change from outside (the screenshot had the form open). Not
  reproduced live: a real download writes to the owner's library.
- Run `bun run test` and `bun run build` from `nuxt-app/`. A small pure helper,
  if one is extracted, ships with a test; the UI wiring rides on browser
  evidence.
