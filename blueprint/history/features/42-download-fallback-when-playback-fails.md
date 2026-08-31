# Feature: Download fallback when playback fails

**From build-plan:** feature 42
**Status:** verified

## Goal

When a card's video/audio clip fails to load during Study or Preview, show a
"Download video" / "Download audio" action right on the error state instead of
a dead-end error message - reusing feature 8's existing per-card download
machinery (`useCardDownloads`, `POST /api/cards/download`) rather than building
a new one.

## In scope

- `StudyMediaPlayer.vue`'s existing `.error-veil` (shown on the media
  element's `error` event) gains a download action for whichever remote
  source exists and isn't already local (`animethemesVideoUrl`/
  `animethemesAudioUrl` without a matching `localVideoPath`/`localAudioPath`),
  using the same `useCardDownloads()` composable, progress display, and
  "set a default download folder" hint that `/cards` (feature 8) already
  shows - so behavior is identical everywhere a card can be downloaded.
- Both Study (`/study`) and Preview (`CardPreviewModal`) get this, since both
  render their player through `StudyMediaPlayer`.
- Once a download completes, clear the error state so normal playback (via
  the now-local file) becomes available immediately with no reload - the
  user presses play same as any other card.

## Out of scope

- A card whose failure is a **broken local file** (a `localVideoPath`/
  `localAudioPath` is already set but 404s or won't decode) - feature 8's
  download route refuses to download over an existing local path ("Clear it
  first to re-download"). Recovering that case means the existing Clear
  action (feature 27) on `/cards`' row edit or Preview's edit mode, not this
  error-state fallback. This feature only targets a still-remote,
  not-yet-downloaded source.
- Auto-retrying playback after a successful download - the user presses
  play, matching how every other card in the app starts (no autoplay
  anywhere in `StudyMediaPlayer` today).
- Any change to feature 41's stream cache or prefetching - a playback
  failure is independent of whether the clip was cached.
- A card with no downloadable remote source at all (pure local-file card
  whose file is missing) - the error veil still shows just the existing
  message, no fallback action, since there is nothing to download.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Download action in `StudyMediaPlayer`'s error veil, wired
  into `/study`** - Add `id` to the `card` prop's
  `Pick<CardWithDetails, ...>` type (needed to call the download API) and a
  new `hasDefaultDownloadFolder?: boolean` prop. Call `useCardDownloads()`
  inside the component. In the `v-if="errorMessage"` `.error-veil`, when
  `hasAnyDownloadableSource(card)` is true, render the same
  download-button / in-progress-progress-bar / `downloadError` message
  pattern `/cards` already uses (feature 8), gated on
  `hasDefaultDownloadFolder` the same way (show the "set a default download
  folder" hint otherwise). On a successful download, emit
  `emit("local-path-updated", { kind, localPath })` rather than mutating the
  prop directly (props are readonly). Add
  `watch(src, () => { errorMessage.value = null })` so the error clears the
  moment the media source actually changes (covers both the download case
  and the pre-existing case of `card` changing while the component stays
  mounted, e.g. inside `CardPreviewModal`, addressed fully in Step 2). Then
  wire the one real consumer needed to exercise this end-to-end: extend the
  existing `useFetch("/api/media-library")` call in `study/index.vue` to
  also type `defaultDownloadFolder: string | null`, compute
  `hasDefaultDownloadFolder` from it (same one-line pattern as `/cards`),
  pass it into `<StudyMediaPlayer>`, and handle `@local-path-updated` by
  patching `currentCard.value = { ...currentCard.value, [kind === "video" ?
  "localVideoPath" : "localAudioPath"]: localPath }` so the session's
  in-memory card reflects the new local file without a refetch. *Done
  when:* on `/study`, forcing a clip to fail (e.g. temporarily point a test
  card's `animethemesVideoUrl` at an unreachable URL) shows "Download
  video" in the error state instead of a dead end; clicking it downloads
  the file, the veil clears, pressing play plays the local copy, and
  reloading `/cards` afterward shows the path was actually persisted (not
  just cleared client-side).

- [x] **Step 2 - Wire Preview (`CardPreviewModal`) and its three callers** -
  Add a `hasDefaultDownloadFolder?: boolean` prop to `CardPreviewModal`,
  forward it to its nested `<StudyMediaPlayer>`, and handle that player's
  `local-path-updated` event by emitting `CardPreviewModal`'s own existing
  `updated` event with `{ ...props.card, [kind === "video" ?
  "localVideoPath" : "localAudioPath"]: localPath }` - the same event its
  edit-save and clear-local-path actions already emit, so all three
  existing callers (`/cards`, `/cards/new`, `/decks`) update their lists the
  same way they already do for an edit. Each of those three pages already
  computes `hasDefaultDownloadFolder` for their own row-level download UI
  (feature 8) - pass that same computed value into `<CardPreviewModal
  :has-default-download-folder="hasDefaultDownloadFolder">`. *Done when:*
  opening Preview on a card with a failing remote clip, from any of the
  three pages, shows the same download fallback and updates that page's
  list once it succeeds (verified by reopening Preview and seeing the local
  badge/path).

## Files / areas

- `app/components/study/StudyMediaPlayer.vue` - error veil UI, new prop,
  new emit, the `src` watch.
- `app/components/card/CardPreviewModal.vue` - new prop, forwards to
  `StudyMediaPlayer`, translates its event into the existing `updated` emit.
- `app/pages/study/index.vue` - extends its existing media-library fetch,
  passes the new prop, patches `currentCard` on the new event.
- `app/pages/cards/index.vue`, `app/pages/cards/new.vue`,
  `app/pages/decks/index.vue` - pass their existing
  `hasDefaultDownloadFolder` computed into `<CardPreviewModal>`.
- No server-side changes - reuses `POST /api/cards/download` and
  `useCardDownloads()` exactly as they exist.

## Data / contracts

- No schema or API changes. Reuses `CardWithDetails` (already defined in
  `useStudySession.ts` and duplicated locally in `CardPreviewModal.vue`,
  matching that file's existing convention) and the existing
  `DownloadableCard`/`useCardDownloads()` contract.
- New, purely client-side event contract:
  `local-path-updated: [{ kind: "video" | "audio"; localPath: string }]`,
  emitted by `StudyMediaPlayer` and re-emitted (translated into `updated`)
  by `CardPreviewModal`.

## Testing

No test runner is configured for this project yet (no `test` command in
`AGENTS.md`), so this rides on manual/browser evidence, not unit tests:

- Verify the Step 1/2 done-whens above directly in the running app on
  both `/study` and Preview (opened from all three pages that render it).
- Confirm the existing, unrelated "card has no source at all" error path
  (no remote reference) still shows just the plain error message, no
  fallback button.
- Confirm a card that already has a local path for the failing kind (the
  out-of-scope "broken local file" case) shows no fallback button, since
  `canDownload` is false there.
- Run the project's build (`bun run build`) as the final check.

## Notes for the AI

- Match feature 8's existing UI exactly (button labels "Download video" /
  "Download audio", the progress bar + percentage, the "set a default
  download folder" hint linking to `/settings`) rather than inventing new
  copy or a new visual treatment - this is the same action surfaced in a
  new place, not a new feature.
- `StudyMediaPlayer` remounts on every card change in `/study` (`:key`
  bound to `presentationKey`), so `useCardDownloads()` state there is
  naturally fresh per card - no manual reset needed. It does *not* remount
  per card inside `CardPreviewModal`, which is exactly why the `watch(src,
  ...)` in Step 1 matters there too.
- Keep the emit-and-let-the-parent-patch-state pattern (no direct prop
  mutation) - it already matches how `CardPreviewModal` handles its own
  edit-save and clear-local-path actions today.
- Don't touch `server/api/cards/download.post.ts` or `useCardDownloads.ts` -
  both already do exactly what this needs.
