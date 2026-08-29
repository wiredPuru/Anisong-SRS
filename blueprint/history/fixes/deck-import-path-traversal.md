# Fix: Deck import path traversal via manifest audioFile

**Type:** Fix
**Status:** verified
**Fixes:** F-03

## The problem

`nuxt-app/server/utils/deckImport.ts:67-77` builds `bundledPath = join(sourcePath,
entry.audioFile)` directly from the untrusted, parsed `manifest.json`, then
`copyFileSync`s it into the configured default download folder - with no check
that `bundledPath` actually stays inside `sourcePath`. A manifest containing
`"audioFile": "../../../../etc/passwd"` (or any other traversal payload) makes
the app copy an arbitrary local file into the user's download folder, disguised
as that card's audio. Decks are an explicitly shareable artifact (feature 9's own
goal), so importing a bundle someone else produced is exactly the intended use -
this isn't a hypothetical, self-inflicted-only path.

## The fix

Add a containment check before the file even reaches `existsSync`/`copyFileSync`,
reusing the same `relative()`-based pattern `server/utils/mediaLibrary.ts`'s
`isPathWithinLibrary` already established for local media paths. If
`entry.audioFile` resolves outside `sourcePath`, treat it exactly like a missing
bundled file (skip the copy, `localAudioPath` stays `null`, the entry still
imports using whatever remote URL the manifest carries) - no new error surface,
just the existing graceful-degradation path this file already has for "no local
file in the bundle."

Must not break: legitimate imports of bundles this app's own `/api/decks/export`
produced (their `audioFile` is always `audio/<cardId>-<basename>`, always
contained) - those must keep working exactly as before.

## Build steps

- [x] **Step 1 - Add containment check** - in `deckImport.ts`, add `relative` to
  the existing `node:path` import (`isAbsolute`/`join` already imported), add a
  small private `isWithinDir(baseDir, candidatePath)` helper mirroring
  `mediaLibrary.ts`'s `isPathWithinLibrary` logic, and guard the existing
  `if (existsSync(bundledPath))` check with `isWithinDir(sourcePath, bundledPath) &&`.
  *Done when:* re-importing a bundle produced by this app's own export (from an
  earlier session's `/tmp` test bundles, or a freshly exported one) still copies
  its audio file exactly as before; a hand-edited copy of that same bundle whose
  `manifest.json` sets one entry's `audioFile` to `"../../../../../../tmp/traversal-probe.txt"`
  (a throwaway file created just for this test) imports that entry successfully
  but with `localAudioPath: null` and the probe file is confirmed **not** copied
  anywhere (`ls` the default download folder before/after).

## Verify

No test runner configured, so this rides on direct verification - both cases in
the done-when above, via `curl` against `/api/decks/import` and `ls`/`cat` on the
filesystem, matching how `deckImport.ts` was originally verified when built.
`bun run build` must stay clean.

## Findings

### deck-import-path-traversal/F-01 [P2] closed - Downloaded files are fully buffered in memory before writing

