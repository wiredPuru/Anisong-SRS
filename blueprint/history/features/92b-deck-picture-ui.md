# Feature: Custom deck pictures - UI

**From build-plan:** feature 92b
**Status:** verified

## Goal

Let the user set, replace, and remove a created deck's picture from `/decks`, and
show it. 92a already stores and serves the picture and returns `imageUrl` on every
created deck; this feature wires it into the page. A deck with no picture looks
exactly as it does today (the tinted monogram tile).

## Design reference

No new look is introduced, so no reference image is needed. The picture drops into
two existing slots in `app/pages/decks/index.vue` that already render a cover for
anime decks: the poster tile (`.deck-tile-cover img`, `object-fit: cover`) and the
detail header thumbnail (`.cover-thumb-lg`). The new control reuses the page's
existing `.criterion-block`, `.rename-btn`, `.export-btn` and `.export-error`
styles and `main.css` tokens.

## In scope

- A "Picture" block on a created deck's detail view (above "Graded on") with Choose
  picture (Replace once one is set) and Remove, a busy state, and an inline error.
- Client-side checks before upload for fast feedback: PNG, JPEG or WebP, 5 MB or
  less. The server (92a) stays the authority and its 413 and 415 messages are shown
  if they happen anyway.
- The picture on the created deck's tile and detail header, updated in place after
  an upload or removal with no page reload.
- A broken picture (file gone from disk, so the image 404s) falls back to the
  monogram instead of an empty box.
- The client `ManualDeck` shape gains `imageUrl`.

## Out of scope

- Uploading from the tile, drag and drop, paste, a crop or preview step.
- Artist and anime decks (anime decks keep their AniList cover).
- Pictures anywhere other than the `/decks` tile and detail header (Home's panels,
  Study, the party display).
- Any server change. If one turns out to be needed, stop and amend 92a's contract.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Show the picture** - add `imageUrl: string | null` to the page's
  `ManualDeck`, map it to `coverImageUrl` for created decks in `deckItems`, and add
  a small `brokenCovers` set: an `<img>` `error` event on the tile or the header
  thumbnail adds the URL, and a URL in the set maps to `null` so the monogram
  returns. The tile and header markup already render `coverImageUrl`, so there is no
  template change beyond the `@error` handlers. *Done when:* with a picture set
  through `curl` (92a's route) a created deck's tile and detail header show it, a
  deck without one still shows the monogram, deleting the file from `deck-images/`
  and reloading shows the monogram rather than a broken image, and anime and artist
  decks are unchanged. Evidence: screenshots via `playwright-cli` plus the build.
- [x] **Step 2 - Picture control** - a pure `app/utils/deckPicture.ts` exporting
  `validateDeckPicture({ type, size })` (returns an error message or `null`, using
  `MAX_DECK_PICTURE_BYTES` = 5 MB and the three MIME types) with its test; a new
  `components/deck/DeckPictureControl.vue` (props `deckId`, `imageUrl`; emits
  `updated(imageUrl | null)`) holding a hidden file input, Choose or Replace and
  Remove buttons, `uploading` and `removing` states and an error line; and the
  page mounts it in the created-deck detail view and, on `updated`, sets that
  deck's `imageUrl` in `rawDecks` so the tile and header refresh in place. Uses
  `$fetch` with `FormData` for `POST /api/decks/image` and `DELETE` for removal,
  with `extractErrorMessage` for failures. *Done when:* in the browser, choosing a
  PNG sets the picture on the tile and header without a reload; choosing another
  replaces it; Remove returns the monogram; a 6 MB file and a `.txt` file each show
  a clear message and change nothing; the buttons are disabled while a request is
  in flight; `validateDeckPicture` tests pass; `bun run test` and `bun run build`
  pass. Evidence: screenshots and the browser console and network checked via
  `playwright-cli`.

## Files / areas

- `nuxt-app/app/pages/decks/index.vue` (types, `deckItems`, broken-cover handling,
  mounting the control, in-place update). The page is already about 2000 lines
  (finding F-23), so the control lives in its own component rather than adding
  more to it.
- `nuxt-app/app/components/deck/DeckPictureControl.vue` (new; the existing
  `components/deck/` folder keeps Nuxt's auto-import prefix `DeckPictureControl`)
- `nuxt-app/app/utils/deckPicture.ts` and `deckPicture.test.ts` (new)

## Data / contracts

Consumes 92a's contract, unchanged:

- `ManualDeck.imageUrl: string | null` from `GET /api/decks?type=created` (client
  copy gains the field, last in the same order as the server's).
- `POST /api/decks/image` (multipart `deckId`, `file`) -> `{ imageUrl }`; 413 over
  5 MB, 415 for another format, 404 unknown deck.
- `DELETE /api/decks/image` `{ id }` -> `{ success: true }`.
- The `v=` file name in `imageUrl` changes on every replace, so the browser fetches
  the new picture without any cache handling here.

## Testing

Vitest is configured, so the gate is on. In-scope logic (needs a test):
`validateDeckPicture`, covering each allowed type, a wrong type, an empty type, the
5 MB boundary (exactly at the cap passes, one byte over fails) and a zero-byte
file. The component and page wiring are UI, so they ride on browser screenshots
and the build, not unit tests. `bun run dev` with `playwright-cli` is the
verification path (a local tool, not a project dependency). Use an isolated
`GAQ_SRS_DATA_DIR` for any dev server used to test so the real library is not
touched.

## Notes for the AI

- Client work only: match `<script setup lang="ts">`, scoped `<style>` blocks with
  `var(--token)`, no inline styles, no hard-coded colors.
- Use `$fetch` for the mutations; `extractErrorMessage` is the page's existing way
  to turn a failure into a message.
- Do not hotlink or build the image URL on the client: use the `imageUrl` the
  server returned.
- No `any`, no unused imports, no commented-out code, no em dashes.
- If `/decks` has a pre-existing layout problem unrelated to this feature, note it
  and leave it alone.
