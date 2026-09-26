# Feature: Auto Reveal for typed answers

**From build-plan:** feature 79
**Status:** verified

## Goal

Let Auto Reveal (features 38/46) run while Typed Answers (feature 65) is on.
When the countdown runs out, the round is submitted as it stands, the same as
pressing Submit, so a typed round can be played against a buzzer. This reverses
feature 65's rule that Auto Reveal stays suppressed through typed answer and
result phases.

## In scope

- The existing Auto Reveal popup, mode (Off / Video / Info / Both), and
  interval apply in typed mode unchanged. No new setting and no new storage
  key.
- The countdown arms on the first `playing` event of a card, pauses and
  resumes with playback, and shows the existing `StudyAutoRevealCountdown`
  pill, exactly as outside typed mode.
- On expiry in typed mode the round is submitted through the existing paths.
  Nothing new is graded:
  - anime as the main answer: the picked suggestion is submitted if there is
    one (`submitTypedAnswer`). Otherwise the round is saved as a blank anime
    answer (`saveTypedAnswer("fail", null)`), including when the box has text
    but no pick.
  - song or artist as the main answer: `submitMainAnswer()`, which grades the
    box's current text.
  - every other visible box (bonus song/OP-ED, required artist) is graded on
    its current value, which `saveTypedAnswer` already reads.
- Result panel, score, combo, score burst, and session log all follow, the
  same as a manual submit.
- Pause while blocked: in typed mode the countdown pauses while the card
  editor, a history Preview, the session log, or the filters popup is open
  (`answerControlsDisabled`), and resumes when it closes. Opening one of those
  clears the anime box, so a countdown that kept running would submit a blank
  the moment the overlay closed. If expiry still lands while answering is
  blocked (a submission in flight), the submit is held and fires once
  answering unblocks. It never fires behind an overlay.
- Cancel: a manual submit or Give up before expiry stops the countdown for
  that card. A card whose result panel is showing never re-arms it.
- Video / Both: while a typed round is unanswered, the video stays veiled and
  lifts when the result panel appears. The cover is already hidden until the
  result in typed mode, so nothing changes there. A manual `v` press cannot
  lift the veil early during a typed round.
- Info: adds only the timer, since typed mode already blurs the info panel
  until the result.
- If the anime answer is `unavailable` for this card (no AniList id), no
  countdown runs, because Submit and Give up are disabled for it too.

## Out of scope

- A separate typed-mode timer setting, or per-category timers.
- Any change to grading, point values, combo rules, SRS scheduling, or the
  review API.
- Auto-advancing past the result panel. Continue stays manual.
- Changing Auto Reveal behavior when Typed Answers is off.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Eligibility and expiry logic in `studyReveal.ts`** -
  change `canAutoReveal` so typed mode no longer disqualifies it. It takes
  the mode, started, and revealed, plus an `answerable` flag that is false
  for an `unavailable` anime answer. Add a pure
  `autoRevealExpiryAction({ typedAnswers, blocked, resultShown })` returning
  `"reveal" | "submit" | "hold" | "none"`. Leave `transitionTypedAnswerVideo`
  in place until Step 3, which replaces it. *Done when:* `studyReveal.test.ts` covers typed eligibility,
  unanswerable cards, and all four expiry actions, and `bun run test` passes.
  The page compiles with call sites updated to the new signature. With Typed
  Answers off, behavior is unchanged.
- [x] **Step 2 - Submit on expiry** - `StudyTypedAnswer` exposes
  `submitCurrent()`, which emits `answer` with the pick if there is one,
  else `giveUp`. The page holds a ref to it. The timeout callback uses
  `autoRevealExpiryAction`: `"reveal"` keeps today's path, `"submit"` calls
  `submitCurrent()` or `submitMainAnswer()` by `mainAnswer`, and `"hold"`
  sets a pending flag that a watcher on `answerControlsDisabled` flushes. That
  watcher also suspends the countdown while blocked in typed mode and resumes
  it after.
  The `typedAnswers` watcher re-arms the countdown in both modes. A
  `quizResult` watcher stops the countdown on any submit. *Done when:* in a
  browser, with Typed Answers on and Auto Reveal set to Info at 5s:
  - playing a card and waiting shows the pill counting down, then the result
    panel with the right grade
  - a picked-but-unsubmitted suggestion is graded as a pass
  - typed text with no pick is graded as blank
  - pausing playback freezes the pill
  - opening the session log (`L`) freezes the pill, and closing it resumes
    the countdown, which then submits
  - submitting early leaves no pill and no second review; the session log
    shows one entry
