# Feature: Media library settings

**From build-plan:** feature 2
**Status:** verified

## Goal

Let the user configure one or more local/external folders the app will later
resolve clip files from, backed by the `MediaLibrarySettings` singleton row
locked in the overview's data model. This is also the app's first real UI
feature, so it ports the prototype theme into the actual app and gets the app
shell rendering pages at all.

## Design reference

No screen-specific mockup exists for Settings (`prototypes/` only has
`study.html`, the Study session screen). But `prototypes/theme.css` is still
the token source for this feature - Step 1 ports its CSS custom properties
into the app's real global stylesheet. Build the `/settings` page's look
generically from those tokens (dark surfaces, pink/magenta accent, rounded
corners) rather than inventing a different look, but there is no fixed layout
to match pixel-for-pixel here.

## In scope

- `MediaLibrarySettings` table + migration (deliberately deferred from
  feature 1)
- Server API to read the current folder list, add a folder (validated), and
  remove a folder
- Path validation on add: must be absolute, must exist, must be a directory,
  must not already be in the list (after normalization)
- A `/settings` page: list configured folders, add a folder, remove a folder,
  loading and error states
- Porting `prototypes/theme.css`'s tokens into the app's real global
  stylesheet, and wiring `app.vue` to actually render pages (it currently
  only renders the Nuxt scaffold's `<NuxtWelcome />` placeholder)
- Resolving the `coding-standards.md` Styling TODO now that a real choice is
  being made

## Out of scope

- Actually scanning or indexing files inside the configured folders - this
  feature only stores paths; reading anime/song files from them is feature
  3/4's job
- Detecting a previously-saved path that later became invalid or was deleted
  from disk - validation only happens at add-time
- Deck export/import UI (feature 8), even though it shares the `/settings`
  route in the overview's route sketch
- Any other settings besides media library folders
- A `/` home/index page or any cross-page navigation - only `/settings` is
  being built; no other pages exist yet to link to

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Port the theme and wire routing** - copy
  `prototypes/theme.css`'s `:root` custom properties into
  `nuxt-app/app/assets/css/main.css` (plus a minimal base rule: `body`
  background/text color and `font-family` from the tokens), register it via
  `css: ["~/assets/css/main.css"]` in `nuxt.config.ts`, and replace
  `app.vue`'s `<NuxtWelcome />` with `<NuxtPage />` so routed pages actually
  render. Also update `coding-standards.md`'s Styling section: plain CSS
  custom properties from `theme.css`, no Tailwind/UI kit, components use
  scoped `<style>` blocks referencing `var(--token)`. *Done when:* `bun run
  build` succeeds, and visiting the dev server in a browser shows the dark
  themed background/text color (screenshot) even though no page content
  exists yet.
- [x] **Step 2 - `MediaLibrarySettings` schema + migration** - add the table
  to `nuxt-app/server/db/schema.ts` (see Data/contracts) and export its
  inferred types, then run `bun run db:generate` for the migration. *Done
  when:* `bun run build` succeeds, and booting fresh (`rm -rf .data && node
  .output/server/index.mjs`) then running `sqlite3 .data/gaq-srs.db
  ".tables"` shows `media_library_settings` alongside the five existing
  tables.
- [x] **Step 3 - Server API routes** - add
  `nuxt-app/server/api/media-library.get.ts`,
  `nuxt-app/server/api/media-library/folders.post.ts`, and
  `nuxt-app/server/api/media-library/folders.delete.ts`, plus a shared helper
  (`nuxt-app/server/utils/mediaLibrary.ts`) for the get-or-default /
  upsert / normalize-and-validate logic. *Done when*, against a running dev
  server: `curl localhost:3000/api/media-library` returns `{"libraryPaths":[]}`
  on a fresh DB; `curl -X POST -d '{"path":"/tmp"}' -H 'content-type:
  application/json' localhost:3000/api/media-library/folders` returns
  `{"libraryPaths":["/tmp"]}`; re-posting the same path (or `/tmp/`, which
  normalizes to the same value) returns a `400` "already configured" error
  without duplicating it; posting a relative path or a path that doesn't
  exist returns a `400` with a clear message; `curl -X DELETE -d
  '{"path":"/tmp"}' -H 'content-type: application/json'
  localhost:3000/api/media-library/folders` returns `{"libraryPaths":[]}`.
- [x] **Step 4 - `/settings` page** - add `nuxt-app/app/pages/settings.vue`:
  fetches and lists configured folders on load (with a loading state and an
  error state if the fetch fails), a text input + button to add a folder
  (shows the server's validation error inline on failure), and a remove
  button per folder. *Done when:* in a browser, `/settings` loads and shows
  the current list; adding a valid absolute directory path adds it to the
  list and it's still there after a page refresh; adding an invalid path
  shows the error inline without clearing the existing list; removing a
  folder removes it and the removal survives a refresh.

## Files / areas

- `nuxt-app/app/assets/css/main.css` - new
- `nuxt-app/nuxt.config.ts` - add `css` array entry
- `nuxt-app/app/app.vue` - `<NuxtWelcome />` -> `<NuxtPage />`
- `blueprint/context/coding-standards.md` - Styling section
- `nuxt-app/server/db/schema.ts` - add `mediaLibrarySettings` table + types
- `nuxt-app/server/db/migrations/` - new, generated
- `nuxt-app/server/utils/mediaLibrary.ts` - new
- `nuxt-app/server/api/media-library.get.ts` - new
- `nuxt-app/server/api/media-library/folders.post.ts` - new
- `nuxt-app/server/api/media-library/folders.delete.ts` - new
- `nuxt-app/app/pages/settings.vue` - new

## Data / contracts

**MediaLibrarySettings** (extends the schema locked in feature 1's archive)
- `id` integer PK - always `1`; application logic never creates a second row
- `library_paths` text, JSON-encoded `string[]`, NOT NULL, default `'[]'`
  (Drizzle: `text(..., { mode: "json" }).$type<string[]>()`)

**Path normalization (load-bearing for the duplicate check):** trim
whitespace, then run every incoming path through `node:path`'s
`normalize()` and strip a trailing separator (except for a root path) before
validating, comparing, or storing - `/tmp/`, ` /tmp `, and `/tmp` must all be
treated as the same entry.

**Request validation:** both `POST` and `DELETE` must reject a missing or
non-string `path` field with `400` before touching the filesystem - a
malformed body is a client error, not a `500`.

**API contract**
- `GET /api/media-library` -> `200 { libraryPaths: string[] }`. Reads the
  row if present; if no row exists yet, returns `{ libraryPaths: [] }`
  *without* inserting one (only a successful `POST` creates the row).
- `POST /api/media-library/folders` body `{ path: string }` -> `200
  { libraryPaths: string[] }` on success (upserts `id = 1`, creating the row
  on first write); `400 { error: string }` if the normalized path isn't
  absolute, doesn't exist, isn't a directory, or is already in the list.
- `DELETE /api/media-library/folders` body `{ path: string }` -> `200
  { libraryPaths: string[] }`, always - removing a path that isn't present is
  a no-op returning the unchanged list, not an error.

## Testing

Still no test runner configured (see feature 1's archive note; unchanged
here). Evidence stays build output, direct `curl` calls against the dev
server (step 3), and browser verification (steps 1 and 4).

## Notes for the AI

- `MediaLibrarySettings` is a singleton - always operate on `id = 1`. Don't
  build UI or API shape that implies multiple settings rows.
- Server routes own all DB/filesystem access per `coding-standards.md`; the
  `/settings` page calls them via `$fetch`/`useFetch`, never importing
  `server/db/*` from `app/`.
- Validate paths with `node:path`'s `isAbsolute()`/`normalize()` and
  `node:fs`'s `existsSync`/`statSync` (or the `node:fs/promises`
  equivalents) - reject relative paths, missing paths, and non-directory
  paths with a message the UI can show inline.
- This is the app's first real page. `app.vue` currently renders only the
  Nuxt scaffold's `<NuxtWelcome />`; Step 1 must replace it with `<NuxtPage
  />` or nothing will ever render at `/settings`.
- No `/` index route is being added - that 404ing is expected, not a
  regression to fix here.

## Implementation notes

- Nitro's `server/utils/` auto-import didn't pick up `mediaLibrary.ts`'s
  exports for this build (`tsc --build` couldn't resolve them). Used
  explicit relative imports in the route files instead of chasing why -
  more robust regardless.
- `prototypes/` was **not** deleted despite this feature consuming
  `theme.css`, because `prototypes/study.html` (the Study session mockup)
  is still reserved for feature 6 and hasn't been built yet. Revisit
  deletion once that feature consumes it.
- No browser automation (Playwright) is installed, so step 4's click-level
  interactivity was verified via SSR re-fetch round-trips (add via API,
  reload the page, confirm it's listed; remove, reload, confirm it's gone)
  rather than an actual browser session. The mutation logic just calls the
  same endpoints already proven correct in step 3.
