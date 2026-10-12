# Feature: Status UI + bulk (104b)

**From build-plan:** feature 104b (parent: 104, Learning status)
**Status:** verified
**Branch:** feature/104b-status-ui-bulk

## Goal

Put 104a's stored `known` flag and derived `status` in front of the user: a status
chip (New / Learning / Known / Suspended) on `/cards` rows, the inspector and
Study's info panel; Mark known / Mark unknown from Study's Edit card panel, the
`/cards` inspector and the bulk selection bar; a Status filter on `/cards`; and a
"Mark all N matching known" bar, so a whole searched playlist is one click.

## In scope

- A shared `CardStatusChip.vue` (label + tone per status) used by `CardTable`
  (replacing the Suspended-only badge), `CardInspector` and `StudyInfoPanel`.
- Mark known / Mark unknown button in `CardInspector` (beside Suspend) and in
  `StudyCardEditPanel` (Mark known only: a card in Study is never known; Study
  then moves on, like Suspend). Bulk "Mark known" / "Mark unknown" in the `/cards`
  selection bar.
- `/cards` Status filter (All / New / Learning / Known / Suspended) replacing the
  Suspended toggle. Server: `CardListFilters.suspendedOnly` becomes
  `status?: CardStatus`, applied with `cardStatusExpr`; `GET /api/cards` and
  `/api/cards/ids` read `status=`, and still read `suspended=1` as
  `status=suspended`.
- "Mark all N matching known" bar (inline confirm) shown wherever "Delete all N
  matching" shows, fetching ids at Confirm time and posting them to
  `POST /api/cards/known` in batches of 500.
- Tests for every piece of new logic.

## Out of scope

- Any change to box, streak, due date or review history (104a guarantees it).
- Known per grading track; Bury chip; Listen and party mode.
- Bulk-known from `/decks` rows (the deck card list shares `CardTable` and
  `CardInspector`, so the chip and the inspector button appear there for free;
  no new `/decks` bulk bar).
- Server route changes for marking: `POST /api/cards/known` already exists.

## Build loop

Build one step at a time. Autopilot: no pause per step, review at the final packet.

## Build steps

- [x] **Step 1 - Status filter on the server** - replace `suspendedOnly` with
  `status?: CardStatus` in `CardListFilters`, condition `eq(cardStatusExpr,
  status)` in `cardSearchCondition`; `parseCardListFilters` reads `status` (one of
  the four, else error) and maps legacy `suspended=1` to `"suspended"`;
  `hasAnyCardsIdsFilter` uses it. *Done when:* tests cover each status through
  `listCards`, a bad `status` value rejected, `suspended=1` still working,
  `status` alone satisfying `hasAnyCardsIdsFilter`; typecheck passes.
- [x] **Step 2 - Status chip** - `components/card/CardStatusChip.vue` (`status`
  prop, text label, tone via existing tokens) and a pure `app/utils/cardStatus.ts`
  (`CARD_STATUS_LABELS`, `CARD_STATUSES`) with a test. Used in `CardTable` (in
  place of the Suspended badge), `CardInspector` and `StudyInfoPanel` (follows
  Hide Info like the rest of the panel). *Done when:* chips show on `/cards`, the
  inspector, and Study in the browser; build passes.
- [x] **Step 3 - Mark known / unknown, single card** - `CardInspector` toggle
  (emits `updated` with `known`, `suspended: false` and the recomputed `status`,
  mirroring the suspend toggle); `StudyCardEditPanel` Mark known button emitting
  `known`, handled in `study/index.vue` and `useStudySession` like `suspended`
  (move on, card no longer served). *Done when:* in the browser marking a card
  known from the inspector flips its chip and clears Suspended; marking from
  Study moves on and the card is not served again; unmarking restores it with its
  old box.
- [x] **Step 4 - Bulk Mark known / unknown, Status filter, Mark all matching** -
  `/cards`: Status select replaces the Suspended toggle (`?suspended=1` and a new
  `?status=` seed it); selection-bar Mark known / Mark unknown; "Mark all N
  matching known" with inline confirm beside "Delete all N matching". Rows leave
  the list when a change no longer matches the active Status filter. *Done when:*
  browser evidence of: filter narrowing, bulk mark updating chips, mark-all-matching
  on a search marking every match; rows dropping from a Known/Learning view;
  `bun run test` and `bun run build` pass.

## Files / areas

- `nuxt-app/server/utils/cards.ts`, `cardDelete.ts` (+ tests)
- `nuxt-app/app/utils/cardStatus.ts` (+ test)
- `nuxt-app/app/components/card/CardStatusChip.vue`, `CardTable.vue`,
  `CardInspector.vue`
- `nuxt-app/app/components/study/StudyInfoPanel.vue`, `StudyCardEditPanel.vue`
- `nuxt-app/app/pages/study/index.vue`, `app/composables/useStudySession.ts`
- `nuxt-app/app/pages/cards/index.vue`

## Data / contracts

- `GET /api/cards` and `/api/cards/ids` gain `status=new|learning|known|suspended`;
  `suspended=1` is kept as an alias. `/api/cards/ids` still refuses to run with no
  filter at all.
- `CardWithDetails.known`/`status` already exist in server and client mirrors.

## Testing

Vitest gate is on. Logic needing tests: the status filter condition and its
parsing (`cards`/`cardDelete` tests, in-memory DB pattern of the existing
suspended filter tests), and `app/utils/cardStatus.ts`. Vue surfaces ride on
browser evidence and `bun run build`. Run `bun run test` and `bun run build` in
`nuxt-app/`.

## Notes for the AI

- Mirror the suspend UI closely; do not invent new bulk shapes.
- Comments explain why only; no em dashes; no inline styles; existing tokens.