**File:** nuxt-app/server/utils/mediaDownload.ts:56-102
**Found:** 2026-08-28 by /audit (scope: current; lens: performance)
**Why it matters:** `downloadMediaFile` reads the entire response via `response.arrayBuffer()` before calling `writeFileSync`, with no size cap or streaming. Testing this feature already downloaded a real 47MB animethemes.moe video this way; a larger clip (or a card whose `animethemesVideoUrl` was hand-set to point somewhere unexpected, since `POST /api/cards` doesn't restrict that URL to animethemes.moe) would buffer fully in process memory with no ceiling. Low risk today given animethemes.moe clips are normally short, but it's the kind of resource-usage gap that's cheap to close now and easy to forget later.
**Suggested fix:** Stream the response body straight to disk (e.g. `pipeline(Readable.fromWeb(response.body), createWriteStream(destPath))`) instead of buffering with `arrayBuffer()`, and/or reject early on a `Content-Length` above a sane ceiling.
**Resolution:** `downloadMediaFile` in `mediaDownload.ts` is now an async generator that reads the fetch response via `body.getReader()` and writes each chunk to disk immediately (`fs/promises` file handle), yielding a progress event per chunk instead of buffering the whole file with `arrayBuffer()`. Verified against a real 14.99MB animethemes.moe download (`curl -N`): progress grew incrementally to the exact final file size, and the file on disk matched byte-for-byte. Re-reviewed 2026-08-29 by /audit (scope: full): current code confirmed still streaming chunk-by-chunk via `reader.read()`/`fileHandle.write()`, timeout via `AbortSignal.timeout`, partial file cleaned up via `unlinkSync` on error, file handle closed on both paths. No new defect introduced by the fix. Closed.

### deck-import-path-traversal/F-02 [P2] closed - Card-download state/logic duplicated verbatim across two pages

**File:** nuxt-app/app/pages/cards/index.vue:28-59, nuxt-app/app/pages/cards/new.vue:64-103
**Found:** 2026-08-28 by /audit (scope: current; lens: quality)
**Why it matters:** `downloadKey`, `canDownload`, `hasAnyDownloadableSource`, `downloadMedia`, the `downloading`/`downloadError` reactive state, the `hasDefaultDownloadFolder` fetch, and the matching `.download-actions`/`.download-btn`/`.download-hint` CSS block are all copy-pasted near-identically between `cards/index.vue` and `cards/new.vue`. `coding-standards.md` explicitly calls for composables (`useX`) for reusable stateful logic rather than duplicating it - this is exactly that case, and a future change (e.g. a different timeout message, a new download state) now has to be made twice to stay in sync, which already almost happened once while building this feature.
**Suggested fix:** Extract a `useCardDownloads()` composable (per `nuxt-app/app/composables/`) that owns `downloading`/`downloadError`/`canDownload`/`hasAnyDownloadableSource`/`downloadMedia`, and share the CSS via a common class or a small shared component for the button group.
**Resolution:** Extracted `useCardDownloads()` exactly as suggested; both `cards/index.vue` and `cards/new.vue` now call it instead of maintaining their own copies. Verified via direct reproduction scripts hitting the real streaming endpoint (93-line and 2,641-line ndjson streams both parsed correctly end-to-end) plus a full browser click-through on both pages after a clean dev-server restart. CSS duplication (`.download-btn` etc.) was not addressed - only the JS/TS logic was in scope here. Re-reviewed 2026-08-29 by /audit (scope: full): read `useCardDownloads.ts` in full - streaming ndjson parser with correct partial-line buffering, proper error propagation, no new defect. Both pages confirmed still calling it exclusively, no reverted duplication. Closed. (The declared-out-of-scope CSS duplication remains and is not itself a new finding - it's a known, accepted, low-risk style overlap, not logic that can drift out of sync.)

### deck-import-path-traversal/F-03 [P1] closed - Deck import copies an arbitrary local file when a bundle's manifest.json is crafted with a path-traversal `audioFile` value

**File:** nuxt-app/server/utils/deckImport.ts:67-77
**Found:** 2026-08-29 by /audit (scope: full; lens: security)
**Why it matters:** `importBundle` builds `bundledPath = join(sourcePath, entry.audioFile)` directly from the untrusted, user-parsed `manifest.json`, then `copyFileSync(bundledPath, destPath)`s it into the configured default download folder - with no check that `bundledPath` stays inside `sourcePath`. `entry.audioFile` is never sanitized (unlike every filename this app *generates*, which goes through `sanitizeSegment` to strip path-special characters). A bundle is explicitly a shareable artifact per feature 9's own goal ("moved to another copy of the app, or shared"), so the threat model already includes importing a bundle someone else produced or edited. A manifest.json with `"audioFile": "../../../../../../etc/passwd"` (or any path escaping the bundle directory) makes `bundledPath` resolve outside `sourcePath`, and the app will copy that file - whatever it is - into the user's own download folder, disguised as that card's audio. This is a real, concrete path-traversal primitive triggered by nothing more than pointing Import at a booby-trapped folder.
**Suggested fix:** Before the `existsSync`/`copyFileSync` calls, validate containment the same way `mediaLibrary.ts`'s `isPathWithinLibrary` already does for local media paths: resolve `bundledPath`, compute `relative(sourcePath, bundledPath)`, and reject/skip the entry (push to `errors`, do not copy) if that relative path starts with `..` or is absolute. Apply the same check to any other manifest-supplied relative path before it reaches a filesystem call.
**Resolution:** Added `isWithinDir(baseDir, candidatePath)` to `deckImport.ts` (same `relative()`-based check as `mediaLibrary.ts`'s `isPathWithinLibrary`), guarding the existing `existsSync(bundledPath)` check. A traversal attempt now degrades exactly like a missing bundled file (skipped, falls back to the manifest's remote URL) rather than being copied. Verified two ways: (1) exported a real deck with local audio, deleted the card, re-imported the legitimate bundle - audio copy still works unchanged. (2) Hand-crafted a malicious `manifest.json` with `"audioFile": "../../../../../../tmp/traversal-probe.txt"` pointing at a throwaway probe file, deleted the card again, imported the malicious bundle: `created: 1` (card still imports), `localAudioPath: null` (correctly not set), `animethemesAudioUrl` correctly carried from the manifest, and a full directory-listing diff of the default download folder before/after the malicious import showed zero new files - the probe was never copied anywhere. `bun run build` clean. Re-reviewed 2026-08-29 by /audit (scope: current; lens: security): confirmed the `isWithinDir` logic correctly mirrors `mediaLibrary.ts`'s trusted `isPathWithinLibrary` pattern (rejects `..`-escaping and absolute `relative()` results, rejects the base dir itself as a match) and that `path.join`'s own behavior means a bare absolute-looking `audioFile` (no `..`) was never actually exploitable in the first place - only `..` traversal was, and that's exactly what's now blocked. Scanned the rest of `deckImport.ts` and its sibling `deckExport.ts` for any other manifest-driven filesystem path - none found. Independently re-ran the exploit with a different payload shape (`"audio/../../../../../../tmp/audit-probe-2.txt"`) and a fresh probe file against a different card: a full sorted-directory-listing hash of the default download folder was identical before and after the malicious import, and the resulting card again correctly landed on `localAudioPath: null` with the manifest's remote URL. `bun run build` clean. No new defect introduced by the fix. Closed.
