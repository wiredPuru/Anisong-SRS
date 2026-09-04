# Feature: Card notes (Migaku-style memory notes)

**From build-plan:** feature 56
**Status:** verified

## Goal

Let a card carry a free-text personal note - a mnemonic, a memory hook, a
reminder of what threw you off last time - editable from Edit, and shown
alongside the card's other info while studying or previewing it, the way
Migaku's card notes work.

## In scope

- A new nullable `notes` column on `card`.
- Editing the note from all three existing card-edit surfaces: `CardPreviewModal`
  (reached from `/decks` and `/study`'s history/Previous view), `/study`'s own
  live `StudyCardEditPanel`, and `/cards`' inspector-rail edit form.
- Displaying the note in `StudyInfoPanel` (shared by `/study` and Preview) as a
  new "Notes" row, present only when a note exists, subject to the same Hide
  Info blur / immersive show-hide behavior as the rest of the panel.

## Out of scope

- No separate "note" toggle, hotkey, or visibility control - it rides on the
  existing Hide Info mechanism (feature 10) like everything else in the panel.
- No rich text/formatting, attachments, or per-language notes - plain text only.
- No note field on `/cards`' Anime/Song/Artist add-candidate groups (feature
  49) - those create cards, they don't edit existing ones, and a note has
  nothing to attach to until a card exists.
- No indicator (icon/badge) on `/cards`' table rows or `/decks`' card lists
  showing whether a card has a note - out of scope for this pass; the note is
  visible once you open Preview or Study.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema + migration** - add `notes: text("notes")` (nullable)
  to the `card` table in `server/db/schema.ts`, then run `bun run db:generate`
  to produce the migration. *Done when:* a new file exists under
  `server/db/migrations/`, `Card`/`NewCard` (`$inferSelect`/`$inferInsert`)
  include `notes: string | null`, and the dev server boots cleanly with the
  migration applied.

- [x] **Step 2 - Server: expose and update `notes`** - add `notes` to
  `CardWithDetails` and `cardSelection` in `server/utils/cards.ts` (returned by
  every card-reading query: `/api/cards`, `/api/decks/cards`,
  `/api/study/next`, `/api/study/review`, `/api/cards/download`); add
  `notes?: string | null` to `UpdateCardInput` and handle it in `updateCard()`
  (trim; empty string becomes `null`, same degrade-to-null pattern the local
  path fields already use); pass `notes` through in `server/api/cards.patch.ts`.
  *Done when:* `PATCH /api/cards` with `{ id, notes: "some text" }` persists
  and returns the trimmed note; `{ id, notes: "" }` clears it to `null`; any
  `GET` route returning `CardWithDetails` includes the current `notes` value.

- [x] **Step 3 - `CardPreviewModal`: edit + display** - add `notes: string |
  null` to its local `CardWithDetails` interface; add an `editNotes` ref
  wired into `startEdit()`/`saveEdit()` with a `<textarea>` field in the edit
  form (guarded by the existing `isTypingTarget` hotkey guard, which already
  covers `TEXTAREA`); pass `:notes="card.notes"` into both `StudyInfoPanel`
  usages (plain and immersive-overlay). *Done when:* opening Preview on a
  card, editing it, typing a note, and saving shows the note in the info
  panel; reopening Preview later still shows it.

- [x] **Step 4 - `StudyInfoPanel`: render the Notes row** - add an optional
  `notes?: string | null` prop; render a "Notes" block in `.detail-rows`
  (after the existing Theme row) only when `notes` is non-empty, styled like
  the other detail rows and inheriting `.overlay`'s existing chip/text-shadow
  treatment for immersive mode - no new CSS mechanism needed. *Done when:* a
  card with a note shows a Notes row in both the plain side panel and Preview's
  immersive overlay; a card without one renders nothing extra; Hide Info still
  blurs/hides it along with the rest of the panel.