- [x] **Step 3 - Video veil in typed mode** - the typed branch of
  `:hide-video` becomes `(hideVideo || autoRevealTargetsVisual) && !quizResult`.
  Delete `transitionTypedAnswerVideo`, its watcher,
  `hideVideoBeforeTypedAnswers`, and its tests, since the binding now owns
  the veil. Two additions found while building it:
  - The Auto Reveal mode watcher now also runs in typed mode, so turning a
    Video mode off reverts a Hide Video it had forced on. Without this the
    old helper's stuck-veil bug would come back.
  - `StudyDisplayToggles`' Auto reveal button is no longer disabled in typed
    mode (feature 65 disabled it), and its tooltip says it submits your
    answer when the timer runs out. *Done when:* with Typed Answers on and Auto Reveal on Video, a
  video card plays veiled with the pill counting, and the video unveils when
  the result panel appears. Turning Auto Reveal Off shows the video during
  the round unless Hide Video is on. Toggling Typed Answers off and on
  mid-card leaves no stuck veil. Tests and `bun run build` pass.

## Files / areas

- `nuxt-app/app/utils/studyReveal.ts` + `studyReveal.test.ts` - eligibility
  and expiry logic (client).
- `nuxt-app/app/components/study/StudyTypedAnswer.vue` - `defineExpose({
  submitCurrent })`.
- `nuxt-app/app/components/study/StudyDisplayToggles.vue` - Auto reveal
  button enabled in typed mode.
- `nuxt-app/app/pages/study/index.vue` - timeout callback, hold flag and
  watcher, `typedAnswers`/`quizResult` watchers, `:hide-video` binding.

## Data / contracts

- None stored. No server, schema, or `localStorage` change.
- `autoRevealExpiryAction` return values are the one new internal contract,
  used only by `/study`.

## Testing

- Test gate is on (`bun run test`). Step 1's pure functions ship with
  tests. Steps 2 and 3 are UI wiring and ride on browser evidence
  (`playwright-cli` or a manual pass) plus `bun run build`.
- Regression pass with Typed Answers off: Video, Info, and Both still hide,
  count, and reveal as before, and pressing `i`/`v` early still finalizes the
  reveal.

## Notes for the AI

- Client only. Everything lives in `/study` and its components.
- Reuse the existing submit paths. Do not add a new grading call or a direct
  `submit(result)` from the timer. `saveTypedAnswer`'s guards and
  `reviewSubmission.saveOnce` are what keep the review from posting twice.
- `onHideToggleChanged` keeps returning early in typed mode. A manual unhide
  must not end a typed round.
- The mode-change and new-card watchers force `hideVideo`/`hideInfo` only
  outside typed mode. Keep that: in typed mode the binding supplies the veil.
- Feature 65's archive records the suppression rule this reverses. Say so in
  the archive at `/complete`.
- No em dashes in code comments or docs.

## Completion note

Completed 2026-09-26. This reverses feature 65's rule (see
`blueprint/history/features/65-typed-anime-answers.md`) that Auto Reveal stays
suppressed through typed answer and result phases: Auto Reveal now runs in
typed mode and submits the round as it stands when its countdown ends.

## Findings

### 79/F-16 [P2] closed - `togglePlay()` sets a failure message with no failed kind, so its veil renders with zero actions

