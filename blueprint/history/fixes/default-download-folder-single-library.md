# Fix: Default download folder never persists with only one library folder

**Type:** Fix
**Status:** verified

## The problem

`/cards`' "Download video"/"Download audio" buttons never appeared for anyone
who had configured exactly one media library folder - the common case for a
fresh install, and how this surfaced on the Windows packaged binary.

`app/pages/settings.vue` (lines 104-120) showed one of two UI states based on
`data.libraryPaths.length`:

- **Exactly 1 folder:** a plain, cosmetic note - *"Downloads will go to
  `<path>`."* It never called any API; it was just text.
- **2+ folders:** a `<select>` dropdown whose `@change` handler calls
  `setDefaultDownloadFolder(path)`, which `POST`s
  `/api/media-library/default-download-folder` and persists the choice.

So with exactly one folder, `defaultDownloadFolder` in
`MediaLibrarySettings` stayed `null` forever - nothing ever set it. That
`null` flowed through two places:

- `GET /api/media-library` returned `defaultDownloadFolder: null`, so
  `hasDefaultDownloadFolder` (`app/pages/cards/index.vue`) stayed `false` and
  the download buttons never rendered, even though `hasAnyDownloadableSource`
  was true.
- `POST /api/cards/download` (`server/api/cards/download.post.ts`) called
  `getDefaultDownloadFolder()`, got `null`, and would 400 with "No default
  download folder is configured" if it were ever reachable.

Not packaging-specific - reproduced identically under `bun run dev`. Nobody
had hit it before because prior manual testing apparently always used 2+
library folders.

## The fix

`getDefaultDownloadFolder()` in `server/utils/mediaLibrary.ts` now falls back
to the sole configured library path when `defaultDownloadFolder` is unset
(`null`) and `libraryPaths.length === 1`. One change fixes both consumers
(`GET /api/media-library` and `POST /api/cards/download`) since both call
this same function, and it matches what `settings.vue`'s existing note
already claims - no frontend change needed. Once a second folder is added,
`libraryPaths.length` is no longer 1, the fallback stops applying, and the
pre-existing dropdown UI takes over asking the user to explicitly choose -
unaffected by this change.

## Build steps

- [x] Add the single-library-path fallback to `getDefaultDownloadFolder()` in
  `nuxt-app/server/utils/mediaLibrary.ts`.
  **Done when:** with exactly one library folder configured and no explicit
  default set, `GET /api/media-library` returns that folder as
  `defaultDownloadFolder`, and a card with a downloadable source shows its
  download button on `/cards`. With 0 or 2+ folders and no explicit default,
  the response is still `null` (unchanged).

## Verify

- Automated: `bun run build` passes.
- Manual: ran `.output/server/index.mjs` against a scratch data dir. Added
  one library folder via `POST /api/media-library/folders`, confirmed `GET
  /api/media-library` returned it as `defaultDownloadFolder`. Added a second
  folder and confirmed `defaultDownloadFolder` reverted to `null` (unchanged
  pre-existing dropdown-driven behavior).
