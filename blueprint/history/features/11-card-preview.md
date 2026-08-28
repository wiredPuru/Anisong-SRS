# Feature: Card preview

**From build-plan:** feature 11
**Status:** verified

## Goal

Let the user preview a single card - its video/audio playback and its
title/artist/anime info - directly from `/cards`, without starting a full
study session (no due-card queue, no pass/fail, no Leitner box change). A
quick way to confirm a card actually works after adding or editing it.

## In scope

- A new `CardPreviewModal.vue` component: a centered overlay showing
  `StudyMediaPlayer` (video/audio playback, scrub bar - already fixed and
  battle-tested) and `StudyInfoPanel` (title/artist/anime info, box, and its
  built-in EN/Romaji/JP+Furigana toggles) for one card, plus a close
  control.
- Closeable via a close button, clicking the backdrop, or pressing `Escape`
  - standard modal conventions, not asked for explicitly but expected
    baseline behavior for any modal.
- A "Preview" button on each row in `/cards` that opens the modal for that
  card.
- Fixes a pre-existing gap: `cards/index.vue`'s local `CardWithDetails`
  interface is missing `animeTitleNative` (the server has always returned
  it; only this page's client-side type was stale) - needed to pass to
  `StudyInfoPanel`, which requires it for the JP+Furigana toggle.

## Out of scope

- `/cards/new.vue` doesn't get a preview trigger in this pass - the primary
  need is verifying cards that already exist, which lives on `/cards`. Can
  be a fast follow if wanted later.
- No pass/fail controls, no `useStudySession`, no `ReviewLog` writes, no
  `nextReviewAt`/box changes - this never touches study state, by design.
- The Hide Video / Hide Info / Start-at-random-times toggles from feature
  10 are not exposed here - preview always shows the card exactly as a
  normal (non-toggled) session would, since the point is verifying the
  card, not rehearsing session settings.
- No changes to `StudyMediaPlayer.vue` or `StudyInfoPanel.vue` themselves -
  pure reuse as they already exist.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight
   on. Checkpoints are optional; `/complete` makes the real feature-level
   commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the
step was too big, so split it.

## Build steps

- [x] **Step 1 - Preview modal + trigger** - add
  `nuxt-app/app/components/card/CardPreviewModal.vue`: props `card:
  CardWithDetails` (needs the full shape including `animeTitleNative`) and
  `open: boolean`, emits `close`. Renders a fixed-position dimmed backdrop
  with a centered panel (rounded, `var(--shadow-soft)`, matching existing
  card/panel styling) containing `<StudyMediaPlayer :card="card" />` and
  `<StudyInfoPanel :song-title="card.songTitle" :artist-name="card.artistName"
  :anime-title-english="card.animeTitleEnglish"
  :anime-title-romaji="card.animeTitleRomaji"
  :anime-title-native="card.animeTitleNative" :box="card.box" />` (no
  `blurred`, no display-toggle props - plain reuse), plus a close (✕)
  button. Closes on close-button click, backdrop click, or `Escape`
  (`window.addEventListener("keydown", ...)` in `onMounted`/`onUnmounted`,
  matching the pattern already used in `StudyAnswerControls.vue` and
  `study/index.vue`). In `cards/index.vue`: add `animeTitleNative: string`
  to the local `CardWithDetails` interface, a `previewCard: ref<CardWithDetails
  | null>(null)`, a "Preview" button per row - hidden when `sourceBadges(c).length === 0`
  (the existing "No source" case; nothing to preview) - that sets it, and
  `<CardPreviewModal :card="previewCard" :open="previewCard !== null"
  @close="previewCard = null" />` rendered once at the bottom of the page
  (only actually mounts its media elements while `open`, so playback always
  stops cleanly when closed - no explicit pause/cleanup code needed). *Done
  when:* in the browser, clicking "Preview" on a card row opens the modal
  showing that card's playback (scrub bar works, matching the already-fixed
  behavior) and its info panel (including working language toggles);
  closing via the ✕, a backdrop click, and `Escape` all work; a card with
  only an audio source shows the existing audio veil correctly inside the
  modal; a card with no source at all (the existing "No source" badge case)
  has no Preview button; reopening a different card's preview, or closing
  and reopening the same one, cleanly stops/restarts playback each time.

## Files / areas

- `nuxt-app/app/components/card/CardPreviewModal.vue` - new.
- `nuxt-app/app/pages/cards/index.vue` - `animeTitleNative` added to the
  local interface, preview button + modal wiring.

## Data / contracts

No schema or API changes - `GET /api/cards` already returns
`animeTitleNative` (per `CardWithDetails` in `server/utils/cards.ts`); this
step only catches the client-side type up to what the server already sends.

## Testing

No test runner configured (`AGENTS.md` Commands has no `test` entry), and
this is pure UI composition of already-tested components, so it rides on
browser verification: `bun run build` clean, then a live click-through
covering open/close (all three ways), a video card, an audio-only card, and
the language toggles inside the preview. No Playwright in this project (not
added silently here) - same as every other UI step this session, this needs
your confirmation in a real browser.

## Notes for the AI

- This is intentionally a thin wrapper: `StudyMediaPlayer` and
  `StudyInfoPanel` already do all the real work (and already got real bug
  fixes this session - scrub bar, veil states) - don't reimplement any of
  their logic here, just compose them.
- Match `study/index.vue`'s existing `onKeydown`
  `window.addEventListener`/`removeEventListener` pattern for the `Escape`
  handler, not a new approach.
- `cards/new.vue` intentionally has no preview trigger in this feature (see
  Out of scope) - don't add one unless asked.