**File:** nuxt-app/app/components/study/StudyMediaPlayer.vue:493
**Found:** 2026-09-13 by /audit (scope: current; lens: quality)
**Why it matters:** `togglePlay()`'s `el.play().catch()` sets `errorMessage.value = "Couldn't play this clip."` but never sets `failedKind`. The veil's action block is now gated on `failedKind === "video"`, so this path renders the message with no Try again, no audio fallback and no download - and the play button is `:disabled="!!errorMessage"`, so the only way out is the `S` hotkey, which calls `togglePlay()` unguarded. The dead-end veil itself pre-dates this change (the old `videoBroken` was equally unset here), so it is not a regression, and step 3 already plans to enable the play button. What step 3 as written will *not* fix is the missing kind: it says "drive the actions from the failed kind", and this path has no kind to drive from, so it will still render an actionless veil after step 3 lands. Worth pinning down now while the failure-state rework is open, rather than discovering it after the fix closes.
**Suggested fix:** Set `failedKind.value = mediaKind.value` alongside the message in the `catch`, so step 3's kind-scoped actions cover this path too. A play rejection is nearly always the autoplay policy rather than a broken clip, so consider a distinct message and a "Try again" that just re-calls `play()` instead of reloading.
**Resolution:** Repaired 2026-09-13 in the `false-playback-failure` fix, folded into its step 3 rather than taken as a separate step, since it is the same `togglePlay()` the step already had to change. The `play()` rejection now sets `failedKind.value = mediaKind.value`, so the veil's kind-scoped actions cover this path, and it ignores an `AbortError` - step 3 made `togglePlay()` call `retryLoad()` first when a failure is on screen, which tears down the in-flight play request and would otherwise have re-veiled a clip that was recovering. The suggested distinct message for an autoplay-policy rejection was not taken: it is a separate copy decision and the actions are now correct either way. Not re-reviewed yet - `/audit` moves this to `closed`. Closed 2026-09-26 by /audit (scope: full): re-reviewed `playIfPaused()` (`StudyMediaPlayer.vue:506-526`, where the `play()` call now lives after `togglePlay()` was split). The rejection handler sets `failedKind.value = mediaKind.value` beside the message, so the veil's kind-scoped actions render, and an `AbortError` from its own `retryLoad()` is ignored rather than re-veiling. No new defect introduced by the repair.

### 79/F-18 [P1] accepted - Any website can drive the local API: no Origin or Host check, and h3 parses cross-site "simple" POST bodies

**File:** nuxt-app/server/api/stats/clear.post.ts:3 (representative; no `server/middleware/` exists)
**Found:** 2026-09-26 by /audit (scope: full; lens: security)
**Why it matters:** The server is unauthenticated by design and binds to `127.0.0.1:3000` (a fixed, guessable port), but loopback binding does not stop the user's own browser from sending requests there on behalf of any page they visit. No route or middleware checks `Origin`, `Sec-Fetch-Site`, or `Host`. A page cannot read the responses (no CORS headers are sent), but it does not need to: CORS-simple POSTs run to completion. h3 1.15 `readBody()` parses `application/x-www-form-urlencoded` into an object and parses a body with no `Content-Type` as JSON, so a plain HTML form or a `fetch(..., { mode: "no-cors", body: new Blob([json]) })` can reach every POST route with a valid body. Reproduced against a scratch instance of the current build (throwaway data dir, port 3999), with `Origin: https://evil.example`: `POST /api/stats/clear` with no body -> 200 `{"success":true}` (on a real instance this wipes the whole `ReviewLog`); `POST /api/media-library/folders` with no `Content-Type` and a JSON body -> 200, folder added; the same route as a urlencoded form -> 200, folder added. A request with `Host: attacker.example` was also served (200), which leaves DNS rebinding open. Once rebound, the attacker's page is same-origin and can read responses: add `/` or the home directory as a library folder, then read any file through `/api/media?path=`. Other reachable writes include `/api/decks/export` (writes a bundle to any absolute `destPath`), `/api/decks/import`, and every settings route. `DELETE`/`PATCH` routes need a preflight and are not reachable this way.
**Suggested fix:** Add one Nitro middleware (`server/middleware/originGuard.ts`) that, for every `/api/` request, rejects with 403 when `Host` is not `127.0.0.1:<port>` or `localhost:<port>` (this blocks rebinding), and, for non-GET/HEAD methods, rejects when `Sec-Fetch-Site` is present and not `same-origin`/`none`, or when `Origin` is present and does not match the Host. Keep the header parsing in a pure helper with a unit test (allowed host, foreign host, missing Origin from a non-browser client, cross-site Origin). Cheap follow-on: require `Content-Type: application/json` on JSON routes so a form cannot hit them.
**Resolution:** Accepted 2026-09-26 by the user's explicit decision in the /complete for feature 79. Reason: pre-existing and unrelated to feature 79; deferred to an immediate follow-up /fix after that merge.
