# Feature: Clip source setting - setting + fetch-time enforcement

**From build-plan:** feature 64a (parent: 64. Clip source setting)
**Status:** verified

## Goal

Add a persistent Clip source setting (AnisongDB only by default, Both, or
animethemes.moe only) and make every server route that fetches a remote clip
refuse a URL whose host that setting excludes. This is the guarantee the user
asked for: with the default, nothing streams, prefetches, or downloads from
animethemes.moe, whatever URL a card happens to hold. 64b stops those URLs
being stored in the first place; 64c makes the player degrade gracefully on
cards that already hold them.

## In scope

- `clipSource` column on `MediaLibrarySettings` (`"anisongdb" | "both" |
  "animethemes"`, default `"anisongdb"`) via a Drizzle migration.
- `getClipSource()` / `setClipSource()` in `server/utils/mediaLibrary.ts`,
  `POST /api/media-library/clip-source`, and `clipSource` on
  `GET /api/media-library`.
- A pure host check, `isClipUrlAllowed(url, clipSource)`, in a new
  `server/utils/clipSource.ts`, mapping hosts to providers:
  `animemusicquiz.com` and subdomains -> AnisongDB, `animethemes.moe` and
  subdomains -> animethemes.moe.
- Enforcement in `GET /api/media/stream`, `POST /api/media/prefetch`, and
  `POST /api/cards/download`: an excluded host is refused with `403` and a
  message naming the setting, before any cache lookup or network fetch.
- `SettingsClipSourceControl.vue` in `/settings`' Playback section, same
  pattern as `SettingsPlaybackModeControl.vue`.

## Out of scope

- Filtering clip URLs at import time (anime/song/artist import, deck import) -
  64b.
- Search results showing a theme as disabled when it has no allowed clip - 64b.
- Study/Preview skipping a blocked URL, error-state hint, and the 60c
  re-source action honouring the setting - 64c.
- Deleting or rewriting stored card URLs. Never done in any sub-feature.
- Any change to metadata lookups: animethemes.moe GraphQL keeps being queried
  for titles and theme ids in every mode.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Host check (pure logic + test)** - `server/utils/clipSource.ts`
  exporting the `ClipSource` type, `CLIP_SOURCES`, `isClipSource(value)`, and
  `isClipUrlAllowed(url, clipSource)`, with `clipSource.test.ts` beside it.
  *Done when:* `bun run test` passes with cases for each mode against an AMQ
  URL (`naedist`/`eudist.animemusicquiz.com`), an animethemes.moe URL
  (`v.`/`a.animethemes.moe`), a lookalike host (`animethemes.moe.evil.com`,
  `notanimemusicquiz.com`), `http:`, and an unparseable string - the last
  three rejected in every mode.
- [x] **Step 2 - Stored setting + API** - schema column, generated migration
  (`bun run db:generate`), `getClipSource`/`setClipSource` (setter validates
  with `isClipSource`), `POST /api/media-library/clip-source` (body
  `{ source }`, `400` on anything else), and `clipSource` in
  `GET /api/media-library`. *Done when:* on a dev server with an existing
  database, `GET /api/media-library` returns `clipSource: "anisongdb"`
  after boot migration; POSTing `"both"` then re-reading returns `"both"`;
  POSTing `"foo"` or a missing body returns `400` and leaves the value
  unchanged.
