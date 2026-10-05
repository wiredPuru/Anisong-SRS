# Current Feature

# Save anime cover images locally

**Type:** Fix
**Status:** verified

## The problem

Anime covers are stored only as AniList CDN URLs (`anime.coverImageUrl`, feature
12) and hotlinked by the browser. When AniList or its CDN is down, covers vanish
everywhere: `/cards`, `/decks`, Home, `/stats`, the Study cover-art record and
ambient glow, and the party display's cover mode. The database has 518 anime,
466 with a cover URL, none saved locally.

## The fix

Keep the remote URL as the source of truth and fallback, and add a local copy
beside it, the same way feature 92 stores deck pictures.

- **Storage:** nullable `anime.coverImagePath` (Drizzle migration `0028`), holding
  a file name inside a new `anime-covers/` folder beside the database, so it
  relocates with `GAQ_SRS_DATA_DIR` and survives a one-click update. Name is
  `<animeId>-<8 hex>.<ext>`; the type comes from the file's magic bytes
  (`sniffImageType`, `deckImage.ts`), never the response header. Cap 5 MB.
- **Serving:** `GET /api/anime/cover?id=` returns the file; if the file is gone it
  redirects to the remote URL, and 404s only when there is neither.
- **One read path:** a shared SQL expression turns "has a local file" into
  `/api/anime/cover?id=<id>&v=<name>` and otherwise yields the remote URL. It
  replaces the raw `anime.coverImageUrl` select in `cards.ts`, `decks.ts`,
  `deckFilterPreview.ts`, and `stats.ts` (two selects; `mal-list.get.ts` returns live
  AniList data, not the column, so it is untouched), so
  every client field (`animeCoverImageUrl`, `coverImageUrl`) keeps its name and
  shape and no component changes.
- **Party display:** `/api/party/display/cover` reads the local file first and
  only fetches AniList when there is none, so the display still never receives
  an AniList URL.
- **Download on import:** after an anime is upserted with a cover URL (anime,
  song, and artist import), save the file in the background, best-effort. A
  failed download never fails the import. An anime that already has a file is
  not re-fetched if AniList later changes its cover art. A cover fetched by the
  missing-cover backfill is picked up by the Settings action below.
- **Backfill:** `SettingsCoverArtControl` shows how many covers are not saved
  locally and a "Save covers locally" action that fetches them one at a time
  (AniList rate limits), counting saved and failed, safe to re-run.

**Must not break:**

- Feature 12's rule that artist decks never show a cover.
- Cards whose anime has no cover or whose image fails to load still fall back to
  the plain veil or monogram.
- Deck export/import manifests (no cover data in them today; unchanged).

**Out of scope:** the Kai mascot (already bundled in `public/`), AniList
catalog-browse thumbnails (live results, not stored), deck pictures (already
local), deleting a cover file when an anime goes away (anime rows are never
pruned).

## Build steps

- [x] **1. Storage, route, and read path.** Migration `0028`, `animeCoverStore.ts`
  (folder, safe name check, save from bytes, local lookup), `GET /api/anime/cover`,
  the shared SQL expression applied at the five read sites, and the party cover
  route's local-first read. Unit tests for the name check, URL builder, and
  save/lookup against a temp directory. **Done when:** with a file saved by hand
  for one anime, its cover on `/cards` loads from `/api/anime/cover`, deleting
  the file falls back to the AniList image, and `bun run test` is green.
- [x] **2. Save on import.** `ensureAnimeCoverLocal(animeId, fetchImage)` (fetcher
  injected, like `backfillMissingCovers`), called (in the background) after upsert in
  anime, song, and artist import. Tests drive: saved, remote
  failure, not an image, over 5 MB, already-saved skipped, missing file re-saved.
  **Done when:** importing a new anime creates its file in `anime-covers/` and
  sets `coverImagePath`, and an import with the CDN blocked still succeeds.
- [x] **3. Settings backfill.** `POST /api/anime/covers/save-local` loops anime with
  a cover URL and no local file (sequential, tolerant of failures) returning
  `{ checked, saved, failed }`; the Settings control shows the not-yet-local
  count (`countAnimeCoversNotLocal`) and the action. **Done when:** running it
  against the live library saves the 466 covers, the count drops to zero, and a
  second run reports nothing to do.

## Verify

1. Run the Settings backfill, then confirm `anime-covers/` holds about 466 files
   under roughly 100 MB.
2. Block `s4.anilist.co` (offline mode or a hosts entry) and reload `/cards`,
   `/decks`, Home, and `/study` on an audio-only card: covers still render.
3. Import a new anime from `/cards` search and confirm its cover is saved without
   a visit to Settings.
4. `bun run test` and `bun run build` pass.
