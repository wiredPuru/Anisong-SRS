# Fix: Stream cache should live in the packaged build's user-data directory, like the DB and themes folder already do

**Type:** Fix
**Status:** verified

## The problem

Feature 48a made the SQLite DB relocate to an OS-appropriate user-data
directory in a packaged build (`GAQ_SRS_DATA_DIR`, resolved by
`resolveDbPath()` in `server/db/dataDir.ts`), and the default "themes"
library folder (seeded by `ensureDefaultLibraryFolder()`) already piggybacks
on that same directory - both were already correctly bundle-aware.

But feature 41's stream cache (`CACHE_DIR` in `server/utils/streamCache.ts`)
still hardcoded `resolve(process.cwd(), ".data/stream-cache")` - a
project-relative path that only makes sense for the developer workflow. In a
packaged executable, `process.cwd()` is wherever the user launched the
binary from, not the app's own user-data folder, so the stream cache would
have been written to an inconsistent location instead of living next to the
DB and the themes folder like the rest of the app's persisted state.

## The fix

`CACHE_DIR` now resolves the same way `DB_PATH` and the themes folder
already do: under the resolved data directory, not `process.cwd()`.

- `streamCache.ts` computes `CACHE_DIR` from `resolveDbPath(process.env,
  process.cwd())`'s directory, reusing the lightweight `dataDir.ts` helper
  directly rather than importing the DB client module, so this file stays a
  plain fs utility with no SQLite/drizzle dependency.
- No behavior change for the developer workflow: with no `GAQ_SRS_DATA_DIR`
  set, `.data/stream-cache/` resolves exactly where it did before.
- In a packaged build, the cache now lands inside the same user-data
  directory as `gaq-srs.db` and `themes/`.

## Build steps

- [x] **Step 1 - Make the stream cache directory data-dir-aware** - replaced
  the hardcoded `CACHE_DIR` with one derived from `resolveDbPath()`'s
  directory. *Done when:* no-env-var resolves unchanged; `GAQ_SRS_DATA_DIR`
  set resolves inside that directory.

## Verify

- `bun run build` passes clean.
- Ran the actual `dataDir.ts` resolution logic directly via `bun -e`, both
  with and without `GAQ_SRS_DATA_DIR` set:
  - unset: `CACHE_DIR` = `nuxt-app/.data/stream-cache` (unchanged).
  - set to a scratch directory: `CACHE_DIR` resolved inside that directory,
    alongside where `gaq-srs.db` would be.
- Confirmed against the live dev server (`/api/media-library`'s
  `streamCachePath`, added in the previous fix) that the no-env-var case is
  unaffected.
