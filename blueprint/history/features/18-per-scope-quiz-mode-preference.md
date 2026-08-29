# Feature: Per-scope quiz-mode preference

**From build-plan:** feature 18
**Status:** verified

## Goal

Let each study scope (an Artist deck, an Anime deck, or "study all") prefer
Audio-only or Video-only playback instead of the app always auto-deriving
quiz type from whatever sources a card happens to have. A forced mode is a
*preference*, not a filter: no card is ever skipped from the due-card queue
because of it.

Manual decks are excluded - `/study` can't be scoped to one yet (feature 13a
deliberately hid "Study this deck" for Created decks), so a manual-deck
setting would have nowhere to apply. That gap is a separate future feature.

## In scope

- A new `studyScopeSetting` table: one row per scope (`"artist"`, `"anime"`,
  or `"all"`), storing a `mode` of `"auto" | "audioOnly" | "videoOnly"`
  (default `"auto"`).
- `GET`/`PATCH /api/study/scope-setting` to read/write a scope's mode,
  reusing the exact scope validation `next.get.ts` already has (type must be
  `all`/`artist`/`anime`; a non-`all` scope needs a valid `id` that
  resolves to a real artist/anime, else `404`).
- `StudyMediaPlayer` gains a `forcedMode` prop. A forced mode is a
  *preference* for which source type to try: `audioOnly` picks the audio
  source (local, else the existing remote-URL fallback) when the card has
  one at all; `videoOnly` picks video the same way. If the card has no
  source of the preferred type, playback falls back to whatever it actually
  has - the existing auto behavior - rather than being skipped or shown
  broken.
- `/study` looks up the current scope's mode when the scope is known and
  passes it through to the player.
- A mode selector on `/decks`: next to "Study all decks" for the `"all"`
  scope, and next to "Study this deck" in an Artist/Anime deck's detail view
  for that scope. Changes apply immediately (no save step), matching the
  existing "Decks" checkbox panel convention on `/cards`.

## Out of scope

- Manual deck scopes - see Goal. Revisit once `/study` supports studying one
  manual deck.
- `CardPreviewModal` - it has no "scope," it always shows exactly the card
  you clicked. No `forcedMode` concept there; it keeps today's auto
  behavior unconditionally.
- Any change to `/api/study/next`'s due-card query. A forced mode never
  filters which card comes up next - only how `StudyMediaPlayer` plays the
  card once it's shown.
- A global default across every artist/anime at once - this is one scope at
  a time, matching how deck browsing already works.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema: `studyScopeSetting` table** - add to
  `server/db/schema.ts`: `id` (PK), `scopeType`
  (`text().$type<"artist" | "anime" | "all">()`), `scopeId` (nullable
  integer - null only for `"all"`), `mode`
  (`text().$type<"auto" | "audioOnly" | "videoOnly">().default("auto")`). No
  DB-level unique constraint - SQLite treats every `NULL` as distinct in a
  unique index, which would let multiple `"all"` rows slip through, so
  one-row-per-scope is enforced in application code (Step 2) instead, the
  same way `getOrCreateArtist` already avoids relying on
  `onConflictDoUpdate` for its own get-or-create. Run `bun run db:generate`
  to create the migration. *Done when:* a new migration file exists under
  `server/db/migrations`, `bun run dev` boots with no migration errors, and
  `bun run build` stays clean.

- [x] **Step 2 - Server: scope resolution + settings CRUD + endpoints** -
  extract the scope-parsing/validation `server/api/study/next.get.ts`
  already does inline (type must be `all`/`artist`/`anime`; a non-`all`
  scope needs a numeric `id` that resolves via `getArtistLabel`/
  `getAnimeLabel`, else not-found) into a shared `parseStudyScope(type,
  idRaw)` in `server/utils/cards.ts`, returning `{ error } | { notFound:
  true } | { scope: StudyScope }`; update `next.get.ts` to call it instead
  of repeating the logic. Add `server/utils/studyScopeSettings.ts` with
  `getScopeMode(scope)` (returns the stored mode or `"auto"` if no row
  exists) and `setScopeMode(scope, mode)` (updates the existing row for
  that scope or inserts one - the select-then-write pattern from Step 1's
  note). Add `server/api/study/scope-setting.get.ts` (query `type`/`id` ->
  `{ mode }`) and `server/api/study/scope-setting.patch.ts` (body
  `type`/`id`/`mode` -> validates `mode` is one of the three values,
  `400` otherwise -> `{ mode }`), both using `parseStudyScope` for the
  scope part. *Done when:* `curl` GET with `type=all` (and a real artist/
  anime id) returns `{"mode":"auto"}` before any write; PATCH sets a mode
  and the next GET reflects it; PATCH with an invalid `mode` value returns
  `400`; PATCH/GET with an artist/anime `id` that doesn't exist returns
  `404`; the existing `GET /api/study/next?type=all` still returns a card
  exactly as before the refactor.

