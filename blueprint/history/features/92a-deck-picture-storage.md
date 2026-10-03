# Feature: Custom deck pictures - storage and routes

**From build-plan:** feature 92a
**Status:** verified

## Goal

Let a created (manual) deck own an optional picture of the user's choosing. 92a
is the server half: a nullable column, a `deck-images/` folder beside the
database, and routes to upload, serve, and remove a picture, with cleanup when a
deck is deleted or its picture replaced. There is no UI yet (92b adds it), so
the app looks and behaves exactly as it does today until then.

## In scope

- A nullable `Deck.imagePath` column (Drizzle migration `0027`). It holds a bare
  file name, never a path, so the data directory can move (packaged builds,
  `GAQ_SRS_DATA_DIR`).
- A `deck-images/` folder beside the database, created on first upload, resolved
  the same way `partyMusicFolder()` resolves its folder (`resolveDbPath`).
- Pure validation in a new `server/utils/deckImage.ts`: sniff the format from the
  file's magic bytes (PNG, JPEG, WebP), enforce a 5 MB cap, and build the stored
  file name `<deckId>-<8 hex chars>.<ext>`.
- Storage operations: save a picture for a deck (replacing and deleting any old
  one), remove a picture, and delete a deck's picture file when the deck is
  deleted (extend `deleteManualDeck`).
- Three routes under `/api/decks/image`: upload, serve, remove.
- `ManualDeck` (the shape `GET /api/decks` returns for created decks) gains
  `imageUrl: string | null`, so 92b needs no extra request.

## Out of scope

- Any UI (92b).
- Artist and anime decks. They have no row to hold a picture, and anime decks
  keep their AniList cover.
- Pasting a URL, picking a card's cover, resizing or cropping on the server (CSS
  `object-fit: cover` handles the crop, as it does for covers today), SVG or GIF
  support.
- Including the picture in deck export. Export is already suppressed for manual
  decks, and deck import is unchanged.
- Garbage-collecting stray files in `deck-images/` that no deck references.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Column and pure validation** - add `imagePath` to the `deck`
  table in `server/db/schema.ts` and generate the Drizzle migration; add
  `server/utils/deckImage.ts` exporting `sniffImageType(bytes)` (PNG, JPEG, WebP
  by magic bytes, else `null`), `MAX_DECK_IMAGE_BYTES` (5 MB),
  `deckImageFileName(deckId, type, token)`, and `isSafeDeckImageName(name)` (no
  separators or dots beyond the extension, so a stored or requested name can never
  escape the folder). *Done when:* the migration applies on a fresh and an
  existing database with every deck's `imagePath` null; `deckImage.test.ts`
  passes, covering each format, a truncated header, an empty buffer, an SVG or
  text file renamed to `.png`, and path-traversal names; `bun run test` is green.
- [x] **Step 2 - Storage operations and deck delete cleanup** - add
  `deckImageFolder()` plus `saveDeckImage(deckId, bytes)`, `removeDeckImage(deckId)`
  and file cleanup to `server/utils/decks.ts` / a new `server/utils/deckImageStore.ts`.
  Order matters: write the new file first, update the column, then delete the old
  file, so a failure never leaves a deck pointing at a missing file. Cleanup is
  best-effort (a missing file or filesystem error is swallowed, as in feature 17).
  `deleteManualDeck` removes the deck's file. `listManualDecks` returns
  `imageUrl` (`/api/decks/image?id=<id>&v=<file name>`, so a replaced picture
  busts the browser cache) or `null`. *Done when:* tests against a temp
  `GAQ_SRS_DATA_DIR` show save creates the file and sets the column, a second save
  replaces and deletes the first file, remove clears both, deleting the deck
  removes the file, an unknown deck id returns not-found without writing a file,
  and `listManualDecks` carries the right `imageUrl`.
- [x] **Step 3 - Routes** - `POST /api/decks/image` (multipart: `deckId`, `file`;
  400 for a bad id or missing file, 404 unknown deck, 413 over 5 MB, 415 not a
  PNG, JPEG or WebP; returns `{ imageUrl }`), `GET /api/decks/image?id=&v=`
  (serves the file with its sniffed type and a long immutable cache header
  since the name changes on replace; 404 when none), and `DELETE /api/decks/image`
  (body `{ id }`, idempotent: success whether or not one was set, 404 only for an
  unknown deck). *Done when:* with `bun run dev`, `curl` uploads a PNG and the GET
  returns the same bytes with `image/png`; uploading a 6 MB file gives 413 and a
  text file named `a.png` gives 415, both leaving no file behind; a second upload
  replaces the first; DELETE clears it; `GET /api/decks?type=created` shows
  `imageUrl` appear and disappear; `bun run build` passes.

## Files / areas

- `nuxt-app/server/db/schema.ts` and a new migration under
  `nuxt-app/server/db/migrations/` (`0027`, plus its `meta` snapshot)
- `nuxt-app/server/utils/deckImage.ts` (+ `deckImage.test.ts`), the pure part
- `nuxt-app/server/utils/deckImageStore.ts` (+ test), the filesystem part
- `nuxt-app/server/utils/decks.ts` (`ManualDeck`, `listManualDecks`,
  `deleteManualDeck`)
- `nuxt-app/server/api/decks/image.post.ts`, `image.get.ts`, `image.delete.ts`
  (the repo uses `.get.ts`/`.post.ts` per method, e.g. `cards.delete.ts`)

## Data / contracts

Load-bearing for 92b:

```ts
// server/utils/decks.ts and the client copy in app/pages/decks/index.vue
interface ManualDeck {
  id: number;
  name: string;
  createdAt: Date; // string on the client
  gradingCriterion: GradingCriterion;
  cardCount: number;
  passRate: number | null;
  imageUrl: string | null; // new in 92a
}
```

- `Deck.imagePath`: text, nullable, a file name such as `12-a3f9c01b.webp`.
- Routes: `POST /api/decks/image` -> `{ imageUrl: string }`;
  `GET /api/decks/image?id=<deckId>&v=<fileName>` -> the image bytes;
  `DELETE /api/decks/image` `{ id }` -> `{ success: true }`.
- `v` is cache-busting only. The server serves whatever the deck currently holds
  and never builds a path from `v`.

## Testing

Vitest is configured, so the gate is on. In-scope logic (needs a test):
`sniffImageType`, the size cap, file-name building, `isSafeDeckImageName`, and
the save, replace, remove and delete-cleanup behavior against a temp data
directory. The three routes are integration surfaces: verify with `curl` against
`bun run dev` and the build, not unit tests. Use `/check` for the curl sequence
in Step 3.

## Notes for the AI

- Schema changes only through a Drizzle migration, never a manual `ALTER TABLE`.
- Do not trust the client's `Content-Type` or file extension; the format comes
  from the magic bytes, and the stored extension comes from the sniffed type.
- Never build a filesystem path from request input. The GET route looks the file
  name up from the deck's own row.
- Match the existing patterns: `getQuery`/`readBody` handlers, `createError` with
  a `statusMessage`, best-effort cleanup like feature 17, and a data folder
  resolved through `resolveDbPath` like `partyMusic.ts`.
- Nitro reads multipart bodies with `readMultipartFormData`. Confirm in Step 3 that
  a 5 MB upload is not cut off by a default body limit, and raise the limit for
  this route only if it is.
- No em dashes in code, comments or commit messages.
- Proportionate security for a local app: validate type and size and block path
  traversal, but do not build upload scanning or auth.
