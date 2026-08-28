# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P2] open - Downloaded files are fully buffered in memory before writing

**File:** nuxt-app/server/utils/mediaDownload.ts:69-75
**Found:** 2026-08-28 by /audit (scope: current; lens: performance)
**Why it matters:** `downloadMediaFile` reads the entire response via `response.arrayBuffer()` before calling `writeFileSync`, with no size cap or streaming. Testing this feature already downloaded a real 47MB animethemes.moe video this way; a larger clip (or a card whose `animethemesVideoUrl` was hand-set to point somewhere unexpected, since `POST /api/cards` doesn't restrict that URL to animethemes.moe) would buffer fully in process memory with no ceiling. Low risk today given animethemes.moe clips are normally short, but it's the kind of resource-usage gap that's cheap to close now and easy to forget later.
**Suggested fix:** Stream the response body straight to disk (e.g. `pipeline(Readable.fromWeb(response.body), createWriteStream(destPath))`) instead of buffering with `arrayBuffer()`, and/or reject early on a `Content-Length` above a sane ceiling.
**Resolution:**

### F-02 [P2] open - Card-download state/logic duplicated verbatim across two pages

**File:** nuxt-app/app/pages/cards/index.vue:28-59, nuxt-app/app/pages/cards/new.vue:64-103
**Found:** 2026-08-28 by /audit (scope: current; lens: quality)
**Why it matters:** `downloadKey`, `canDownload`, `hasAnyDownloadableSource`, `downloadMedia`, the `downloading`/`downloadError` reactive state, the `hasDefaultDownloadFolder` fetch, and the matching `.download-actions`/`.download-btn`/`.download-hint` CSS block are all copy-pasted near-identically between `cards/index.vue` and `cards/new.vue`. `coding-standards.md` explicitly calls for composables (`useX`) for reusable stateful logic rather than duplicating it - this is exactly that case, and a future change (e.g. a different timeout message, a new download state) now has to be made twice to stay in sync, which already almost happened once while building this feature.
**Suggested fix:** Extract a `useCardDownloads()` composable (per `nuxt-app/app/composables/`) that owns `downloading`/`downloadError`/`canDownload`/`hasAnyDownloadableSource`/`downloadMedia`, and share the CSS via a common class or a small shared component for the button group.
**Resolution:**
