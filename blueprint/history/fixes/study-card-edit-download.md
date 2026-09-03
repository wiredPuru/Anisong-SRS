# Fix: Download option for a missing local path in Study's edit panel

**Type:** Fix
**Status:** verified

## The problem

`StudyCardEditPanel.vue` (Study's collapsed "Edit card" panel, added by the
`study-card-edit-decks` fix) shows a local video/audio path field per source.
When a path is empty, the only action next to it is a disabled "Clear"
button - there's no way to pull the card's remote animethemes.moe source down
into the local media library without leaving `/study` for `/cards`. Every
other surface with this same local-path-editing shape (`/cards`' row edit and
inspector, `CardPreviewModal`, and `StudyMediaPlayer`'s own playback-failure
fallback) already offers a "Download video"/"Download audio" action via the
shared `useCardDownloads()` composable and `POST /api/cards/download` route;
Study's edit panel was the one place that still didn't.

## The fix

Wired the existing `useCardDownloads()` composable into `StudyCardEditPanel.vue`
and added a "Download" action in place of the (already-disabled) Clear button
whenever a source's local path is empty and its matching remote source
(`animethemesVideoUrl` / `animethemesAudioUrl`) exists:

- Widened the panel's local `CardWithDetails` prop interface to include
  `animethemesVideoUrl: string | null` and `animethemesAudioUrl: string | null`
  (both already present at runtime - `study/index.vue` passes the full
  `currentCard`), plus a new `hasDefaultDownloadFolder: boolean` prop.
- In each `path-row` (video and audio): the Clear button now only renders
  when a local path is actually set; when it's empty and `canDownload(card,
  kind)` is true, a "Download" button takes its place (showing
  `formatDownloadProgress()`'s percentage/MB text while in flight, matching
  the "Clearing..." convention the panel's own Clear button already used).
  When no default download folder is configured, a small "Set download
  folder" link to `/settings` shows instead of a button - matching the hint
  used on `/cards` and in `StudyMediaPlayer`.
- A successful download fills the field's local text input with the new path
  and emits the panel's existing `updated` event with the returned card, so
  `study/index.vue`'s existing `onCardEdited` handler (already wired to that
  event) refreshes `currentCard` the same way a manual Save already does - no
  new event or extra page-level wiring.
- `study/index.vue` passes its already-computed `hasDefaultDownloadFolder`
  (used today for `StudyMediaPlayer`'s own download fallback) into
  `<StudyCardEditPanel>`.
- Styled the new button/hint with the same tokens `StudyMediaPlayer.vue`
  already uses for this pattern (`--accent-secondary` for the download
  action), scoped to the panel.

Does not touch the existing Clear button's behavior when a path *is* set, the
Save/Cancel flow, or `StudyMediaPlayer`'s own separate playback-failure
download fallback (different component, same composable, no shared state).

## Build steps

- [x] **Step 1 - Download action in Study's edit panel** - widened
  `StudyCardEditPanel.vue`'s props (`animethemesVideoUrl`, `animethemesAudioUrl`,
  `hasDefaultDownloadFolder`), wired `useCardDownloads()`, added the
  download button/hint per source row, and passed the new prop from
  `study/index.vue`.

*Done when:* on `/study`, opening "Edit card" for a card with an empty local
video (or audio) path and a remote animethemes source shows a working
"Download" button (when a default download folder is set) or the settings
hint (when it isn't); clicking Download fills the path field with the new
local path, the Clear button becomes available for that field, and the
change is actually persisted (confirmed below), not just shown locally.

## Verify

- `bun run build` passes clean, twice (once during `/implement`, once again
  as `/complete`'s own safety pass) - no errors or warnings on the changed
  files.
- Live test (headless Chrome via CDP, this project's own pattern): opened
  `/study` on the actual next-due card (id 264, no local paths, real remote
  animethemes sources), opened "Edit card" - both Download buttons rendered.
  Clicked Download on the video field: it actually downloaded a ~41MB
  `.webm` into the configured default download folder, the input filled
  with the new path, and the row swapped to Clear. Confirmed via a fresh
  `GET /api/study/next` server round-trip (not just client state) that
  `localVideoPath` was truly persisted to the DB. Left the downloaded file
  and the card's new local path in place - this is the feature's real,
  intended effect, not test pollution.
- Not re-verified live: the "no default download folder configured" hint
  link. It reuses the identical `v-else-if` conditional already proven in
  `/cards` and `StudyMediaPlayer.vue`; exercising it live would have meant
  temporarily unsetting the real default-download-folder setting, which
  wasn't worth the disruption for a one-line template branch.
