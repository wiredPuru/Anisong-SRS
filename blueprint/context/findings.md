# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-14 [P2] open - `bun run preview` does not boot; the documented command crashes before its listener starts

**File:** nuxt-app/server/utils/dataDir.ts:16 (via nuxt-app/scripts/preview.mjs)
**Found:** 2026-09-08 by /audit (scope: current; lens: security, re-verifying F-11)
**Why it matters:** Nuxt's `preview` CLI runs the built server with its process `cwd` set to `.output` (its own banner confirms this: "Working directory: .output"). `resolveMigrationsFolder()` (`server/db/dataDir.ts:13-16`) falls back to the relative path `"server/db/migrations"` when `GAQ_SRS_MIGRATIONS_DIR` is unset, and nothing sets that variable for this path - only the launcher (`launcher/index.ts:31-33`, for a compiled binary or `bun run launch`) does. From `.output`, that relative path resolves to a directory that does not exist, so `runMigrations` throws `Can't find meta/_journal.json file` and the process exits(1) before Nitro ever opens a listener. Reproduced twice: once via `bun run preview` (the new `scripts/preview.mjs` wrapper) and once via the raw `node_modules/.bin/nuxt preview` binary with no wrapper at all - both fail identically, and `git log -- nuxt-app/package.json` shows the `preview` script has pointed at plain `nuxt preview` since the project's second commit, so this is a pre-existing gap, not a regression from this session's F-11 changes. It does mean AGENTS.md's Commands entry ("Preview production build: `bun run preview` (binds to `127.0.0.1`)") describes a command that cannot currently reach the point where its binding would even matter, and it is the one place besides the packaged launcher where someone would manually verify a production build.
**Suggested fix:** Have `scripts/preview.mjs` set `GAQ_SRS_MIGRATIONS_DIR` (and ideally `GAQ_SRS_DATA_DIR`) to an absolute path before importing the CLI, the same way `launcher/index.ts` already does, so the preview path doesn't depend on `cwd`. Add a smoke check (even just to the manual `/try` guide) that `bun run preview` actually reaches "GAQ SRS is running at ...".
**Resolution:**

### F-15 [P2] open - Only `onError` is scoped to the active element; `markPlayable` is not, so a detached element can retract a real failure

**File:** nuxt-app/app/components/study/StudyMediaPlayer.vue:363 (guard) vs 375 (no guard)
**Found:** 2026-09-13 by /audit (scope: current; lens: quality)
**Why it matters:** Step 1 added the right guard to the failing path - `onError()` drops any event whose `target` is not `activeEl` - but the new healing path it introduced has no equivalent. `markPlayable()` is bound to `@canplay`, `@loadeddata` and `@playing` on both elements and clears the failure unconditionally, without checking which element fired. Vue's `v-if`/`v-else-if` means only one element is mounted at a time, but a *detached* element keeps its template listeners and can still fire a late `loadeddata`/`canplay` from a load that was in flight when Vue swapped it out. Sequence: a video card is still loading, the user picks "Use audio for this card", `mediaKind` flips and the `<video>` is detached mid-load, the `<audio>` mounts with a genuinely broken source and errors (veil up, `failedKind = "audio"`), and then the detached `<video>` finishes loading and fires `loadeddata` - `markPlayable()` runs and clears a failure that is still true, leaving no veil and nothing playing. `watch(mediaKind)` pauses both elements on the swap, but pausing does not stop an in-flight load. This is the same defect class the fix exists to close, left open on the opposite path.
**Suggested fix:** Give `markPlayable` the guard `onError` already has - take the event, ignore it when `event.target !== activeEl.value` - so both directions agree on which element is allowed to speak. `onSeeked`/`settleBuffering` bindings do not need it; only the ones that mutate the failure verdict do.
**Resolution:**

### F-16 [P2] fixed - `togglePlay()` sets a failure message with no failed kind, so its veil renders with zero actions

**File:** nuxt-app/app/components/study/StudyMediaPlayer.vue:493
**Found:** 2026-09-13 by /audit (scope: current; lens: quality)
**Why it matters:** `togglePlay()`'s `el.play().catch()` sets `errorMessage.value = "Couldn't play this clip."` but never sets `failedKind`. The veil's action block is now gated on `failedKind === "video"`, so this path renders the message with no Try again, no audio fallback and no download - and the play button is `:disabled="!!errorMessage"`, so the only way out is the `S` hotkey, which calls `togglePlay()` unguarded. The dead-end veil itself pre-dates this change (the old `videoBroken` was equally unset here), so it is not a regression, and step 3 already plans to enable the play button. What step 3 as written will *not* fix is the missing kind: it says "drive the actions from the failed kind", and this path has no kind to drive from, so it will still render an actionless veil after step 3 lands. Worth pinning down now while the failure-state rework is open, rather than discovering it after the fix closes.
**Suggested fix:** Set `failedKind.value = mediaKind.value` alongside the message in the `catch`, so step 3's kind-scoped actions cover this path too. A play rejection is nearly always the autoplay policy rather than a broken clip, so consider a distinct message and a "Try again" that just re-calls `play()` instead of reloading.
**Resolution:** Repaired 2026-09-13 in the `false-playback-failure` fix, folded into its step 3 rather than taken as a separate step, since it is the same `togglePlay()` the step already had to change. The `play()` rejection now sets `failedKind.value = mediaKind.value`, so the veil's kind-scoped actions cover this path, and it ignores an `AbortError` - step 3 made `togglePlay()` call `retryLoad()` first when a failure is on screen, which tears down the in-flight play request and would otherwise have re-veiled a clip that was recovering. The suggested distinct message for an autoplay-policy rejection was not taken: it is a separate copy decision and the actions are now correct either way. Not re-reviewed yet - `/audit` moves this to `closed`.

### F-17 [P3] open - `onError` still infers the failed kind from `mediaKind`, which the spec asked it to stop doing

**File:** nuxt-app/app/components/study/StudyMediaPlayer.vue:370
**Found:** 2026-09-13 by /audit (scope: current; lens: quality)
**Why it matters:** The spec's own wording for this step is "Record which kind failed rather than inferring it from `mediaKind` at handler time", and the implementation does `const kind = mediaKind.value`. It is correct today only because `activeEl` is derived from `mediaKind`, so the guard immediately above it guarantees the two agree - the coupling the spec wanted removed is what makes the line safe. No current defect; it is a latent one if `activeEl` ever stops being a pure function of `mediaKind`.
**Suggested fix:** Derive it from the element that actually fired, which is already in hand: `const kind = el.tagName === "VIDEO" ? "video" : "audio"`. Same length, and it stops depending on a second source of truth.
**Resolution:**