- [x] **Step 3 - Enforce in stream and prefetch** - both routes keep their
  existing `parseAllowedStreamUrl` `400`, then check
  `isClipUrlAllowed(url, getClipSource())` and throw `403` ("Clip source
  setting does not allow <host>") before `resolveCachedPath`. *Done when:*
  with the default setting, `curl` against `/api/media/stream?url=<an
  animethemes.moe clip>` and `POST /api/media/prefetch` with the same URL
  both return `403` and no new file appears in the stream-cache directory;
  the same requests with an AMQ URL still return `200`/`206`; switching to
  `"animethemes"` inverts both; `"both"` allows both.
- [x] **Step 4 - Enforce in download** - `POST /api/cards/download` checks the
  chosen `sourceUrl` after the existing "no reference"/"already local" checks
  and before any file is created, `403` with the same message. This also
  covers feature 59's Auto Download, which goes through this route. *Done
  when:* downloading a card whose chosen-kind URL is animethemes.moe returns
  `403` under the default setting, no file is written to the download folder
  and the card's local path stays `null`; an AMQ-URL card still downloads.
- [x] **Step 5 - Settings control** - `SettingsClipSourceControl.vue` (a
  `<select>`: "AnisongDB only", "Both (AnisongDB preferred)",
  "animethemes.moe only") in the Playback section of `app/pages/settings.vue`,
  with a one-line hint under it that it controls where clips stream and
  download from, not metadata; `clipSource` added to the page's client-side
  settings type. *Done when:* in the browser, `/settings` shows the control
  with "AnisongDB only" selected on a fresh setting, changing it persists
  across a reload, a failed save shows the inline error, and the control
  reads correctly at 400px width.

## Files / areas

- `nuxt-app/server/utils/clipSource.ts` (new) + `clipSource.test.ts` (new)
- `nuxt-app/server/db/schema.ts`, `nuxt-app/server/db/migrations/` (generated)
- `nuxt-app/server/utils/mediaLibrary.ts`
- `nuxt-app/server/api/media-library.get.ts`
- `nuxt-app/server/api/media-library/clip-source.post.ts` (new)
- `nuxt-app/server/api/media/stream.get.ts`, `nuxt-app/server/api/media/prefetch.post.ts`
- `nuxt-app/server/api/cards/download.post.ts`
- `nuxt-app/app/components/settings/SettingsClipSourceControl.vue` (new)
- `nuxt-app/app/pages/settings.vue`

## Data / contracts

- **Load-bearing (64b, 64c):**
  ```ts
  type ClipSource = "anisongdb" | "both" | "animethemes";
  function isClipUrlAllowed(url: string, clipSource: ClipSource): boolean;
  ```
  64b uses it to drop URLs at import; 64c mirrors the same mapping client-side
  (by-hand duplicate, per the F-09 convention in `coding-standards.md`), so
  keep the host mapping in one obvious place.
- `MediaLibrarySettings.clipSource` - text, not null, default `"anisongdb"`.
- `GET /api/media-library` gains `clipSource: ClipSource`.
- `POST /api/media-library/clip-source` - body `{ source: ClipSource }`,
  returns `{ clipSource }`.
- Refusal status for an excluded host: `403` on all three fetch routes
  (distinct from the existing `400` for a host outside the proxy allowlist).

## Testing

- Test runner is configured (Vitest), so Step 1 ships `clipSource.test.ts`.
  `setClipSource` validation is a thin wrapper over `isClipSource`, which the
  same test covers.
- Steps 2-4 are route/integration surfaces: verify with `curl` against the dev
  server plus a listing of the stream-cache and download folders.
- Step 5 is UI: browser evidence at desktop and 400px widths.
- Final gate: `bun run test` and `bun run build` in `nuxt-app/`.

## Notes for the AI

- **Do not change `parseAllowedStreamUrl` or `ALLOWED_MEDIA_DOMAINS`.** They are
  the open-proxy guard, and `removeCachedStream`/`cachedFilePathIfPresent`
  rely on them: card deletion must still clean up a cached animethemes.moe
  file after the setting narrows. The setting is a second, separate check
  applied only on the three fetch routes.
- Refuse before the cache lookup, even when the clip is already cached. The
  rule the user sees is "blocked hosts are not played", and serving cached
  copies would make behaviour depend on cache history.
- Host matching must be exact-or-subdomain on `URL.hostname`, `https:` only -
  the same shape as `parseAllowedStreamUrl` and `isAnimethemesUrl` in
  `cardSourceRefresh.ts`, never a substring test.
- **Known interim behaviour until 64c:** with the default setting, a card
  whose playable URL is animethemes.moe shows the player's existing error
  state (and its Download fallback also gets `403`). That is the intended
  guarantee, just without 64c's graceful fallback; call it out in the step
  review, don't paper over it.
- The migration default flips existing installs to AnisongDB only on first
  boot, which is what the user chose.
- Server routes only touch settings through `mediaLibrary.ts`; the component
  stays presentation-only and calls the route with `$fetch`, matching
  `SettingsPlaybackModeControl.vue`. No hard-coded colors; scoped styles on
  `var(--token)`.
- No em dashes in code comments or copy.
