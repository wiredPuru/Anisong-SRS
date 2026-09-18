# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
> Build one thing at a time; `/complete` archives it under
> `blueprint/history/` and resets this file.

## Title

Hide Video doesn't unhide after a typed answer is submitted

## Type

Fix

## Status

verified

## The problem

On `/study`, with Typed Answers mode (feature 65) on and the Hide Video toggle
active, submitting an answer (right or wrong) does not unhide the video - it
stays hidden through the whole result/continue phase, even though the
guessing period is over.

This is inconsistent with how the rest of the answer-result phase already
behaves in `nuxt-app/app/pages/study/index.vue`: once `quizResult` is set,
`hideThemeBadge` (line 874), `hideCover` (line 879), and `StudyInfoPanel`'s
`blurred`/`inert` (lines 924-925) all already gate on `!quizResult` so they
reveal automatically. The `hide-video` binding on `<StudyMediaPlayer>` (line
871) is the one exception:

```
:hide-video="typedAnswers ? hideVideo : (hideVideo || autoRevealTargetsVisual) && !autoRevealedThisCard"
```

In the `typedAnswers` branch, this is just `hideVideo` (the session toggle),
with no `!quizResult` term - so a hidden video stays hidden straight through
the reveal that every other hidden element already gets.

## The fix

Add the same `!quizResult` gate to the `typedAnswers` branch of the
`hide-video` binding, matching the existing pattern used by
`hideThemeBadge`/`hideCover`/`StudyInfoPanel`:

```
:hide-video="typedAnswers ? (hideVideo && !quizResult) : (hideVideo || autoRevealTargetsVisual) && !autoRevealedThisCard"
```

Must not break:

- The Hide Video toggle itself (`hideVideo.value`) is untouched - only the
  effective prop passed to `StudyMediaPlayer` changes. Since `quizResult`
  resets to `null` on `presentationKey`/`scope` changes (existing watchers,
  lines 136-140 and 169-174) and via `continueTypedAnswer` (line 243), the
  next card still respects whatever the user left Hide Video set to -
  exactly how `hideCover`/`hideThemeBadge` already behave across cards.
  - The non-`typedAnswers` (manual review) branch is untouched.
- `give-up` (`saveTypedAnswer('fail', null)`) also sets `quizResult`, so a
  give-up reveals the video too, consistent with it already revealing the
  theme badge/cover/info panel.

## Build steps

- [x] **1. Gate the typed-answers hide-video binding on `!quizResult`.**
  Edit the `hide-video` prop on `<StudyMediaPlayer>` in
  `nuxt-app/app/pages/study/index.vue` (~line 871) as shown above.
  **Done when:** with Typed Answers on and Hide Video on, submitting an
  answer (correct, incorrect, or give-up) unhides the video immediately and
  it stays visible through the result/continue phase; moving to the next
  card re-hides it if Hide Video is still toggled on.

## Verify

- `bun run build` from `nuxt-app/` (no test runner coverage needed - this is
  a template-binding change with no new pure logic; `studyReveal.ts`'s
  existing exported helpers are unchanged).
- Manual: on `/study`, enable Typed Answers, enable Hide Video, let a card
  load, type and submit a correct answer - video should reveal. Repeat for
  an incorrect answer and for "give up". Advance to the next card (Continue)
  and confirm the video is hidden again at the start of the new card, since
  Hide Video is still on.
- Confirm manual (non-typed-answers) Study is unaffected: Hide Video still
  stays hidden until Auto Reveal or the `i`/manual reveal path, same as
  today.
