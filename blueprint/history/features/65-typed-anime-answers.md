# Feature: Typed answer results and quiz scoring

**From build-plan:** feature 65 revision before merge
**Status:** verified
**Size:** one feature revision, four reviewable steps

## Goal

Turn a submitted typed answer into a satisfying quiz result instead of an
immediate transition. Save the SRS result once, reveal whether the answer was
correct, keep the current song playable, award session-only points and combo
feedback, and wait until the user deliberately chooses Continue or presses
Enter again before loading the next card.

## Design reference

- `prototypes/study.html` and `prototypes/theme.css`: Study structure and locked
  theme tokens; feature 65's first implementation already reconciled these with
  the shipped feature 62 palette.
- `nuxt-app/app/assets/css/main.css`: shipped colors, type, radii, focus, and
  reduced-motion conventions.
- `blueprint/reference/mascot/`: Temi remains available for the existing
  session-complete state. The active result uses graphic score treatment rather
  than adding mascot art over the working Study surface.
- The target is an AMQ-inspired feedback rhythm, not a pixel replica: strong
  correct/wrong color, points movement, combo emphasis, and an intentional pause.

## In scope

- A two-stage typed-answer lifecycle: answer and save, then view the result and
  explicitly continue.
- Correct, wrong, and Give up results reveal the current anime/song information
  and cover/theme treatment without pausing or restarting playback.
- A prominent result panel showing Correct or Not quite, points earned, the
  selected answer when relevant, the correct anime title, and a Continue button.
- Session-only quiz score, combo, best combo, correct count, answered count, and
  accuracy for typed answers. Show compact score/combo feedback in the Study
  header and a summary when that Study session completes.
- Keyboard continuation with Enter, with focus and event guards that ensure the
  Enter used to submit can never also continue. Mouse/touch continuation remains
  available through the button.
- Energetic but bounded CSS feedback: result color/glow, a points pop, and combo
  emphasis using existing tokens, with a calm `prefers-reduced-motion` version.
- Existing online search, exact AniList-ID grading, SRS scheduling, session log,
  and remembered Typed Answers preference.

## Out of scope

- Multiplayer rooms, opponents, timers, speed bonuses, lives, rankings,
  leaderboards, achievements, sound effects, or persisted high scores.
- Fuzzy title grading, song/artist answer modes, changes to SRS intervals, or
  retroactive scoring of manual Pass/Fail reviews.
- Recreating AMQ branding or layout, replacing the Study player/info split, or
  adding Temi to every active card.
- A database migration or API change for points; all quiz scoring is local to the
  mounted Study session.

## Build loop

Build one step at a time. Describe the step before editing, show its diff and
verification, then obtain review before moving on. Optional checkpoint commits
require approval; `/complete` owns final logging and merge. Continue on
`feature/65-typed-anime-answers`; the earlier completion archive is provisional
and must be replaced with this final verified spec when the revised feature is
completed.

## Build steps

- [x] **Step 1 - Lock result and scoring logic.** Replace the submit-and-fetch
  coupling with pure result-phase and session-score helpers plus adjacent tests.
  A correct typed answer earns 100 base points plus a 25-point bonus for each
  prior consecutive correct answer, capped at a 100-point bonus (100, 125, 150,
  175, then 200 while the combo continues). Wrong and Give up earn zero and
  reset combo; best combo and accuracy remain available for the summary.
  *Done when:* a successful save enters one result exactly once without fetching;
  all point/combo sequences are deterministic; a failed save leaves the selected
  answer editable and scores nothing; manual reviews never change quiz score.
- [x] **Step 2 - Build the result and scoreboard UI.** Add a focused Study quiz
  result component and compact header scoreboard using existing theme tokens.
  Show the correct title, the user's different selection when wrong, earned
  points, total score, combo, and a clear Continue action. Reveal answer content
  and apply the result animation only after the review save succeeds.
  *Done when:* Correct, wrong, and Give up are visually distinct and readable at
  desktop and narrow widths; score changes animate once; reduced-motion removes
  movement without hiding feedback; labels and live-region output are accessible.
- [x] **Step 3 - Continue lifecycle and playback.** Wire Continue and a fresh
  Enter keypress to fetch the next card. Keep media playing and controls usable
  during the result phase; block answer resubmission, mode changes, editing, and
  answer-exposing hotkeys until continuation. Preserve the result on next-card
  failure and make Continue become Retry without re-saving or re-awarding points.
  *Done when:* submit never advances; the submit Enter cannot leak into Continue;
  clicking Continue or pressing Enter later advances once; repeated/held/IME
  Enter cannot double-fetch; fetch failure retries safely; toggling mid-card and
  Auto Reveal resume correctly on the next presentation.
- [x] **Step 4 - Completion summary and full verification.** Add typed-quiz totals
  to the existing session-complete state and update hotkey guidance. Exercise the
  full browser flow for correct, wrong, Give up, replay/listening time, session
  completion, mode changes, modal guards, and narrow layouts.
  *Done when:* the final screen reports score, accuracy, and best combo for typed
  answers; a session with no typed answers keeps the ordinary completion state;
  all feature cases pass in the browser; `bun run test`, `bun run build`, and
  `git diff --check` pass.

## Files / areas

