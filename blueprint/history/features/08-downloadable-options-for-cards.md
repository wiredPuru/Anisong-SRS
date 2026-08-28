# Feature: Downloadable options for Cards

**From build-plan:** feature 8
**Status:** verified

## Goal

When creating or editing a card that has an animethemes.moe reference, let the
user download that video and/or audio into the local media library instead of
only pointing at the remote URL - so the card keeps working (and plays faster)
even without a live connection to animethemes.moe.

## In scope

- A **default download folder** setting: a new field on `MediaLibrarySettings`
  that must be one of the already-configured library paths. With exactly one
  library folder configured it's used automatically; with two or more, the
  user picks one in `/settings`. Removing the folder that's currently the
  default clears the default too.
- A server-side download routine that fetches an `animethemesVideoUrl` or
  `animethemesAudioUrl` into the default download folder, using a generated,
  collision-safe filename (see Data / contracts), with a bounded timeout.
- `POST /api/cards/download` - given a card id and `"video"` or `"audio"`,
  downloads the corresponding source into the default folder and sets the
  card's matching `localVideoPath`/`localAudioPath`.
- Download buttons in both card-authoring surfaces - `/cards/new` (right after
  a card is added) and `/cards` (the existing edit row) - shown per source
  (video and/or audio, independently) only when that source's remote URL
  exists **and** its local path isn't already set.
- Clear failure handling: a fixed download timeout, and a "Failed to
  download" (or "Download timed out") inline message on any failure, with any
  partial file cleaned up and no local path written.

## Out of scope

- Auto-importing an artist's entire catalog (the broader idea from
  `project-overview.md`'s Open Questions section). This feature only adds a
  download option to a card that already exists - bulk import stays
  unresolved and separate.
- Re-downloading over an already-set local path. The download button is
  simply unavailable once a local path exists for that source; clearing the
  path first (already supported by the existing edit form) is how you'd
  redo it.
- Download progress bars/percentages - only a busy/disabled state while it
  runs, then success or a single error message.
- Any change to how `animethemesVideoUrl`/`animethemesAudioUrl` are looked up
  or stored - this feature only consumes them.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Default download folder setting** - add a nullable
  `defaultDownloadFolder` column to `mediaLibrarySettings` (Drizzle migration
  via `bun run db:generate`), plus `getDefaultDownloadFolder()` and
  `setDefaultDownloadFolder(path)` in `server/utils/mediaLibrary.ts`
  (`setDefaultDownloadFolder` rejects a path that isn't already in
  `libraryPaths`); `removeLibraryPath` clears the default when the removed
  path was it. New `POST /api/media-library/default-download-folder`
  (`{ path }`), and `defaultDownloadFolder` added to the `GET
  /api/media-library` response. `/settings` shows a picker (radio buttons or
  a `<select>`) among the configured folders only when 2+ are configured;
  with exactly 1, show it as the implicit default with no picker; with 0,
  show nothing extra. *Done when:* with two folders configured, picking one
  persists across a page refresh (`GET /api/media-library` reflects it); removing
  that folder via the existing remove control clears the default (verified via
  the same GET).
- [x] **Step 2 - Download utility + API endpoint** - add
  `server/utils/mediaDownload.ts` with a filename builder (sanitized
  `"<anime title romaji> - <theme slot> - <artist name><ext>"`, extension
  taken from the source URL with a `.mp4`/`.mp3` fallback, a `" (2)"`-style
  suffix on an on-disk name collision) and a `downloadMediaFile(url, destDir,
  filename)` function that fetches with a 30s timeout
  (`AbortSignal.timeout(30_000)`), streams the response to disk, and deletes
  any partial file on a non-2xx response, network error, or timeout. Add
  `POST /api/cards/download` (`{ cardId, kind: "video" | "audio" }`): 404 if
  the card doesn't exist, 400 if the matching `animethemes*Url` is missing,
  400 if the matching local path is already set, 400 if no default download
  folder is configured (message points at `/settings`), otherwise downloads
  and returns the updated `CardWithDetails` (matching what `cards.patch.ts`
  already returns). On a download failure, respond with a clear
  `statusMessage` ("Failed to download the file." / "Download timed out.")
  and change nothing in the DB. *Done when:* using a card created against a
  real animethemes.moe theme (via the existing `/cards/new` lookup flow, not
  the fake seed URL), `curl -X POST /api/cards/download` with a valid
  `cardId`/`kind` downloads the file into the default folder, names it per
  the convention, and the returned card has the matching local path set;
  repeating the same request now 400s because the local path is already set;
  a request against an unreachable/broken URL fails with the download error
  message and leaves no partial file behind (verified via `ls`).
