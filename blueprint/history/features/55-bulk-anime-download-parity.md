# Feature: Bulk add-all + download-all parity for anime search results

**From build-plan:** feature 55
**Status:** verified

## Goal

The Anime add-candidate group on `/cards` (`CardAddAnimeResults.vue`, feature
49a) only supports adding one theme at a time from an expanded anime, and
offers no bulk download. The Artist group (`CardAddArtistResults.vue`,
feature 49b) already has both: "Add all" adds every theme across every anime
in one click, and "Download all" bulk-downloads afterward. This feature
brings the Anime group up to parity - "Add all" for the currently expanded
anime's themes, and "Download all" for whatever was added - and, while
touching the download loop, fixes the same gap in the Artist group: today's
"Download all" only downloads video, silently skipping any audio-only
theme. Both groups' "Download all" will cover audio and video.

## In scope

- An "Add all" button in `CardAddAnimeResults.vue`'s expanded theme picker
  that adds every not-yet-added theme for that anime, skipping themes
  already added (mirrors `CardAddArtistResults.vue`'s existing
  `addAllThemes`, scoped to one anime instead of every anime group).
- A "Download all" button in `CardAddAnimeResults.vue` that downloads every
  remaining downloadable source (video and audio) for every added theme
  under the expanded anime, once a default download folder is configured.
- Extending `CardAddArtistResults.vue`'s existing "Download all" to also
  download audio, not just video, for every added card across every anime
  group - a fix to already-shipped 49b behavior.

## Out of scope

- Selecting and importing multiple *different* anime (multiple search
  results) in one action - this feature bulk-adds all themes within a
  single expanded anime, matching artist mode's "all anime for this
  artist" scope, not a new multi-anime picker.
- Any change to `/api/cards`, `/api/cards/download`, or `/api/lookup/*` -
  every action here is a client-side loop over the same per-card endpoints
  those two components already call one row at a time.
- Any change to the Song add-candidate group (one-click add already, no
  bulk needed) or to `/decks`' own add-existing/add-new-anime flows.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - "Add all" for the expanded anime's themes** -
  `CardAddAnimeResults.vue` gains an `addingAll` ref and an `addAllThemes()`
  function that loops `selectedAnime.value.themes`, calling the existing
  `addCard(theme)` for each theme not already in `addedCards`, awaited
  sequentially (matching the artist group's pattern, so add errors on one
  theme don't abort the rest). An "Add all" button renders above the theme
  list, next to the existing per-theme "Add card" affordance, shown
  whenever `selectedAnime` has themes and disabled while `addingAll` or
  `importing`. *Done when:* searching an anime, expanding it, and clicking
  "Add all" adds every not-yet-added theme (each flips to its "Added" row
  state with Preview/Delete), skips themes already added, and the local
  cards list refreshes.

- [x] **Step 2 - "Download all" for the expanded anime's added themes** -
  `CardAddAnimeResults.vue` gains a `downloadingAll` ref and a
  `downloadAllMedia()` function that loops `selectedAnime.value.themes`,
  and for each added card downloads video when
  `canDownload(card, "video")` and audio when `canDownload(card, "audio")`
  (both, not either/or - a theme can need both). A "Download all" button
  renders next to "Add all", shown when `hasDefaultDownloadFolder` is true
  and at least one added card under the expanded anime has any
  downloadable source (reuse `hasAnyDownloadableSource`), disabled while
  `downloadingAll`. *Done when:* after bulk-adding an anime's themes with
  remote sources, clicking "Download all" downloads every remaining video
  and audio source, showing each row's existing per-item progress bar, and
  each card's local path updates once its download finishes.

- [x] **Step 3 - Artist "Download all" covers audio too** -
  `CardAddArtistResults.vue`'s `downloadAllVideos()` and
  `hasDownloadableAddedVideos()` are renamed to `downloadAllMedia()` /
  `hasDownloadableAdded()` and extended to also check/download
  `canDownload(card, "audio")` alongside the existing video check, for
  every theme across every anime group - same both-kinds logic as Step 2.
  The "Download all" button's `v-if` and `@click` are updated to the
  renamed functions; no other markup changes. *Done when:* importing an
  artist with at least one audio-only theme, adding it (individually or
  via "Add all"), and clicking "Download all" downloads that theme's audio
  alongside every other added theme's video, where before it was silently
  skipped.

## Files / areas

- `nuxt-app/app/components/card/CardAddAnimeResults.vue` (steps 1-2)
- `nuxt-app/app/components/card/CardAddArtistResults.vue` (step 3)

No server route changes - `POST /api/cards` and the streamed
`POST /api/cards/download` (via `useCardDownloads`'s `downloadMedia`) are
called exactly as they already are per-row; this feature only adds
client-side loops over those existing calls.

## Data / contracts

None new. Reuses each component's existing locally-duplicated
`CardWithDetails` / theme-result shapes and the shared `useCardDownloads`
composable (`canDownload`, `hasAnyDownloadableSource`, `downloadMedia`)
unchanged.

## Testing

No test runner target here - Vitest is configured, but every function this
feature adds is a stateful async UI loop driving existing, already-covered
API calls (sequential `$fetch`/`downloadMedia` calls gated on reactive
component state), not pure logic with an assertable input/output shape.
Nothing in `canDownload`/`hasAnyDownloadableSource` changes. Verify each
step with the dev server (`bun run dev`) against `/cards`:

- Step 1: search an anime with 2+ themes, expand it, click "Add all",
  confirm every theme adds and already-added themes are skipped on a
  second click.
- Step 2: with a default download folder set (`/settings`), bulk-add an
  anime's themes, click "Download all", confirm both video and audio
  download where each theme has that source, with visible per-row
  progress.
- Step 3: search an artist with at least one audio-only theme (or
  temporarily treat any theme as audio-only for the check), bulk-add, click
  "Download all", confirm audio now downloads too, not just video.

## Notes for the AI

- Match `CardAddArtistResults.vue`'s existing `addAllThemes`/download-loop
  style exactly (sequential `for...of` with `await`, not `Promise.all` -
  the artist flow deliberately serializes to avoid hammering the
  animethemes.moe CDN and to keep progress bars legible one at a time).
- `CardAddAnimeResults.vue` only ever has one anime expanded at a time
  (`expandedAniListId`), so its bulk actions are scoped to
  `selectedAnime.value.themes` directly - no group-nesting loop like the
  artist component's `animeGroups` needed.
- Keep the "Add all" / "Download all" buttons visually consistent with the
  artist modal's `.bulk-actions` row (same classes/tokens) so the two
  surfaces read as one pattern.
- `downloadAllMedia`/`hasDownloadableAdded` in Step 3 is a rename of
  existing functions - update both the `<script>` definitions and every
  template reference (the `v-if` on the button and its `@click`), not just
  the function bodies.
