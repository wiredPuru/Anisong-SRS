# Feature: Deck CRUD

**From build-plan:** feature 13a
**Status:** verified

## Goal

Let the user create, rename, and delete their own named decks - independent
of the automatic Artist/Anime grouping - browsable via a new "Created" option
on the existing `/decks` toggle. This is the foundation 13b (card assignment)
builds on; a manual deck created here has no cards in it yet.

## In scope

- `deck` table: `id`, `name` (unique - Anki doesn't allow two decks with the
  same name at one level, and these are flat, so the same rule applies
  cleanly here), `createdAt`.
- `GET /api/decks?type=created` - list manual decks (extends the existing
  `type=artist|anime` endpoint from feature 5 with a third branch).
- `POST /api/decks` - create (`{ name }`); name is trimmed, 400 on
  empty-after-trim or duplicate name.
- `PATCH /api/decks` - rename (`{ id, name }`); same trim/400 rules, 404 if
  the deck doesn't exist.
- `DELETE /api/decks` - delete (`{ id }`); 404 if the deck doesn't exist.
- `GET /api/decks/cards?type=created&id=<id>` - extends feature 5's deck
  detail endpoint with a third branch; 404 if the deck doesn't exist,
  otherwise `{ deckLabel: name, cards: [] }` - always an empty card list
  today, since there's no card-to-deck link until 13b.
- `/decks` UI: a third "Created" toggle button alongside "By Artist"/"By
  Title". Its list shows each manual deck (name, a "Created \<date\>"
  sublabel) with inline **Rename** and **Delete** controls, plus a "New
  deck" create form (name input + submit) shown above the list. Clicking a
  deck opens the existing detail view showing its (currently always empty)
  card list.

## Out of scope

- Card assignment (13b) - every manual deck shows "No cards in this deck"
  until then; `cardCount` isn't even returned by the API here (the client
  hardcodes `0` for the Created list, since a real count needs 13b's join
  table to mean anything).
- The export block (feature 9) and "Study this deck" link that the
  artist/anime detail view has - both stay hidden for a manual deck. Export
  only supports artist/anime scope per feature 9's own spec, and
  `StudyScope` (`{type:"all"}|{type:"artist"}|{type:"anime"}`) doesn't have a
  `"created"` variant - showing either link would point at something that
  doesn't work yet. Extending both is a future feature, not committed here.
