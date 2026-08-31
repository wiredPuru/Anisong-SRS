# Current Feature

## Title: Migaku-style learning steps for box 1 (no more one-pass graduation)

**Type:** Fix

**Status:** verified

## The problem

`recordReview` (`nuxt-app/server/utils/study.ts`) advances a card from box 1
to box 2 after a single correct answer:

```ts
const box = result === "pass" ? Math.min(currentBox + 1, MAX_BOX) : 1;
```

Because box 1's interval is `0` days, a failed card resurfaces immediately in
the same session, but a card only has to be answered correctly **once** to
leave box 1 for good (box 2's interval is 1 day). That's not how Migaku (or
Anki-style learning steps) works: a new or just-failed card should have to be
answered correctly several times in a row in the same pass before it's
considered "learned" and graduates out of the near-term queue.

## The fix

Add a per-card streak counter that only matters while a card is in box 1.

- New `card.streak` column (integer, not null, default `0`) via a Drizzle
  migration. Tracks consecutive correct answers while `box === 1`.
- **Box 1 only.** Boxes 2-5 keep today's exact behavior unchanged: one pass
  advances one box (existing day intervals), one fail drops straight to box 1
  and resets `streak` to `0`.
- **Box 1 pass:** `streak += 1`. If `streak < 3`, the card stays in box 1
  (`nextReviewAt` = now, same 0-day resurface behavior as today). On the 3rd
  consecutive correct answer (`streak >= 3`), the card graduates: `box = 2`,
  `streak` resets to `0`, `nextReviewAt` uses box 2's existing 1-day interval.
- **Box 1 fail (or any-box fail):** `box = 1`, `streak = 0`, `nextReviewAt` =
  now - identical to today's fail behavior, just explicit about resetting the
  streak.
- `computeNextBoxState(currentBox, result)` in `server/utils/study.ts` becomes
  `computeNextBoxState(currentBox, currentStreak, result)` returning
  `{ box, nextReviewAt, streak }`. `recordReview` reads/writes the new column
  alongside `box`/`nextReviewAt`; the `reviewLog` insert (`boxBefore`/
  `boxAfter`) is unchanged.
- Thread `streak` through the one shared `cardSelection` object in
  `server/utils/cards.ts` so it flows through `CardWithDetails` everywhere
  `box` already does (`/api/study/next`, `/api/study/review`, `/api/cards`,
  deck listings) with no per-endpoint changes. Add `streak: number` to both
  hand-maintained `CardWithDetails` interfaces (server: `server/utils/cards.ts`;
  client: `app/composables/useStudySession.ts`).
- Surface progress on `/study` only (not `CardPreviewModal` - out of scope).
  `StudyInfoPanel.vue`'s existing `.meta-row` already uses
  `justify-content: space-between` with a single `.artist` child - add a
  second chip there, shown only when `box === 1`, reading something like
  "Learning 2/3". No new UI chrome, reuses existing tokens/layout. Pass
  `box`/`streak` as two new props from `study/index.vue` into
  `StudyInfoPanel` (covers both the normal side panel and the immersive
  overlay, since both render the same component).

Must not break: boxes 2-5 scheduling, `reviewLog` history, or the existing
0-day box-1 resurface behavior that lets a failed card come back later in the
same session.

## Build steps

1. [x] **Schema + migration** - add `streak` to the `card` table in `schema.ts`,
   run `bun run db:generate` then `bun run db:migrate` inside `nuxt-app/`.
   Done when: migration file + snapshot exist under
   `server/db/migrations/`, and the dev DB has the new column.

2. [x] **Scheduling logic** - update `computeNextBoxState`/`recordReview` in
   `server/utils/study.ts` per the rules above. Done when: hitting
   `POST /api/study/review` for a box-1 card requires 3 passes in a row to
   reach box 2; a fail at streak 1 or 2 resets to box 1 with `streak: 0`;
   boxes 2-5 behave exactly as before.

3. [x] **Thread `streak` through `CardWithDetails`** - add the field to
   `cardSelection` (server), both `CardWithDetails` interfaces, and confirm
   it reaches the client via `/api/study/next` and `/api/study/review`
   responses. Done when: `currentCard.streak` is populated in the browser for
   a box-1 card.

4. [x] **Study UI progress chip** - add `box`/`streak` props to
   `StudyInfoPanel.vue`, render a "Learning N/3" chip in `.meta-row` only
   when `box === 1`, wire `study/index.vue` to pass the two new props. Done
   when: the chip is visible and counts up on `/study` for a box-1 card,
   disappears once the card graduates to box 2, and resets to hidden/`0`
   after a fail.

## Verify

- On `/study`, find or create a box-1 card. Pass it once: it should
  resurface later in the same session (not graduate), chip reads "Learning
  1/3".
- Pass it two more times: on the 3rd consecutive pass it should graduate to
  box 2 (1-day interval) and the chip should disappear.
- Repeat, but fail on the 2nd attempt: streak should reset to 0 and the card
  stays in box 1.
- Spot-check a box 2+ card: single pass/fail behaves exactly as before
  (advances/drops one box, no chip shown).
- No test runner is configured in this project yet; this scheduling logic is
  a strong candidate for `/tests` if the user wants to add automated
  coverage afterward (`coding-standards.md` already names Leitner interval
  logic as a good first candidate), but it's optional here.