- `nuxt-app/app/pages/study/index.vue`: result phase, score state, answer reveal,
  continue/fetch lifecycle, header metrics, completion summary, and hotkeys.
- `nuxt-app/app/components/study/StudyTypedAnswer.vue`: answer submission state
  and selected-answer handoff needed by the result.
- New `nuxt-app/app/components/study/StudyQuizResult.vue` if the result panel is
  large enough to keep outside the page component.
- New or existing pure helpers under `nuxt-app/app/utils/` with adjacent Vitest
  coverage for score transitions and result/continue guards.
- No server route, database schema, or persisted preference changes are expected.

## Data / contracts

**Quiz result phase:** store a presentation-bound object only after the review
save succeeds: `{ presentationKey, result, selectedTitle, correctTitle,
pointsAwarded }`. Give up has no selected title. Treat the object as the lock that
prevents resubmission and exposes the Continue action. Clear it only when a new
presentation arrives or the session ends; retain it when fetching the next card
fails.

**Quiz score:** session-only state is `{ score, combo, bestCombo, correct,
answered }`. Apply exactly once per successfully saved typed result. Accuracy is
`correct / answered`, displayed as a rounded percentage; zero answers display no
quiz summary. Reset alongside `sessionHistory` when the Study scope starts a new
session. Turning Typed Answers off and back on during that session preserves it.

**Review versus advance:** submission owns only `POST /api/study/review` and the
result transition. Continue owns only the existing next-card refresh. A saved
review is appended to the session log before result display; retrying a failed
Continue never posts another review or appends another entry.

**Reveal and media:** result phase makes `StudyInfoPanel`, cover, and theme badge
visible regardless of typed-answer hiding. It does not call play, pause, seek, or
remount `StudyMediaPlayer`; the user can listen, scrub, pause, or resume before
continuing. Auto Reveal stays suppressed throughout typed answer and result
phases and resumes its configured behavior on the next normal presentation.

**Keyboard:** the answer component continues to stop its submit Enter event.
Continue accepts only a non-composing, non-repeat Enter keydown after the result
phase exists and no modal/edit interaction is active. While result feedback is
announced, focus moves to Continue; playback controls remain operable by mouse.

## Testing

- Vitest: scoring sequence and cap; fail reset; accuracy/best combo; once-only
  application; save-versus-fetch separation; retry without duplicate review,
  history, or points; submit/continue key guards including repeat and IME.
- Browser: verify correct, wrong, and Give up each stop on their result, reveal
  the answer, keep playback usable, then advance only by Continue or a later
  Enter. Verify a deliberately delayed Continue allows listening to the song.
- Browser: verify save failure, next-fetch failure and retry, quick repeated
  input, switching Typed Answers before answering, session log/edit modal guards,
  no-identity cards, and Auto Reveal behavior.
- Visual: inspect result and scoreboard at desktop and narrow widths; confirm no
  dropdown/result clipping, no player geometry regression, visible focus, and
  reduced-motion behavior.
- From `nuxt-app/`, run `bun run test` and `bun run build`; run
  `git diff --check` from the repository root.

## Notes for the AI

- The existing branch already contains the base typed-answer feature and two
  local commits; do not merge or push while this revision is active.
- Keep the quiz combo distinct from `currentCard.streak`, which is an SRS learning
  streak with different meaning and persistence.
- Derive visible score from one guarded score transition, not from animations or
  component-local callbacks. Visual effects must never own business state.
- Use the card's configured language display precedence for `correctTitle`; use
  the selected autocomplete label for `selectedTitle`.
- Critique tightened the vague “more visually stimulating” request into testable
  feedback, separated saving from continuation, prevented same-key advancement,
  retained results across fetch errors, bounded scoring to the current session,
  and excluded multiplayer-style scope.

## Verification evidence (this completion pass)

- `bun run test` (from `nuxt-app/`): 530/530 passed.
- `bun run build` (from `nuxt-app/`): succeeded.
- `git diff --check` (from repo root): clean.
- Browser walkthrough (dev server, manual "Test" deck then "KEY" deck):
  correct/wrong/Give up results each verified distinct, correct copy, correct
  points/combo math; playback continued uninterrupted through submit and
  result in every clean run; Continue via click and via Enter both worked;
  triple rapid Enter on Continue advanced exactly once (no double-fetch);
  submit Enter never leaked into Continue; session log and Previous-card
  controls correctly disabled during the result phase; session completion
  with typed answers used showed the "Quiz complete" summary (score, X/Y
  correct, accuracy%, best combo) on the existing "All caught up" state;
  narrow width (390px) checked for both the completion summary and a live
  result panel, no clipping.
- One transient anomaly during testing (a toggle click reverting) was traced
  to `/study`'s pre-existing async-setup/`Suspense` hydration timing (already
  documented as unrelated in the archives for features 51, 52, and the
  `study-hide-info-reveal-confirm` fix) - reproduced cleanly twice once
  hydration was allowed to settle first, confirming it is not a defect in
  this feature's logic.
- Findings ledger: no P0/P1 entries open or fixed. F-14/F-15/F-16/F-17 (all
  P2/P3, unrelated `StudyMediaPlayer.vue` findings from earlier audits) were
  left untouched in the ledger.