- Nesting/parent-child decks - ruled out for this build-plan item entirely.
- Any bulk action (multi-select delete, drag-to-reorder) - one deck at a
  time, via the row's own Rename/Delete buttons.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema + CRUD API** - add `deck` to `server/db/schema.ts`
  (`id`, `name` unique+notNull, `createdAt`; Drizzle migration via
  `bun run db:generate`). Add `listManualDecks()`, `createManualDeck(name)`,
  `renameManualDeck(id, name)`, `deleteManualDeck(id)`, and
  `getManualDeckLabel(id)` to `server/utils/decks.ts` (mirroring
  `listArtistDecks`/`getArtistLabel`'s style). `createManualDeck`/
  `renameManualDeck` trim the name and check-then-insert for an existing
  match (not a caught `UNIQUE` constraint error) so an all-whitespace or
  duplicate name returns a clean `{ error: string }`, the way
  `mediaLibrary.ts`'s functions already do; the DB-level `unique()` stays as
  a safety net, not the primary validation path.
  Extend `server/api/decks.get.ts` with a `type === "created"` branch, add
  `server/api/decks.post.ts`, `server/api/decks.patch.ts`,
  `server/api/decks.delete.ts` (mirroring `cards.post.ts`/`.patch.ts`/
  `.delete.ts`'s request/response conventions exactly), and extend
  `server/api/decks/cards.get.ts` with a `type === "created"` branch
  returning `{ deckLabel, cards: [] }`. *Done when:* `curl` round-trip -
  `POST /api/decks {"name":"My Deck"}` creates it, `GET
  /api/decks?type=created` lists it, `PATCH` renames it, `GET
  /api/decks/cards?type=created&id=<id>` returns the new name and an empty
  `cards` array, `DELETE` removes it and it's gone from the list; creating a
  second deck with the same name 400s; renaming/deleting an unknown id
  404s.
- [x] **Step 2 - `/decks` UI: toggle, list CRUD, and detail view** - in
  `app/pages/decks/index.vue`, add a third toggle button ("Created"), extend
  `activeType` to `"artist" | "anime" | "created"` and `deckItems` with a
  branch mapping manual decks to `{ label: name, sublabel: "Created
  <formatted date>", coverImageUrl: null, cardCount: 0 }`. Above the list
  (only when `activeType === "created"`), add a create form (name input +
  submit, mirroring `settings.vue`'s "Add folder" form). Each manual deck
  row gets inline **Rename** (click -> text input + Save/Cancel, replacing
  the label) and **Delete** buttons, both `@click.stop` so they don't also
  trigger the row's navigate-to-detail click. In the same diff, suppress
  the "Study this deck" link and the entire `.export-block` when
  `activeType === "created"` - both must land together with the toggle,
  never as a follow-up step, so a manual deck's detail view never ships
  with a "Study this deck" link that silently studies *all* cards instead
  (there's no `"created"` branch in `StudyScope`, so an unhandled scope
  falls through to unscoped). *Done when:* in the browser, creating a deck
  shows it in the Created list immediately; renaming it updates the label
  in place; deleting it removes the row; entering a duplicate or
  whitespace-only name shows the inline error without navigating away;
  opening a manual deck shows its name and "No cards in this deck" with no
  "Study this deck" link and no "Export deck" block; opening an artist or
  anime deck still shows both, unchanged from before this feature.

## Files / areas

- `nuxt-app/server/db/schema.ts` - add `deck`; new migration.
- `nuxt-app/server/utils/decks.ts` - manual deck CRUD functions.
- `nuxt-app/server/api/decks.get.ts` - `type=created` branch.
- `nuxt-app/server/api/decks.post.ts` - new.
- `nuxt-app/server/api/decks.patch.ts` - new.
- `nuxt-app/server/api/decks.delete.ts` - new.
- `nuxt-app/server/api/decks/cards.get.ts` - `type=created` branch.
- `nuxt-app/app/pages/decks/index.vue` - toggle, list, create/rename/delete,
  detail-view suppression.

## Data / contracts

```ts
// server/db/schema.ts
export const deck = sqliteTable("deck", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
```

```ts
// server/utils/decks.ts
export interface ManualDeck {
  id: number;
  name: string;
  createdAt: Date;
}
```

`GET /api/decks?type=created` -> `{ decks: ManualDeck[] }` (note: unlike
`ArtistDeck`/`AnimeDeck`, no `cardCount` field - see Out of scope).

`POST /api/decks` request/response:

```ts
interface CreateManualDeckRequest {
  name: string;
}
// success: { deck: ManualDeck }
// failure: { statusCode: 400, statusMessage: "Deck name is required." | "A deck with this name already exists." }
```

`PATCH /api/decks` request/response:

```ts
interface RenameManualDeckRequest {
  id: number;
  name: string;
}
// success: { deck: ManualDeck }
// failure: 400 (same messages as create) | 404 "Deck not found"
```

`DELETE /api/decks` request/response:

```ts
interface DeleteManualDeckRequest {
  id: number;
}
// success: { success: true }
// failure: 404 "Deck not found"
```

`GET /api/decks/cards?type=created&id=<id>` -> `{ deckLabel: string, cards: [] }`
(same envelope as the existing artist/anime branch; `cards` is always `[]`
until 13b).

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test` entry),
so this rides on direct verification, same as recent features:

- Step 1: `curl` round-trip against all four endpoints, plus the duplicate-name
  and not-found error paths. `bun run build` must stay clean.
- Step 2: browser check of the full create/rename/delete/view-detail flow,
  and confirming the artist/anime toggle and detail view are byte-for-byte
  unaffected.

The duplicate-name and not-found checks in `server/utils/decks.ts`'s new
functions are pure logic with clear right/wrong answers - reasonable first
candidates if `/tests` adds a runner later.

## Notes for the AI

- Server-only: all DB access for the new CRUD functions stays in
  `server/utils/decks.ts` and the four route files; pages only call
  `$fetch`/`useFetch`, per `coding-standards.md`.
- Query-string routing convention (`?type=&id=`) continues unchanged - no
  dynamic route segment for a deck's id.
- Match existing error-response conventions: `createError({ statusCode,
  statusMessage })` server-side, the `extractErrorMessage` helper
  client-side (already present in `decks/index.vue` from feature 9).
- `ArtistDeck`/`AnimeDeck` and their query functions are untouched - this
  only adds a third, parallel manual-deck path through the same route files,
  it doesn't change how the derived deck types work.
- The `DeckItem`/`DeckCard` Vue interfaces already have every field a manual
  deck needs (`coverImageUrl: null`, `cardCount: 0`) - no new client-side
  type needed beyond the `ManualDeck` list-fetch shape and widening
  `activeType`.
