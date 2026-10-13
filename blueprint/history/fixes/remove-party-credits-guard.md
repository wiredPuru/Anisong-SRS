# Fix: Remove party credits guard and start floor

**Type:** Fix
**Status:** verified

## The problem

The party credits guard (a global mask box over every video) and the random
start floor ("Never before N s") were added by fix commit
`3754892e51d5eb717d311f0e4b299dbe9bef5e75` (parent
`6a90ba56fed99d9a71533db5b065119b38fa6979`, archive
`blueprint/history/fixes/party-credits-guard.md`). They are no longer wanted.

## The fix

Reverse that commit's product diff, `nuxt-app/**` only, so the app returns to
its state at the parent. No later commit touches these files.

- Apply it with a guarded reverse patch (three-way, staged):
  `git diff 6a90ba56fed99d9a71533db5b065119b38fa6979 3754892e51d5eb717d311f0e4b299dbe9bef5e75 -- nuxt-app | git apply --reverse --3way --index`
- This deletes the new files (`PartyCreditsGuardPanel.vue`, `partyGuard*.ts`,
  `partyStart*.ts`, `partyGuardBox*.ts`, migration `0037` and its snapshot) and
  restores `partyGame.ts`, `partyStore.ts`, `schema.ts`, the migration journal,
  and the party components.
- Keep `blueprint/history/fixes/party-credits-guard.md` as history. Touch no
  other `blueprint/**` path except the usual archive when completing.
- The live database already has a `party_guard` table from migration 0037. It
  is left in place (empty of meaning, harmless, no data destroyed). A later
  migration gets a newer timestamp, so the leftover applied entry does not
  block it.

Must not break: per-song censor, effects, lightning, Random start, Skip to end.

## Build steps

- [x] **Step 1 - Reverse the product diff.** Apply the guarded reverse patch
  above and show the staged diff. *Done when:* `git diff --cached --stat` lists
  only `nuxt-app/**` paths, `grep -rn "creditsGuard\|startFloor\|partyGuard"
  nuxt-app/app nuxt-app/server` finds nothing, and `bun run test` passes.
- [x] **Step 2 - Rebuild and restart party servers.** Stop the running party
  process on ports 4000-4003, run `bun run build`, then `bun run party`.
  *Done when:* the build completes, ports 4000-4003 are listening, and
  `/party/host` loads without the Credits guard panel or the "Never before"
  field.

## Verify

- `bun run test` and `bun run build` from `nuxt-app/`.
- Open `/party/host` with a game loaded: no Credits guard panel, no "Never
  before" box; Random start, per-song censor, and Skip to end still work.
