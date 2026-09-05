# Current Feature

**Title:** Import panel spacing and missing visual feedback on /cards

**Type:** Fix

**Status:** verified

## The problem

Two issues with the `/cards` "Import from AniList / MyAnimeList" panel
(`app/pages/cards/index.vue`), folded into one fix since they touch the same
few lines of that panel.

**1. Spacing.** `.import-panel` is styled `margin: 0 24px 16px;` - zero top
margin - so the toggle button sits flush against the header's bottom border,
touching it.

**2. No visual feedback.** The only sign anything is happening is the Import
button's label switching to "Importing...". That is badly insufficient here,
because `/api/lookup/mal-list` resolves MyAnimeList entries to AniList one
sequential round-trip per anime, so a large Completed list can take minutes.
Specifically:

- No status line or spinner while a fetch is in flight - a slow import is
  indistinguishable from a hung one.
- Stale results stay on screen during a re-import: `CardImportListResults`
  renders whenever `importResults !== null`, so the previous list sits there
  looking current while a new fetch runs.
- No summary after a successful import - you get a bare list with no count and
  no indication of which source(s) it came from, or that duplicates were
  merged.
- An empty result falls through to `CardImportListResults`' generic "No
  matching anime found.", which reads like a failed search rather than "that
  Completed list is empty or private."
- Clicking Import with both fields blank silently does nothing
  (`if (!aniListUsername && !malUsername) return;`) - no message at all.

## The fix

Add a status region to the panel driven by state `runImport()` already has or
can trivially capture, and give the panel its missing top margin.

Must not break: the existing per-source error lines, the `Promise.allSettled`
behavior where one source failing doesn't block the other, or
`mergeImportCandidates`' dedupe.

## Build steps

- [x] **Step 1 - panel top margin** - change `.import-panel`'s margin from
  `0 24px 16px` to `16px 24px`.
  **Done when:** the Import toggle button has a visible, symmetrical gap
  above and below it rather than touching the header divider.

- [x] **Step 2 - import status feedback** - capture per-source result counts
  in `runImport()`, add an `importSummary` ref and a blank-input hint, and
  render a status line in the panel: a "importing from <sources>..." message
  while `importLoading` (noting a large MyAnimeList list can take a while), a
  post-import summary naming the per-source counts and merged total, and a
  distinct empty-list message. Gate `CardImportListResults` on
  `!importLoading` so stale results are hidden during a re-import, and
  replace the silent blank-input no-op with a visible hint.
  **Done when:** clicking Import with both fields blank shows a hint instead
  of nothing; a running import shows a status line and hides any previous
  results; a finished import shows a count summary; an empty Completed list
  says so rather than "No matching anime found."

## Verify

- Open `/cards`, confirm the Import button no longer touches the header.
- Click Import with both fields empty - a hint appears.
- Enter a username and click Import - a status line appears while it runs, any
  previous result list disappears, and a summary with counts replaces it when
  done.
- Note: AniList and Jikan were both unreachable when feature 58 shipped, so
  the happy-path summary may only be observable once they recover; the
  loading, blank-input, and error paths are all testable regardless.

## Verification gaps

- Step 1 (margin) is confirmed by screenshot against the reported symptom.
- Step 2's four new conditionals (blank-input hint, loading status line,
  count summary, empty-list message) are verified by `bun run build` and
  code review only. The repo's `bun run measure` harness supports a single
  click per run, so the two-click sequence this panel needs (open the panel,
  then press Import) could not be scripted; and with AniList and Jikan both
  unreachable, the summary path has no real data to render yet. Re-check
  these by hand when those services recover.
