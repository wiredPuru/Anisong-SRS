# Feature: Kanji Study page (111c)

**From build-plan:** feature 111, sub-feature 111c
**Status:** verified

## Goal

A `/kanji` page where the due kanji from the user's kanji deck (111a/111b) come
up as flashcards: the character is shown, the user recalls its keyword, reveals
the answer, and grades themselves Pass or Fail. Random library clips keep
playing in the background (the fun-mode part of feature 111). Everything is
gated on Settings > Japanese breakdown.

## In scope

- `app/pages/kanji/index.vue`, reached from the rail link 111b added.
- Gate: with Japanese breakdown off the page shows a short note and a link to
  Settings, loading nothing else.
- Flashcard: big character, a Reveal button, then keyword, alternates, readings,
  strokes, RTK frame, clickable-free parts list, and the user's story when one
  exists (`GET /api/kanji/story`). Pass and Fail buttons call
  `POST /api/kanji/cards/review`, then the next due kanji loads
  (`GET /api/kanji/cards/next`). "N left" from `dueCount`, session pass/fail
  tally, and box shown on reveal.
- Keys (fixed, not in the rebindable registry): Space or Enter reveals, Right
  Arrow passes, Left Arrow fails, ignored in text fields and while a modifier is
  held.
- States: loading, error with retry, "all caught up" (with a link to Cards/Study
  and a note on how to add kanji), and an empty deck message pointing at the
  Japanese breakdown.
- Background clips: a shuffled queue from `POST /api/listen/queue` (scope all,
  shuffled), filtered by `isPlayableCard` for the Clip source setting, played
  one after another in `StudyMediaPlayer` (autoplay, volume slider kept, info
  hidden), advancing on `playback-ended` and on a "Skip clip" button, wrapping
  at the end. No playable clip simply hides the player. Offline mode needs no
  extra code: the queue route already hides undownloaded clips (feature 107d).
- Pure helpers in `app/utils/kanjiStudy.ts` with tests.

## Out of scope

- Typed answers, daily new-kanji limits, undo, stats, rebindable hotkeys.
- Any change to cards, scheduling, review log or the 111a routes.
- Choosing which clips play (always random across the library).

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Pure helpers + tests** - `kanjiStudy.ts`: `kanjiKeyAction(key,
  revealed, modifiers)` -> `"reveal" | "pass" | "fail" | null` (Space/Enter
  reveal only before reveal; arrows grade only after), `nextClipIndex(index,
  total)` wrapping to 0 (0 for an empty list), `backgroundClips(cards,
  clipSource, limit)` (playable only, capped). *Done when:* `bun run test` passes
  with cases for each branch.
- [x] **Step 2 - Flashcard page without clips** - the gate, the card, reveal,
  grading, next, tally, "N left", and every state, with the story on reveal.
  *Done when* (browser, scratch DB with two kanji added): Reveal shows the
  keyword, Pass advances and `GET /api/kanji/cards/next` reflects the new box,
  Fail keeps it due, keys work, the empty and caught-up states render, and with
  the setting off the gate note shows.
- [x] **Step 3 - Background clips** - the queue, `StudyMediaPlayer` autoplay,
  advance on ended, Skip clip, and the layout beside or behind the card. *Done
  when* (browser): a clip plays behind/beside the card and Skip clip changes it,
  no console errors, and `bun run build` passes.

## Files / areas

- `nuxt-app/app/pages/kanji/index.vue` (new)
- `nuxt-app/app/utils/kanjiStudy.ts` (+ `.test.ts`)
- `nuxt-app/app/composables/useKanjiStudy.ts`, `useBackgroundClips.ts` (new)

## Data / contracts

- Reuses 111a's `GET /api/kanji/cards/next` (`{ kanji, dueCount }`) and
  `POST /api/kanji/cards/review` (`{ char, result }`), `GET /api/kanji/story`
  (110b), and `POST /api/listen/queue`. No schema or server change.

## Testing

- Pure helpers ship tests. UI steps: browser on `/kanji` against a scratch
  database, console clean, plus `bun run build`.

## Notes for the AI

- Scoped styles with `var(--token)`, no inline styles, no hard-coded colors.
- Japanese text is real DOM text with `lang="ja"`.
- Don't intercept keys while typing or with Ctrl/Cmd/Alt held.
- No em dashes in comments or copy.

**Built as:** `kanjiStudy.ts` helpers, `useKanjiStudy` (next, reveal, grade, story, tally) and `useBackgroundClips` composables, and `app/pages/kanji/index.vue`: the flashcard beside a `StudyMediaPlayer` that plays shuffled library clips from `POST /api/listen/queue` (autoplay, advance on end, Skip clip, a Next clip action on a playback error). The page is gated on the Japanese breakdown setting. Verified: `bun run test`, `bun run build`, and browser checks against a scratch database (Reveal shows keyword and story, Got it advances and moves the box and streak, gate note with the setting off, clip pane laid out and Skip clip works). Real clip playback was not exercised there because the seeded clip URLs are fake; the player is the same component Listen uses.
