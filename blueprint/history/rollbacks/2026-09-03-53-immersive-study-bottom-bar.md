# Rollback: Feature 53 - Immersive study mode: bottom bar layout

**Type:** Rollback
**Status:** verified
**Target feature:** 53 - Immersive study mode: bottom bar layout
**Target archive:** `blueprint/history/features/53-immersive-study-bottom-bar.md`
**Target commit:** `77bd2e864af08bea81b987ee553c1f1c2aace3b5`
**Target parent:** `9961b54c51dcdaa2229c76edf61e233b87451ca2`
**Reason:** User wants the bottom-bar immersive layout removed and Study/Preview
returned to feature 31's earlier overlay-on-video immersive design (card info
and Fail/Pass floated directly on the video, rather than a bar underneath it).

## Goal

Restore the product behavior that existed before feature 53 (feature 31's
overlay-style immersive mode) while preserving Blueprint history and the
compatible fix added afterward.

## Scope

### Reverse

- Product paths and behavior introduced or changed by the target commit
  (77bd2e8): the bottom-bar immersive layout in `StudyMediaPlayer.vue`,
  `StudyInfoPanel.vue`, `study/index.vue`, `CardPreviewModal.vue`, and the
  associated `main.css` token tweaks.

### Preserve

- The original feature 53 archive (`blueprint/history/features/53-immersive-study-bottom-bar.md`)
- Feature 31's underlying immersive/expand mechanism (`E` hotkey, expand
  button, `--z-immersive`/`--z-above-immersive` layering) - restored to its
  pre-53 overlay form, not removed outright
- Later build-plan and project-plan changes
- Blueprint context, adapter skills, this rollback spec, and prototypes
- Commit `2d4d2f0` ("fix: preserve Auto Reveal countdown across immersive
  toggle") - its `currentAutoRevealRemainingSeconds()` fix targets a
  dual-instance `StudyAutoRevealCountdown` structure in `study/index.vue`
  that predates feature 53 (present already in the 9961b54 parent), so it
  applies cleanly against the reverted overlay code and stays in place.

### Out of scope

- Cascading rollback of feature 31 itself, or any other feature
- Destructive data migration (none - this is presentation-only)
- Unrelated cleanup or refactoring

## Product paths

- `nuxt-app/app/assets/css/main.css`
- `nuxt-app/app/components/card/CardPreviewModal.vue`
- `nuxt-app/app/components/study/StudyInfoPanel.vue`
- `nuxt-app/app/components/study/StudyMediaPlayer.vue`
- `nuxt-app/app/pages/study/index.vue`

## Later-change risk

**Classification:** Overlap, likely compatible

| Later commit | Shared path or contract | Required handling |
| ------------ | ----------------------- | ----------------- |
| `2d4d2f0` fix: preserve Auto Reveal countdown across immersive toggle | `nuxt-app/app/pages/study/index.vue` | Preserve as-is. Verified the target commit's reverse patch (for all 5 product files, including this one) applies cleanly with `git apply -R --check` against current `HEAD` - no conflict with `2d4d2f0`'s `currentAutoRevealRemainingSeconds()` addition, since that fix's dual-`StudyAutoRevealCountdown`-instance structure already existed in feature 53's parent commit and is unaffected by reversing 53's bar layout. |

No other commits touched these product paths after `77bd2e8`, and no later
feature spec references feature 53's contracts.

## Build steps

- [x] Apply the target commit's product diff in reverse with the Type: Rollback
      guard in `/implement`.
  - Done when: the reverse patch applies only to the 5 product paths above,
    all protected Blueprint paths are unchanged, and the staged diff matches
    this rollback's scope. Confirmed: `git apply --reverse --3way --index`
    applied all 5 files cleanly, `git status`/`git diff --cached` show only
    the 5 product paths staged, no conflict markers, no protected path
    touched.
- [x] Confirm `2d4d2f0`'s Auto Reveal countdown fix still applies cleanly and
      still functions (mounted `StudyAutoRevealCountdown` still derives its
      remaining seconds from `study/index.vue`'s timer state) after the
      reverse patch lands.
  - Done when: `study/index.vue` still compiles, both `StudyAutoRevealCountdown`
    instances (overlay-immersive and non-immersive) still bind
    `:seconds="currentAutoRevealRemainingSeconds()"`, and no duplicate or
    orphaned countdown logic remains. Confirmed by grep: both instances
    (lines 678 and 723) still bind `:seconds="currentAutoRevealRemainingSeconds()"`.
- [x] Run the project checks and the observable removal path below.
  - Done when: the build passes, the bottom-bar immersive layout is no longer
    reachable, feature 31's overlay-style immersive mode works via the `E`
    hotkey / expand button, and Auto Reveal's countdown still functions across
    an immersive toggle. Confirmed: `bun run build` succeeded; `bun run
    measure /study --key e` showed `.player-card.expanded`, `.info-slot`, and
    `.answer-slot` rendering after the `e` toggle, with `.immersive-bar` and
    `.bar-row` (feature 53's bar) absent from the DOM.

## Verification

- Build: `bun run build` (run in `nuxt-app/`)
- Tests: not configured
- Removed behavior: on `/study` and in `CardPreviewModal`'s Preview, toggling
  immersive mode (`E` hotkey or the expand button) must no longer show a
  horizontal bar underneath a clean video - it must show feature 31's overlay
  (card info and, on `/study`, Fail/Pass, floated directly on top of the
  video).
- Regression path: on `/study`, load a due card, confirm normal (non-immersive)
  playback, language toggles, and Pass/Fail still work; toggle Hide Info +
  Auto Reveal on, then toggle immersive mid-countdown and confirm the
  countdown continues rather than restarting.

## Notes for the AI

- Stop on patch conflicts or evidence of an unplanned dependency.
- Do not delete the original feature 53 archive.
- Do not broaden this rollback beyond the product paths and compatibility work
  listed above - in particular, do not touch feature 31's immersive mechanism
  itself beyond what reversing 53's diff naturally restores.
