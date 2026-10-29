# Feature: Play a kanji's source song (113b)

**From build-plan:** feature 113b (sub-feature of 113, "Kanji plays its source song")
**Status:** verified (tests and build; browser check not run)

## Goal

On `/kanji`, the background clip for the current kanji is the card it was added
from (`kanji_card.sourceCardId`, stored by 113a), so the song on screen when the
kanji was added helps it stick. A kanji with no source, or whose source cannot
play, keeps feature 111c's random library clips.

## In scope

- `GET /api/kanji/cards/next` also returns the current kanji's source card as a
  `CardWithDetails` (or `null`), and the kanji item carries `sourceCardId`.
- `/kanji` plays that source clip in the existing `StudyMediaPlayer` slot while
  that kanji is current, honouring Clip source (`isPlayableCard`) and Playback
  mode exactly as the random clips do.
- Fallback to random clips when: no source, source card deleted (column is
  null), source not playable under the Clip source setting, or the player errors.
- Moving to the next kanji swaps the player to that kanji's source (fresh
  mount); kanjis sharing a source card still remount, so the clip restarts.

## Out of scope

- Backfilling kanji added before 113a (they have no source and stay on random).
- Changing a kanji's source after it is added (first source wins, per 113a).
- Any schema, migration, or `/api/listen/queue` change.
- Showing which song the clip is (the info panel is not shown on `/kanji`).

## Decisions made in this spec

- **Source clip loops.** When it ends it replays, instead of advancing to a
  random clip; the song staying with the kanji is the point.
- **Skip clip / Next clip leaves the source** for this kanji and plays random
  clips until the next kanji is shown (the error action does the same, so a
  broken source never traps the page).
- **Offline:** the source goes through the same `isPlayableCard` check as random
  clips. With Offline mode on and the clip not downloaded, the player's existing
  error state appears, and Next clip moves to a random (offline-playable) one.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Server returns the source card** - add `sourceCardId: number | null`
  to `KanjiStudyItem` (`withEntry`), and have `getNextKanji` look up the source
  with `getCardWithDetails` when set, returning `{ kanji, dueCount, sourceCard }`.
  Test in `kanjiCards.test.ts`: source present, source null, source card deleted
  (null after `set null`). *Done when:* `bun run test` passes and
  `GET /api/kanji/cards/next` shows `sourceCard` for a kanji added with a source
  and `null` for one without.
- [x] **Step 2 - Pure clip choice** - in `app/utils/kanjiStudy.ts` add
  `pickSourceClip(sourceCard, clipSource)` (returns the card only if
  `isPlayableCard`, else null) with unit tests (playable, null, blocked by Clip
  source). Mirror the new fields in `useKanjiStudy.ts` (`sourceCardId`, a
  `sourceCard` ref), same field order as the server. *Done when:* tests pass and
  the build typechecks.
- [x] **Step 3 - Wire the page** - `/kanji` shows the source clip while the
  current kanji has a playable one: a `useSourceClip`-style local state in the
  page (or `useBackgroundClips` gaining an optional override) keyed so each
  kanji remounts the player; `@playback-ended` replays the source (remount via
  the presentation key), Skip clip / Next clip drops the override until the
  kanji changes. Random clips still load as the fallback. *Done when:* in the
  browser, a kanji added from a known card plays that card's clip and loops it,
  Skip clip switches to random clips, a kanji with no source plays random clips,
  and the console shows no errors.

## Files / areas

- `nuxt-app/server/utils/kanjiCards.ts` (+ `.test.ts`), `server/api/kanji/cards/next.get.ts`
- `nuxt-app/app/utils/kanjiStudy.ts` (+ test), `app/composables/useKanjiStudy.ts`
- `nuxt-app/app/composables/useBackgroundClips.ts`, `app/pages/kanji/index.vue`

## Data / contracts

- No schema change. Load-bearing: `KanjiStudyItem` gains `sourceCardId` on both
  the server and client copies (F-09 hand-mirrored, same field order); the
  `next` reply shape becomes `{ kanji, dueCount, sourceCard: CardWithDetails | null }`.
- `kanji_card.sourceCardId` is read-only here; nothing writes it.

## Testing

- Vitest: server lookup of the source card (3 cases), `pickSourceClip` (3 cases).
- Page wiring is UI: verified in the browser plus `bun run build`. Add two
  kanji from cards (one with a clip blocked by Clip source if easy), open
  `/kanji`, check source clip, loop on end, Skip clip, and fallback.

## Notes for the AI

- Reuse `StudyMediaPlayer`'s existing props and error slot; do not touch player
  internals. Keep hotkeys fixed (not in the registry).
- Avoid overlapping audio (the failure class behind features 18/32): there must
  never be two players mounted, so swap by `:key`, not by adding a second one.
- No em dashes in generated text; keep comments to the why.
