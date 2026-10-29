# Feature: Story on /kanji (118b)

**From build-plan:** feature 118b (sub-feature of 118, "RTK stories on Kanji Study")
**Status:** verified (tests, build, browser run via playwright-cli; failed-save error path not exercised)

## Goal

After Reveal on `/kanji`, show the kanji's story: the user's own if they wrote
one, otherwise the top Koohii story from 118a with its author credited. An editor
on the page, pre-filled with whatever is shown, saves the user's own story
(feature 110b's `kanji_story`), which then wins everywhere.

## In scope

- Show after Reveal: personal story, else the default (text, author, link to the
  source page), else nothing. Hidden before Reveal, since a story gives the
  answer away.
- The default is requested only when the kanji has no personal story, in
  parallel with the story load, and never blocks grading.
- Edit button: a textarea pre-filled with the shown story, Save, Cancel, and
  Remove (only when a personal story exists, reverting to the default).
- "Use this story" button on a default: saves it unchanged as the user's own.
- Saving or removing updates the page at once; the kanji breakdown's own editor
  reads the same `kanji_story` row, so it agrees after a reload.

## Out of scope

- Other Koohii stories beyond the top one, and a link-out picker.
- The default story inside the breakdown's detail view (Study and Listen);
  that view keeps showing only the user's own story.
- Hotkeys for editing; the existing keys (Space, Enter, arrows) stay ignored
  while typing in the textarea, as `isTypingTarget` already does.
- Any server, schema, or migration change (118a delivers the route).

## Decisions made in this spec

- **Reveal first:** the story, the default, and the editor all appear only
  after Reveal. Edit stays available while grading, so a story can be written
  before pressing Missed or Got it.
- **Default is never saved silently.** Only Save or "Use this story" writes
  `kanji_story`.
- **Offline or failure shows nothing extra.** `reason` of `offline` or
  `unavailable` renders no default and no error, since the default is a bonus.
- **Editing does not touch grading or the clip.** Opening the editor leaves the
  background player and the card's schedule alone.

## Depends on

118a (`GET /api/kanji/story/default`, on branch `feature/kanji-default-story`,
merge it first).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Story view logic** - in `app/utils/kanjiStudy.ts` add
  `storyView(personal, defaultReply)` returning `{ kind: "personal", text }`,
  `{ kind: "default", text, author, url }` or `{ kind: "none" }` (personal wins;
  a default with null text is none; a blank personal string counts as none).
  Unit tests for each case. In `useKanjiStudy.ts` add the client
  `DefaultStoryReply` type (same field order as the server's), a `defaultStory`
  ref loaded in `loadNext` only when the personal story is null (a failed fetch
  is swallowed), and return it. *Done when:* `bun run test` passes and the build
  typechecks.
- [x] **Step 2 - Show the story** - `/kanji` renders `storyView(story,
  defaultStory)` after Reveal: personal as today; default as the text with a
  line "Koohii story by <author>" linking (new tab, `noopener`) to `url`. Style
  with existing tokens and keep it inside the scrolling card. *Done when:* in
  the browser, a kanji with no personal story shows the Koohii default with its
  author after Reveal and nothing before it; one with a personal story shows
  that and no author line; the page still does not scroll at 1280x720.
- [x] **Step 3 - Edit, use, remove** - composable actions `saveStory(text)` and
  `removeStory()` (PUT/DELETE `/api/kanji/story`, with saving and error state),
  an `editing` toggle, and the page UI: Edit opens the textarea pre-filled with
  the shown story (`storyDraftState` from `japaneseBreakdown.ts` gates Save and
  the 2000-character limit), "Use this story" on a default, Remove on a personal
  story (back to the default, refetched). Cancel and a kanji change close the
  editor. *Done when:* in the browser, editing the default and saving makes it
  the personal story (reload keeps it, author line gone), Remove restores the
  default, "Use this story" saves it as is, an over-long draft cannot be saved,
  a failed save shows an error and keeps the draft, and Space/arrows do not
  reveal or grade while typing.

## Files / areas

- `nuxt-app/app/utils/kanjiStudy.ts` (+ test)
- `nuxt-app/app/composables/useKanjiStudy.ts`
- `nuxt-app/app/pages/kanji/index.vue`

## Data / contracts

- Consumes 118a's reply `{ char, text, author, url, reason }` and 110b's
  `GET/PUT/DELETE /api/kanji/story`. Nothing new is stored.
- The client `DefaultStoryReply` mirrors the server type in
  `server/utils/kanjiDefaultStories.ts` with the same field order (F-09).

## Testing

- Vitest for `storyView` (personal wins, default, null default, blank personal).
- Steps 2 and 3 are UI: browser evidence (screenshot after Reveal for a default
  and a personal story, the editor open, the 1280x720 fit) plus `bun run build`.

## Notes for the AI

- Reuse `storyDraftState`, `MAX_KANJI_STORY_LENGTH` and `extractErrorMessage`;
  do not duplicate the breakdown editor's logic beyond what is needed.
- Guard async loads with `createLatestRequest` like `loadStory` does, so a fast
  Missed/Got it cannot paint the previous kanji's default.
- Do not touch the background clip code from 113b.
- No em dashes in generated text; keep comments to the why.