- [x] **Step 3 - Wire download buttons into the card UI** - in
  `cards/new.vue`, once a card is added, keep the created `CardWithDetails`
  (not just a boolean "added" flag) and show a "Download video"/"Download
  audio" button per available, not-yet-local source next to the "Added"
  badge; in `cards/index.vue`, add the same buttons to each card row (outside
  edit mode) under the same visibility rule. Both pages fetch
  `defaultDownloadFolder` from `/api/media-library` up front; if it's `null`,
  render no download buttons and add a small hint linking to `/settings`
  instead. Each button disables itself and shows "Downloading..." while its
  request is in flight, then either updates the local badges (success) or
  shows the inline error message from the API (failure). *Done when:*
  end-to-end in the browser - add a card from a real theme lookup, click
  "Download video", see it appear with a "Local video" badge and the file on
  disk; on a card whose theme has no audio, no "Download audio" button
  appears; with `defaultDownloadFolder` unset, no download buttons appear on
  either page and the `/settings` hint shows instead.

## Files / areas

- `nuxt-app/server/db/schema.ts` - add `defaultDownloadFolder` to
  `mediaLibrarySettings`; new migration under `server/db/migrations/`.
- `nuxt-app/server/utils/mediaLibrary.ts` - default-folder get/set, clear-on-remove.
- `nuxt-app/server/api/media-library/default-download-folder.post.ts` - new.
- `nuxt-app/server/api/media-library.get.ts` - include the new field.
- `nuxt-app/server/utils/mediaDownload.ts` - new. Filename + fetch/stream/cleanup logic.
- `nuxt-app/server/api/cards/download.post.ts` - new.
- `nuxt-app/app/pages/settings.vue` - default-folder picker.
- `nuxt-app/app/pages/cards/new.vue` - download buttons after add.
- `nuxt-app/app/pages/cards/index.vue` - download buttons per row.

## Data / contracts

Schema addition (Step 1):

```ts
export const mediaLibrarySettings = sqliteTable("media_library_settings", {
  id: integer("id").primaryKey(),
  libraryPaths: text("library_paths", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  defaultDownloadFolder: text("default_download_folder"), // nullable; must be one of libraryPaths
});
```

`GET /api/media-library` response gains `defaultDownloadFolder: string | null`.

`POST /api/cards/download` request/response (server-only shapes, not shared
elsewhere):

```ts
interface DownloadCardMediaRequest {
  cardId: number;
  kind: "video" | "audio";
}
// response on success: CardWithDetails (existing shape from cards.ts)
// response on failure: { statusCode, statusMessage: "Failed to download the file." | "Download timed out." | ... }
```

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test` entry),
so this rides on direct verification:

- Step 1: browser + `curl` against `/api/media-library` before/after setting
  and after removing the chosen folder.
- Step 2: `curl` against `/api/cards/download` using a card built from a real
  animethemes.moe lookup (confirmed reachable from this environment), plus a
  deliberately-broken URL to prove the failure path cleans up and reports
  clearly. `bun run build` must stay clean.
- Step 3: browser check of both pages' button visibility rules and the full
  add-card-then-download flow, screenshot or described browser state as
  evidence since no Playwright is installed in this project (per
  `coding-standards.md`, not added silently here).

`sanitizeSegment`/filename-building in `mediaDownload.ts` is pure logic and a
reasonable candidate for a focused test if `/tests` adds a runner later, but
that's not part of this feature's scope today.

## Notes for the AI

- Server-only: all filesystem/network access for the download stays in
  `server/utils/mediaDownload.ts` and the two new/changed API routes; pages
  only call `$fetch`/`useFetch`, per `coding-standards.md`.
- Reuse `isPathWithinLibrary`/the existing local-path validation indirectly:
  because a download always writes inside the configured
  `defaultDownloadFolder` (itself one of `libraryPaths`), the resulting path
  is already library-safe - no need to re-run `validateLocalPath`'s
  existence/library checks on a path this code just wrote itself.
- animethemes.moe requires the same non-default `User-Agent` header already
  used in `server/lib/animethemes.ts` - reuse that constant (or an equivalent)
  for the download fetch too, or it will get a bare 403.
- Match existing error-response conventions: `createError({ statusCode,
  statusMessage })`, and inline error display on the client via the same
  `extractErrorMessage` helper already duplicated in `cards/new.vue` and
  `cards/index.vue`.
- Query-string routing conventions (`?type=`) don't apply here - this is a
  POST action, not a page route.