- [x] **Step 5 - `/study`'s own edit panel** - add `notes: string | null` to
  `useStudySession.ts`'s `CardWithDetails` and to `StudyCardEditPanel.vue`'s
  own (narrower) local interface; add a notes `<textarea>` there wired the
  same way as its existing local-path fields, included in its `save()` PATCH
  body; pass `:notes="currentCard.notes"` from `study/index.vue` into its
  `StudyInfoPanel`. *Done when:* editing a note from `/study`'s live edit
  panel updates that card's Notes row immediately (same `updated` event path
  the panel's existing path-clear actions already use), and the note is still
  there next time that card comes up for review.

- [x] **Step 6 - `/cards`' inspector edit form** - add `notes: string | null`
  to `cards/index.vue`'s local `CardWithDetails` interface and an `editNotes`
  ref plus `<textarea>` to its inline inspector edit form, included in
  `saveEdit()`'s PATCH body alongside the existing path fields. *Done when:*
  editing a card from `/cards`' inspector rail can set, change, and clear a
  note, and it survives a page reload.

## Files / areas

- `server/db/schema.ts`, `server/db/migrations/` (new migration)
- `server/utils/cards.ts`
- `server/api/cards.patch.ts`
- `app/composables/useStudySession.ts`
- `app/components/card/CardPreviewModal.vue`
- `app/components/study/StudyInfoPanel.vue`
- `app/components/study/StudyCardEditPanel.vue`
- `app/pages/study/index.vue`
- `app/pages/cards/index.vue`

Deliberately untouched: `NavSearch.vue`, `CardAddAnimeResults.vue`,
`CardAddSongResults.vue`, `CardAddArtistResults.vue`, `DeckAddAnimeModal.vue`
(all add-candidate/search-result surfaces for cards that don't exist yet - no
note to show or edit), and `decks/index.vue`'s own `DeckCard` interface (its
`previewCard` flows straight into `CardPreviewModal`, which already declares
its own `notes`-bearing prop type; the server response already carries
`notes` at runtime regardless of `DeckCard`'s narrower declared shape - the
same pre-existing gap that interface already has for `songTitleNative`, not
something this feature introduces or needs to close).

## Data / contracts

- `card.notes` - new nullable `text` column.
- `CardWithDetails.notes: string | null` - load-bearing addition to the
  shared shape (`server/utils/cards.ts`), duplicated by hand into the client
  copies listed in Build steps 3/5/6 only (the ones that actually read or
  edit it) - see coding-standards.md's Types section for why the client
  copies are hand-maintained rather than derived.
- `UpdateCardInput.notes?: string | null` on `updateCard()` / `PATCH
  /api/cards` - `undefined` leaves it unchanged, `null` or `""` clears it,
  any other string is trimmed and stored.

## Testing

No test runner change needed (Vitest is already configured). `updateCard()`'s
notes handling (trim, empty-string-to-null) is the only new logic, and it's
tightly coupled to the real Drizzle/SQLite call in the same function - the
existing `cards.ts` CRUD functions (`validateLocalPath`, `hasAnySource`, the
rest of `updateCard`) have no unit tests today for the same reason (DB-bound,
not pure), so this stays consistent with that precedent rather than
introducing a DB-mocking pattern nothing else in the file uses. Verify instead
by exercising the running app: set a note through each of the three edit
surfaces (Step 3/5/6's done-when criteria), confirm it displays and survives
reload, and confirm clearing it (blank the textarea, save) removes the Notes
row.

## Notes for the AI

- Match the existing local-path field pattern exactly for the
  trim-empty-to-null behavior (see `updateCard`'s handling of
  `localVideoPath`/`localAudioPath` for the shape, though notes has no file to
  clean up on clear - it's just a text column).
- `StudyInfoPanel`'s blur/immersive/overlay CSS already generically styles
  every `.detail-row` - the Notes row should reuse that class, not invent new
  styling.
- `isTypingTarget()` (`useHotkeyGuard.ts`) already treats `TEXTAREA` as a
  typing target, so no extra hotkey-guard work is needed for the new field in
  any of the three edit forms.
- Keep the three edit forms' notes field presentation consistent with each
  form's existing field style (label + input pattern already established in
  each file) rather than introducing a fourth visual treatment.
