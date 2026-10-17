# Feature: Kanji deck + scheduling

**From build-plan:** feature 111a (of 111, Kanji Study)
**Status:** verified

## Goal

The data and server half of Kanji Study: a personal kanji deck with its own
Leitner schedule, reusing the card algorithm, with no UI yet. 111b adds the
buttons that call it and 111c the study page, so this step must leave the app
behaving exactly as today.

## In scope

- A `kanji_card` table (migration `0040`): one row per added character, with
  box, streak and due date.
- Pure helpers in `server/utils/kanjiCards.ts`: parse and validate request
  bodies, and the add/remove/list/next/review operations.
- Routes under `server/api/kanji/cards/`:
  - `GET /api/kanji/cards` - every added kanji with its dictionary entry, box
    and due date, plus `dueCount` and `total`.
  - `POST /api/kanji/cards` - `{ chars: string[] }` adds (1-100); idempotent.
  - `DELETE /api/kanji/cards` - `{ chars: string[] }` removes.
  - `GET /api/kanji/cards/next` - the most overdue due kanji with its entry,
    plus `dueCount`; `204`-style `{ kanji: null }` when nothing is due.
  - `POST /api/kanji/cards/review` - `{ char, result: "pass" | "fail" }`
    advances the box via `computeNextBoxState` and the box-1 streak setting.
- Vitest tests for the pure logic.

## Out of scope

- Any UI, rail entry or Settings gate (111b, 111c).
- Review history or stats for kanji, undo, suspend, daily new limit.
- Stories (110b); the next route returns only the dictionary entry.
- Any change to `Card`, `CardTrack`, `ReviewLog`, `/api/study/*` or `/api/kanji`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Table + migration** - add `kanjiCard` to `server/db/schema.ts`
  and generate migration `0040` with `bun run db:generate`. *Done when:* the
  migration SQL creates `kanji_card` with `char` PK, `box` default 1, `streak`
  default 0, `next_review_at` and `created_at` defaults, nothing else changes,
  and the dev server boots and applies it.
- [x] **Step 2 - Pure body parsing + tests** - `parseKanjiCharsBody` (array of
  1-100 strings, each exactly one ideograph per `extractKanji`, deduped, must
  exist in the dictionary else a clear error naming the character) and
  `parseKanjiReviewBody`. *Done when:* `kanjiCards.test.ts` covers empty, too
  many, multi-character strings, kana, bare stroke shapes (no entry), and
  duplicates, and passes.
- [x] **Step 3 - Operations + tests** - `addKanjiCards`, `removeKanjiCards`,
  `listKanjiCards`, `getNextKanji`, `reviewKanji` over the table. Review reuses
  `computeNextBoxState` and `getBoxOneStreakRequired`. *Done when:* tests
  (in-memory or mocked db, following the existing util tests) prove: add is
  idempotent and starts at box 1 due now; a pass at box 1 only graduates after
  the required streak; a fail returns to box 1; next picks the oldest due and
  skips future ones; reviewing an unknown char reports not found.
- [x] **Step 4 - Routes** - the four route files above wired to the helpers,
  with `400` on bad bodies and `404` on an unknown char. *Done when:* curl
  against the dev server adds 魔 and 鬼, lists both with entries, `next`
  returns one, a pass moves it to box 2 with a later due date, a fail resets it,
  delete removes it, and `bun run test` and `bun run build` pass.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `server/db/migrations/0040_*.sql` (+ meta)
- `nuxt-app/server/utils/kanjiCards.ts`, `kanjiCards.test.ts`
- `nuxt-app/server/api/kanji/cards/{index.get,index.post,index.delete,next.get,review.post}.ts`

## Data / contracts

Load-bearing for 111b and 111c:

```ts
interface KanjiCardRow {
  char: string;
  box: number;
  streak: number;
  nextReviewAt: string; // ISO on the wire
  createdAt: string;
}
interface KanjiStudyItem extends KanjiCardRow { entry: KanjiEntry } // from kanjiData.ts
// GET /api/kanji/cards      -> { cards: KanjiStudyItem[]; dueCount: number; total: number }
// GET /api/kanji/cards/next -> { kanji: KanjiStudyItem | null; dueCount: number }
// POST /api/kanji/cards/review -> { kanji: KanjiStudyItem; dueCount: number }
```

Hand-duplicate the client copy later per `coding-standards.md` (F-09), keeping
field order. Intervals stay 0/1/3/7/14 days, shared with cards through
`computeNextBoxState`.

## Testing

Vitest is configured, so the logic-test gate is on. Tests cover the body
parsers and the operations (Steps 2 and 3). Routes are verified with curl and
the build. Run `bun run test` and `bun run build` from `nuxt-app/`.

## Notes for the AI

- Match `cardTrack.ts`/`study.ts` style; comments only for the why.
- Do not gate routes on the `japaneseBreakdown` setting: hiding is a UI
  concern (111b/111c), and the data should survive the setting being toggled.
- Drizzle migrations only, never manual `ALTER TABLE`. No em dashes.
- Branch: `feature/kanji-study-deck` off the current state (the 110a branch
  `feature/kanji-parts-viewer` is unmerged; ask whether to branch from it or
  from master before creating the branch in `/implement`).