- [x] **Step 3 - Client: forced playback in `StudyMediaPlayer`** - add a
  `forcedMode?: "auto" | "audioOnly" | "videoOnly"` prop. Add a
  `hasAudioSource` computed alongside the existing `hasVideoSource`.
  Rewrite `mediaKind`: if `forcedMode === "videoOnly"` and
  `hasVideoSource`, use video; if `forcedMode === "audioOnly"` and
  `hasAudioSource`, use audio; otherwise fall through to today's unchanged
  default (video if `hasVideoSource`, else audio) - this is what makes an
  unsatisfiable forced mode degrade to "whatever the card has" instead of
  breaking. In `app/pages/study/index.vue`, fetch the current scope's mode
  (mirroring the existing `fetchDeckLabel` watcher on `scopeResult`) into a
  `scopeMode` ref (default `"auto"`) and pass `:forced-mode="scopeMode"` to
  `<StudyMediaPlayer>`. *Done when:* PATCHing a scope's mode to `audioOnly`
  via `curl`, then opening `/study` for that scope, plays the audio source
  for a card that has one even though it also has video (confirm by
  reading network/element state, since no browser tool is available this
  session - see Testing); a card with no audio source at all still plays
  its video. `CardPreviewModal` (never passes `forcedMode`) is unaffected.
  `bun run build` stays clean.

- [x] **Step 4 - Client: mode selector on `/decks`** - add a `<select>`
  (Auto / Audio only / Video only) next to "Study all decks" in the
  top-level list, fetching `GET /api/study/scope-setting?type=all` on
  mount and `PATCH`-ing on change. Add the same selector next to "Study
  this deck" in the Artist/Anime detail view (inside the existing
  `v-if="activeType !== 'created'"` block), fetching/patching scoped to
  `{ type: activeType, id: selectedId }`, refetched whenever the selected
  deck changes. Wrap each PATCH in `try`/`catch` and show the failure
  inline (matching the existing `deckToggleError` pattern this same page
  already uses for deck-membership toggles), so a failed save doesn't
  silently revert or vanish. *Done when:* in the browser, changing either
  selector updates it immediately (no save button) and the change survives
  a page reload; an artist/anime with no saved setting shows "Auto"; the
  manual ("Created") deck view has no selector; a failed PATCH (e.g. stop
  the dev server mid-change) shows an inline error rather than failing
  silently.

## Files / areas

- `nuxt-app/server/db/schema.ts` - `studyScopeSetting` table.
- `nuxt-app/server/db/migrations/` - generated migration.
- `nuxt-app/server/utils/cards.ts` - `parseStudyScope` (new, extracted).
- `nuxt-app/server/utils/studyScopeSettings.ts` - new.
- `nuxt-app/server/api/study/scope-setting.get.ts` - new.
- `nuxt-app/server/api/study/scope-setting.patch.ts` - new.
- `nuxt-app/server/api/study/next.get.ts` - refactored to use
  `parseStudyScope`, behavior unchanged.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - `forcedMode` prop.
- `nuxt-app/app/pages/study/index.vue` - fetch + pass the scope's mode.
- `nuxt-app/app/pages/decks/index.vue` - the two mode selectors.

## Data / contracts

New table (no unique constraint - see Step 1):

```ts
// server/db/schema.ts
export const studyScopeSetting = sqliteTable("study_scope_setting", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scopeType: text("scope_type").notNull().$type<"artist" | "anime" | "all">(),
  scopeId: integer("scope_id"), // null only when scopeType is "all"
  mode: text("mode").notNull().default("auto").$type<"auto" | "audioOnly" | "videoOnly">(),
});
```

Reuses the existing `StudyScope` type from `server/utils/cards.ts`
(`{ type: "all" } | { type: "artist"; id: number } | { type: "anime"; id: number }`)
- already load-bearing across features 5, 6a, and 6b, unchanged by this
  feature.

New API:

```ts
GET /api/study/scope-setting?type=all|artist|anime&id=<number?>
  -> { mode: "auto" | "audioOnly" | "videoOnly" }

PATCH /api/study/scope-setting
  body: { type: "all"|"artist"|"anime", id?: number, mode: "auto"|"audioOnly"|"videoOnly" }
  -> { mode: "auto" | "audioOnly" | "videoOnly" }
```

`StudyMediaPlayer` prop addition:

```ts
forcedMode?: "auto" | "audioOnly" | "videoOnly"; // default: auto (today's behavior)
```

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test`
entry). Step 1/2 ride on `curl` evidence against the dev server (schema +
server logic, including the refactored `next.get.ts` path). Step 3/4 are
client behavior with no browser tool available in this session - I'll
verify what code reading, `bun run build`, and `curl`-driven server state
can confirm, and hand the actual click-through and playback-source check to
you or `/try`. `getScopeMode`/`setScopeMode` and the `mediaKind` forced-mode
branching are both pure logic with clear right/wrong answers - good
candidates to backfill once `/tests` sets up a runner.

## Notes for the AI

- `next.get.ts`'s refactor in Step 2 must not change its observable
  behavior - same 400/404/200 responses as today. It's touched because this
  feature would otherwise duplicate the same scope-validation logic a third
  time in one session (Step 2's two new endpoints both need it too), not as
  unrelated cleanup.
- The NULL-uniqueness pitfall in Step 1's note is real: never add
  `unique().on(scopeType, scopeId)` expecting it to stop duplicate `"all"`
  rows - SQLite unique indexes treat `NULL` as distinct from every other
  `NULL`. `getScopeMode`/`setScopeMode` must always look up by an explicit
  `isNull(scopeId)` check when the scope is `"all"`.
- `forcedMode` changes which source *type* is chosen (`mediaKind`); it must
  not touch `quizType` (the `hideVideo`-driven veil) or the ambient-glow
  logic, which both already key off `mediaKind`/`quizType` correctly once
  `mediaKind` itself accounts for `forcedMode`.
- Follow the existing `/decks` immediate-effect convention (like the
  per-card "Decks" checkbox panel on `/cards`) - no save button on the mode
  selectors.
