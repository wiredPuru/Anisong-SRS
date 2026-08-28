# Feature: Flashcard CRUD

**From build-plan:** feature 4
**Status:** verified

## Goal

Turn looked-up song data (feature 3's `/api/lookup/*` endpoints) into actual
flashcards: create a `Card` for a chosen OP/ED theme, attach a local media
file and/or the animethemes.moe reference already returned by the import
endpoint, list and manage existing cards, edit their local media
attachments, and delete them. This is the last piece before decks (feature
5) and study sessions (feature 6) have anything real to operate on.

## In scope

- `GET /api/cards` - list all cards with their song/artist/anime details
  joined in (for display, not stored redundantly)
- `POST /api/cards` - create a card for a given `songId`, with optional
  local video/audio paths and the animethemes.moe video/audio URLs from the
  lookup response
- `PATCH /api/cards` - update a card's local video/audio path attachments
  (attach, replace, or clear)
- `DELETE /api/cards` - delete a card
- Local media path validation: must be an absolute path, must exist, must
  be a file (not a directory), and must live inside one of the folders
  configured in `MediaLibrarySettings` (feature 2) - reusing that feature's
  `getLibraryPaths()`
- Validation that every card has at least one usable source (local video,
  local audio, animethemes video, or animethemes audio) - refuse to create
  or leave a card with none
- `/cards` page - list existing cards (song title, artist, anime title,
  theme slot, which sources are attached), inline edit of local paths,
  delete
- `/cards/new` page - search AniList, pick a result, import its themes
  (calls feature 3's `POST /api/lookup/import`), and add a card per theme
  with an optional local path input

## Out of scope

- Anything Leitner/study-related - `box` and `nextReviewAt` are left at
  their schema defaults (`1` and "now") on create and are never touched
  here. Feature 6 owns advancing them.
- Editing which `Song` a card points to, or editing the animethemes.moe
  URLs after creation - those come from the lookup import at creation time
  and are treated as fixed; only local path attachments are editable
- A filesystem browser/picker for local files - this feature takes a typed
  absolute path and validates it, the same pattern feature 2 already uses
  for library folders. A real file-picker UI is a nicer-to-have, not part
  of this slice
- Preventing multiple cards per song - the data model puts no unique
  constraint on `card.songId`, and nothing in the plan says one theme means
  exactly one card, so this feature doesn't add that rule
- Any deck/grouping view, guess-rate stats, or export/import - features 5,
  7, 8
- Global site navigation between pages - none exists yet (`settings.vue` is
  reached by URL only); adding a nav bar is a separate concern, not part of
  card CRUD

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Card CRUD server routes** - add `nuxt-app/server/utils/cards.ts`
  (`listCards`, `getCardWithDetails`, `createCard`, `updateCard`,
  `deleteCard`, plus a `validateLocalPath` helper reusing
  `mediaLibrary.ts`'s `getLibraryPaths()`) and
  `nuxt-app/server/api/cards.get.ts`, `cards.post.ts`, `cards.patch.ts`,
  `cards.delete.ts` (method-suffixed files on one path, same pattern as
  `media-library.get.ts`; body-based id for PATCH/DELETE, same pattern as
  `media-library/folders.delete.ts`, since no dynamic route segments exist
  anywhere in this codebase yet). *Done when:* against a running dev server
  (song id `1` = "Seishun Complex" / OP1, already imported by feature 3):
  `curl -X POST -d '{"songId":1,"animethemesVideoUrl":"https://v.animethemes.moe/x.webm"}' -H 'content-type: application/json' localhost:3000/api/cards`
  returns `200` with `songTitle: "Seishun Complex"`, `artistName:
  "Kessoku Band"`; `curl -X POST -d '{"songId":1}' ...` (no source at all)
  returns `400`; `curl -X POST -d '{"songId":99999}' ...` returns `404`
  (song doesn't exist - same "id given but no matching row" convention as
  PATCH/DELETE below, not 400); `curl localhost:3000/api/cards` includes the
  created card; `curl -X PATCH -d '{"id":<created id>,"localVideoPath":"/not/a/real/path.mp4"}' ...`
  returns `400` (path doesn't exist); adding a real temp folder to the
  library first (`curl -X POST -d '{"path":"<tmpdir>"}' .../api/media-library/folders`,
  with a real file inside it) then PATCHing `localVideoPath` to that file's
  path returns `200` with the path attached; `curl -X DELETE -d
  '{"id":<created id>}' ...` returns `200`, and a follow-up `GET
  /api/cards` no longer includes it; `curl -X DELETE -d '{"id":999999}' ...`
  returns `404`; build + `tsc --build` clean.
- [x] **Step 2 - `/cards` management page** - add
  `nuxt-app/app/pages/cards/index.vue`: fetches `GET /api/cards`, renders
  each card's song title, artist, anime title, theme slot, and which of the
  four sources are attached; inline form per row to set/clear
  `localVideoPath`/`localAudioPath` (calls `PATCH`); delete button (calls
  `DELETE`, refetches). Empty state when there are no cards yet, loading
  and fetch-error states matching `settings.vue`'s `pending`/`error`
  handling, and a rejected `PATCH` (e.g. bad path) shown inline near that
  row via the same `extractErrorMessage` pattern rather than failing
  silently. Follows `settings.vue`'s other conventions too: `useFetch` for
  the list, `$fetch` for mutations, scoped `<style>` using the
  `var(--token)` design tokens from `main.css`. *Done when:* with at least
  one card in the DB, loading
  `/cards` in a browser shows it with correct song/artist/anime text;
  editing a local path and saving updates the row without a full reload;
  deleting a card removes it from the list; screenshot of the populated
  list and of the empty state; build + `tsc --build` clean.
- [x] **Step 3 - `/cards/new` page** - add
  `nuxt-app/app/pages/cards/new.vue`: a search box calling `GET
  /api/lookup/anilist-search?q=`, a result list where picking one calls
  `POST /api/lookup/import`, then renders the returned themes each with an
  optional local-path input and an "Add card" button that calls `POST
  /api/cards` with that theme's `songId` and its `videoUrl`/`audioUrl` as
  `animethemesVideoUrl`/`animethemesAudioUrl`. A theme already added in the
  current session shows as added instead of re-showing the button (tracked
  in local component state, not re-fetched). A search with zero AniList
  results, and a failed import (feature 3's `404`/`502`), both show an
  inline message instead of an empty silent state. *Done when:* searching
  "Bocchi the Rock", selecting the first result, and clicking "Add card" on
  the OP1 theme creates a card visible on `/cards` afterward; a theme with
  no `videoUrl`/`audioUrl` and no local path entered shows the same `400`
  "needs a source" message from Step 1 instead of silently failing;
  searching a nonsense query (e.g. "zzzzxxxxqqqq") shows a "no results"
  message rather than an empty blank area; screenshot of the search
  results and the post-import theme list; build + `tsc --build` clean.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - new
- `nuxt-app/server/api/cards.get.ts` - new
- `nuxt-app/server/api/cards.post.ts` - new
- `nuxt-app/server/api/cards.patch.ts` - new
- `nuxt-app/server/api/cards.delete.ts` - new
- `nuxt-app/app/pages/cards/index.vue` - new
- `nuxt-app/app/pages/cards/new.vue` - new

## Data / contracts

No schema changes - `card` already exists from feature 1 with exactly the
fields this feature needs (`songId`, `localVideoPath`, `localAudioPath`,
`animethemesVideoUrl`, `animethemesAudioUrl`, `box`, `nextReviewAt`,
`createdAt`).

**`CardWithDetails` shape** (returned by list/create/update - load-bearing,
feature 5's deck grouping and feature 6's study queue will likely want the
same joined shape):

```ts
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  nextReviewAt: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  songTitle: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
}
```

**API contract**

- `GET /api/cards` -> `200 { cards: CardWithDetails[] }`, newest first.
- `POST /api/cards` body `{ songId: number, localVideoPath?: string,
  localAudioPath?: string, animethemesVideoUrl?: string, animethemesAudioUrl?:
  string }` -> `200 { card: CardWithDetails }`; `400` if `songId` is
  missing/not a number, if a given local path fails validation, or if the
  resulting card would have zero sources; `404` if `songId` is a number but
  doesn't reference an existing `Song`.
- `PATCH /api/cards` body `{ id: number, localVideoPath?: string | null,
  localAudioPath?: string | null }` -> `200 { card: CardWithDetails }`.
  `undefined` (key omitted) leaves that field unchanged; `null` clears it;
  a string sets and validates it the same way as create. `404` if `id`
  doesn't exist; `400` on validation failure, including a resulting
  zero-source card.
- `DELETE /api/cards` body `{ id: number }` -> `200 { success: true }`;
  `404` if `id` doesn't exist.

**Local path validation rule** (new, this feature): a submitted
`localVideoPath`/`localAudioPath` must be absolute, must exist, must be a
file, and must resolve inside one of `getLibraryPaths()`'s configured
folders (via `path.relative`, rejecting `..`-escaping or a path outside all
of them). Same shape of check as `mediaLibrary.ts`'s folder validation, but
for a file within an already-configured folder rather than the folder
itself.

## Testing

Still no test runner configured (per `coding-standards.md`, not adding one
mid-feature). Step 1's local-path validation and the "at least one source"
rule are the two pieces of real logic here - both are simple, and both get
proven live in Step 1's curl sequence (a rejected outside-library path, a
rejected zero-source card) rather than mocked. Steps 2 and 3 are UI/
integration and ride on browser screenshots + build, per the scope rule in
`coding-standards.md`.

## Notes for the AI

- Server-only DB/filesystem access stays in `server/utils/` and
  `server/api/`, per `coding-standards.md`; `cards/index.vue` and
  `cards/new.vue` only call the API routes, never `db` or `fs` directly.
- Reuse `getLibraryPaths()` from `mediaLibrary.ts` rather than re-reading
  `MediaLibrarySettings` directly - keeps the "what folders are allowed"
  logic in one place.
- `PATCH`'s three-state field semantics (omitted = unchanged, `null` =
  clear, string = set-and-validate) matter - don't collapse `null` and
  omitted into the same behavior, or clearing a path becomes impossible
  from the UI.
- No dynamic route segments (`[id].ts`) exist anywhere in this codebase
  yet; stay consistent with the existing body-based-id pattern from
  `media-library/folders.delete.ts` rather than introducing a new
  convention for this feature alone.
- `animethemesVideoUrl`/`animethemesAudioUrl` on create come straight from
  the theme object `POST /api/lookup/import` already returned - `cards/
  new.vue` should pass those through as-is, not re-fetch or re-derive them.
- A theme can legitimately have `videoUrl: null` and/or `audioUrl: null`
  (animethemes.moe data gap - confirmed in feature 3's client, see
  `animethemes.ts`'s `toThemeLookup`). That's exactly the case the
  zero-source validation exists to catch when the user also leaves the
  local path blank.
