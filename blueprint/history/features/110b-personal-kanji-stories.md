# Feature: Personal kanji stories (110b)

**From build-plan:** feature 110, sub-feature 110b
**Status:** verified

## Goal

Let the user write a personal Heisig-style story for any kanji or part in the
Japanese breakdown (features 109/110a), saved locally in SQLite. The story is
edited in the detail view `StudyKanjiDetail.vue`, and tiles and part chips that
have a story carry a small marker so the user can see which characters they have
already built a mnemonic for.

## In scope

- `kanji_story` table (migration `0041`): `char` (PK), `text`, `updatedAt`.
  Matches the KanjiStory shape in `project-overview.md`.
- `server/utils/kanjiStories.ts`: body parsing and get/put/delete/list-chars
  helpers. A story is trimmed; empty text on PUT is a 400 (use DELETE to clear);
  max 2000 characters; `char` must be a single character (any single non-space
  code point, so a bare stroke shape like `ノ` can have a story too).
- Routes under `server/api/kanji/story/`:
  - `GET /api/kanji/story?char=` - `{ char, text: string | null }`.
  - `GET /api/kanji/story/chars` - `{ chars: string[] }`, every character with a
    story (drives the markers; one request per panel).
  - `PUT /api/kanji/story` - `{ char, text }` upserts, returns `{ char, text }`.
  - `DELETE /api/kanji/story` - `{ char }` removes; idempotent.
- `StudyKanjiDetail.vue`: a Story section with a textarea, Save and Remove
  actions, saving and error states, and a "Saved" confirmation. Loads the story
  on `char` change. Works for no-entry stroke shapes too.
- `StudyJapaneseBreakdown.vue`: fetches the story chars once on mount and after
  a save/remove (via an event from the detail view), and marks tiles and part
  chips whose character has a story.

## Out of scope

- Showing stories on the study page or card reveal (111c may reuse the GET).
- Export/import or sync of stories, rich text, or story search.
- Any change to cards, scheduling, review log, or stats.

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Table, helpers, routes + tests** - schema, migration `0041`,
  `kanjiStories.ts` with its parsers and operations, the four routes, and
  `kanjiStories.test.ts` (parse rejects bad char, empty text, over-length; trims;
  upsert replaces and bumps `updatedAt`; delete idempotent; list chars). *Done
  when:* `bun run test` passes with the new cases and the app builds.
- [x] **Step 2 - Story editor in the detail view** - textarea, Save, Remove,
  states, emits `story-changed` with `{ char, hasStory }`. Pure helper
  `storyDraftState(saved, draft)` (dirty/empty/too long) in
  `app/utils/japaneseBreakdown.ts` with tests. *Done when:* in the browser,
  writing a story on 魔, saving, closing the panel and reopening shows it;
  Remove clears it; an over-long draft disables Save.
- [x] **Step 3 - Markers on tiles and chips** - the panel loads
  `/api/kanji/story/chars`, keeps a set, updates it on `story-changed`, and marks
  tiles and chips with a story (small dot with an accessible label, in the
  detail view's part chips too). *Done when:* after saving a story for 鬼 its
  tile/chip shows the marker on Study and Listen, and Remove drops it; no console
  errors.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `server/db/migrations/0041_*` (+ meta)
- `nuxt-app/server/utils/kanjiStories.ts` (+ `.test.ts`)
- `nuxt-app/server/api/kanji/story/*` (new)
- `nuxt-app/app/utils/japaneseBreakdown.ts` (+ test)
- `nuxt-app/app/components/study/StudyKanjiDetail.vue`
- `nuxt-app/app/components/study/StudyJapaneseBreakdown.vue`

## Data / contracts

- `kanji_story(char text pk, text text not null, updated_at integer timestamp
  default now)`. Migration via `bun run db:generate`, never hand-edited.
- Client and server shape `{ char: string; text: string | null }`.
- Kanji Study (111b/111c) is independent of this table.

## Testing

- Logic ships tests: parsers, upsert/delete/list (in-memory SQLite as in
  `kanjiCards.test.ts`), and the draft-state helper.
- UI steps: dev server in a browser on `/study` or `/listen`, console clean, plus
  `bun run build`.

## Notes for the AI

- Scoped styles with `var(--token)`, no inline styles, no hard-coded colors.
- Hotkeys must not fire while typing in the textarea (check the existing
  typing-target guard in `app/utils/hotkeyTarget.ts`); Space and letters belong
  to the textarea.
- No em dashes in comments or copy.

**Built as:** `kanji_story` (migration `0041`), `server/utils/kanjiStories.ts` with `GET`/`PUT`/`DELETE /api/kanji/story` and `GET /api/kanji/story/chars`, a Your story editor in `StudyKanjiDetail.vue` (`storyDraftState` in `app/utils/japaneseBreakdown.ts`), and a dot marker on tiles and part chips in `StudyJapaneseBreakdown.vue`. Verified: `bun run test` (2549 passed), `bun run build`, API round trip, and browser screenshots on `/listen` against a scratch database (marker on 鬼, story loaded, Remove shown).
