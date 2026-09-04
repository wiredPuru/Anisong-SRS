# Fix: Reveal-and-confirm step for Hide Info on Study

**Type:** Fix
**Status:** verified

## The problem

On `/study`, the Hide Info toggle (feature 10) already blurs the info panel and
already starts each new card hidden again when the toggle is on - that part is
existing, correct behavior. What's missing: pressing Fail/Pass while Info is
still hidden grades the card and immediately jumps to the next one, so the
answer never actually gets shown to compare against your guess. There's also no
disabled state on Fail/Pass once a grade can no longer be changed for the
current card.

## The fix

When Hide Info is on and the info panel is still hidden at the moment Fail/Pass
is pressed:

1. Record the grade immediately, exactly as today (`POST /api/study/review`
   fires right away - the box/streak update and `ReviewLog` write are not
   delayed by anything below).
2. Reveal the info panel for the graded card (same mechanism the `i` hotkey /
   Auto Reveal already use to un-blur early - `autoRevealedThisCard = true`,
   stopping any pending Auto Reveal timer).
3. Do **not** fetch the next card yet. Disable both Fail and Pass (they can't
   affect this already-graded card anymore) and show a "Continue" control that
   advances to the next card when clicked (or Enter is pressed).

When Hide Info is off, or the info panel is already visible for this card
(revealed early via the `i` hotkey, or already surfaced by Auto Reveal), this
stays exactly like today: pressing Fail/Pass grades and immediately advances,
no staged confirm.

Only touches `/study` (`StudyAnswerControls.vue`, `pages/study/index.vue`) -
`CardPreviewModal` has no Pass/Fail controls (feature 36) so nothing there
changed.

## Build steps

- [x] **1. Decouple grading from advancing in `useStudySession`.** `submit()`
  in `app/composables/useStudySession.ts` no longer calls `fetchNext()` itself
  after posting the review - the exported `refresh` (`fetchNext`) is now what
  the page calls explicitly to advance. `study/index.vue`'s `submitReview()`
  was given a matching `await refreshStudySession()` so the app kept advancing
  immediately at this point, unchanged - the conditional branch landed in step
  3. *Done when:* `bun run test` green, `/study` still advances after every
  Fail/Pass with Hide Info off.

- [x] **2. Add the disabled Fail/Pass + Continue control to
  `StudyAnswerControls.vue`.** New `pendingAdvance` prop and `continue` emit.
  Fail/Pass render `:disabled="disabled || pendingAdvance"`; a new
  `.continue-btn` (styled with `--accent-secondary`, the same arcade-lip
  shadow convention as `.answer-btn`) renders only while `pendingAdvance` is
  true. Keyboard: while pending, ArrowLeft/ArrowRight no-op and Enter emits
  `continue`. *Done when:* component compiles and renders correctly with
  `pendingAdvance` true/false; not yet wired to real state (step 3).

- [x] **3. Wire the staged reveal into `study/index.vue`.** New `pendingAdvance`
  ref (resets on scope change alongside `sessionHistory`). `submitReview()`
  captures `needsReveal = hideInfo.value && !autoRevealedThisCard.value`
  *before* calling `submit()`. After a successful grade: if `needsReveal`,
  stops any running Auto Reveal timer, sets `autoRevealedThisCard = true` and
  `pendingAdvance = true` instead of fetching the next card; otherwise
  advances immediately as before. `confirmAdvance()` clears `pendingAdvance`
  and fetches the next card. *Done when:* driven end-to-end in a real browser
  (see Verify).

## Verify

This is UI/interaction behavior, not pure logic, so it rode on browser
evidence rather than a new unit test (per `coding-standards.md`'s testing
scope rule) - `bun run test` (35/35, no regressions) and `bun run build` both
passed clean throughout.

Drove the actual flow end-to-end against the running dev server with a
one-off Chrome DevTools Protocol script (Playwright isn't installed; this
project's own `bun run measure` reloads the page per action and can't hold
state across a multi-click sequence, so a small throwaway script reused its
same CDP connection pattern for one continuous session):

- Hide Info on -> Fail: info panel un-blurs, Fail/Pass both report
  `disabled === true`, `.continue-btn` appears.
- Continue (click) -> next card loads, info panel re-blurs (Hide Info still
  on), Fail/Pass re-enabled, `.continue-btn` gone.
- Hide Info off -> Pass: no staged step at all - advances in one press,
  identical before/after snapshot for the disabled/Continue fields.
- Info already revealed early (manual toggle, same code path Auto Reveal's
  early-reveal uses) before grading -> also advances in one press, confirming
  the "nothing left to reveal" branch.

Also confirmed, while investigating an unrelated console warning that showed
up during this check: a Vue hydration-mismatch warning on `/study` navigation
reproduces identically on unmodified `master`, so it predates this fix and was
left out of scope.

## Findings

### study-hide-info-reveal-confirm/F-09 [P3] accepted - API response shapes are hand-duplicated between server and client

**File:** nuxt-app/app/composables/useUpdateCheck.ts:1-8 and nuxt-app/server/utils/version.ts:17-24; same pattern at nuxt-app/app/composables/useStudySession.ts:8-27 and nuxt-app/server/utils/cards.ts:15-34
**Found:** 2026-09-04 by /audit (scope: full; lens: quality)
**Why it matters:** Every API response shape is declared twice, once server-side and once by hand on the client, with nothing tying the copies together. `UpdateStatus` is currently byte-identical in both places, so a server-side field rename would leave the client compiling against a shape the route no longer returns. `CardWithDetails` is the load-bearing case - `project-overview.md` names it as returned by five routes - and its copies already differ, though deliberately: `nextReviewAt`/`createdAt` are `Date` on the server and `string` on the client because JSON serializes them. That deliberate difference is why the naive fix does not work, and is worth recording before someone attempts it. Separately, `coding-standards.md` documents a `nuxt-app/app/types/[feature].ts` location for shared types, and that directory does not exist, so the convention is currently fiction.
**Suggested fix:** Smallest useful step is to stop the duplication growing rather than to refactor the existing shapes: introduce `app/types/` as the standards file already promises, and derive client shapes from the server declaration through a serialized-type helper (a mapped type turning `Date` into `string`) rather than retyping them. Applying it to `UpdateStatus` first is low risk since its copies are identical today. `CardWithDetails` is the valuable target but touches many call sites, so it deserves its own reviewed change, not a drive-by. Alternatively record the duplication as accepted and delete the unused `app/types/` line from `coding-standards.md`, so the documented convention matches reality either way.
**Resolution:** Accepted 2026-09-04 by explicit user decision: the duplication stays, on the reasoning that the app's size does not justify a generic serialized-type derivation mechanism for the marginal benefit it would buy at P3 severity. `coding-standards.md`'s `Types:` line rewritten to describe this as the actual, deliberate convention (naming `CardWithDetails`/`UpdateStatus`, the `Date`-vs-`string` reason a client copy differs, and a field-order convention to keep a diff between the two easy to eyeball) rather than the fictional `app/types/[feature].ts` path it previously promised.
