# Current Feature

## Title
"Study new cards" option once the day's cards are done

## Type
Fix

## Status
verified

## The problem
On `/study`, once nothing is due the screen shows a dead end: "All caught up!
Nothing due right now." But that state has two very different causes, and the
screen can't tell them apart:

1. **Genuinely nothing left** - no due cards and no unseen cards.
2. **The daily new-card limit is spent** - `baseDueCondition()`
   (`server/utils/cards.ts:213`) drops every never-reviewed card from the due
   query once `introduced >= limit`, so cards you have never seen are sitting
   there, withheld only by your own daily cap.

In case 2 there is no way to keep going without leaving Study, opening
`/settings`, and raising the daily limit - which then permanently changes the
setting rather than just extending today's session.

## The fix
Offer a **Study new cards** button on the session-complete screen that releases
the daily new-card limit for the rest of the current session only.

- The override is **session-only**, never persisted, matching every other
  study-session toggle (Hide Video/Hide Info/Random start/Ambient mode). A
  reload or a scope change puts the daily limit back in force. The
  `dailyNewCardLimit` setting itself is never written to.
- The button appears **only when it would actually do something** - the server
  reports how many never-reviewed cards are currently being withheld, and the
  button renders only when that count is above zero. In case 1 above the
  screen stays exactly as it is today.

Must not break:

- `baseDueCondition()` is shared. `server/utils/decks.ts:85,98` (deck-tile due
  counts) and `getDueCardBreakdown()` via `server/api/home.get.ts:8` (the Home
  dashboard) must keep respecting the daily limit. The override therefore has
  to be an **optional parameter defaulting to today's behavior**, not a change
  to the shared default.
- Once the override is on, `dueCount` and the `upcoming` prefetch must use it
  too - otherwise the "N left" counter would read 0 while cards are still
  being served.
- The header's `new {introduced}/{limit}` chip will read over-limit (e.g.
  `new 21/20`) after the override is used. That is correct and expected, not a
  bug to suppress; the existing `new-card-chip-reached` styling already covers
  it.

## Build steps

- [x] **1. Server: opt-in override plus a withheld-new count.**
  In `server/utils/cards.ts`, add an `includeNewBeyondLimit = false` parameter
  to `baseDueCondition()`, `dueCardCondition()`, `getNextDueCard()`,
  `getDueCardCount()`, and `getUpcomingDueCards()`, threading it through; when
  true, `baseDueCondition()` returns the plain due condition without the
  `inArray(card.id, reviewedCardIds)` restriction. Add
  `getWithheldNewCount(scope)`, returning `0` when no daily limit is set or the
  limit is not yet reached, and otherwise the number of in-scope cards that are
  due and never reviewed. In `server/api/study/next.get.ts`, accept an
  `includeNew` query param and pass it to the three call sites, and add
  `withheldNewCount` to the response.
  *Done when:* with the daily limit spent,
  `curl "localhost:3000/api/study/next?type=all"` returns `card: null` and a
  non-zero `withheldNewCount`, while
  `curl "localhost:3000/api/study/next?type=all&includeNew=true"` returns a real
  never-reviewed card and a non-zero `dueCount`. `/api/home` and `/api/decks`
  due counts are byte-identical before and after the diff.

- [x] **2. Client: the button and its session-only state.**
  In `app/composables/useStudySession.ts`, add a session-only
  `includeNewBeyondLimit` ref (default `false`) that is sent as `includeNew`
  on every `/api/study/next` call once set, expose `withheldNewCount` and a
  `studyNewCards()` action that sets the flag and refetches, and reset the flag
  wherever the session already resets on scope change. Keep the hand-declared
  response shape's field order matching the server's, per the Types convention
  in `coding-standards.md`. In `app/pages/study/index.vue`, render a "Study new
  cards" button (with the count, e.g. `Study new cards (12)`) inside the
  existing `v-else-if="sessionComplete"` block, shown only when
  `withheldNewCount > 0`, calling `studyNewCards()`.
  *Done when:* with the daily limit spent, finishing the queue shows the
  session-complete screen with a "Study new cards (N)" button; clicking it
  loads a never-reviewed card and the "N left" counter becomes non-zero;
  finishing those shows the plain "All caught up!" screen with no button. With
  no daily limit set, or with the limit not yet reached, the completion screen
  is unchanged from today.

## Verify
Set a low daily new-card limit on `/settings` (e.g. 1), study on `/study` until
the queue empties, and confirm the completion screen offers "Study new cards"
with a count. Click it and confirm a never-reviewed card loads and the counter
updates. Reload `/study` and confirm the limit is back in force (the override
did not persist and `/settings` still shows the original limit). Separately,
confirm `/` (Home) and `/decks` still show limit-respecting due counts. Finally,
with the limit not yet reached, confirm the completion screen shows no button.
`bun run test` should stay green (35/35); the new `getWithheldNewCount` is
DB-backed rather than pure logic, so it rides on the API and browser evidence
above per `coding-standards.md`'s testing scope rule.

## Evidence

Verified against the running dev server. The daily limit was temporarily set to
`1` (68 new cards had already been introduced today, so the cap read as spent)
and **restored to its original `null`** afterwards, confirmed via the API.

Server, `type=all`:

| Call | card served | dueCount | withheldNewCount |
|---|---|---|---|
| `?type=all` (cap in force) | `twilight little star` (reviewed) | 55 | 91 |
| `?type=all&includeNew=true` | `Seize The Day` (box 1, never reviewed) | 146 | 91 |

`55 + 91 = 146`, and 146 matches the uncapped count measured before the limit
was set - so the override releases exactly the withheld set and nothing more.
`upcoming` returned 2 entries under the override, confirming the prefetch path
uses it too.

Shared-condition regression check, taken while the cap was still spent:

- `/api/home` returned `{due: 55, new: 0}` - the capped count, unchanged.
- `/api/decks?type=artist` summed 44 across its first page of tiles - capped,
  not the uncapped 146.

Both confirm the defaulted parameter left every other caller alone.

Browser, on anime scope 232 (a deck whose cards were all never reviewed, which
produces the real `card: null` completion state while the cap is spent):

- Completion screen rendered "All caught up! Nothing due right now." with a
  **"Study new cards (1)"** button (screenshot).
- Clicking it loaded a previously withheld card ("A Sister's All You Need.",
  `1 left`), with the header chip reading `new 71/1` - over-limit exactly as
  this spec predicted, and `.study-new-btn` gone from the DOM (screenshot).

The "no button when nothing is withheld" case is guaranteed by construction
rather than screenshotted: `getWithheldNewCount()` returns `0` early when no
limit is set or the limit is not yet spent, and the button binds to
`withheldNewCount > 0`. Confirmed at the API level (`withheldNewCount: 0` with
`limit: null`).

Step 1's done-when predicted `card: null` on `type=all`; this database still had
55 reviewed cards due at that moment, so a reviewed card was served instead and
the `card: null` completion state was proven on a scope with no reviewed
backlog. Same code path, same condition.

`bun run test` (35/35) and `bun run build` both passed clean, and were re-run as
the final gate before this archive.
