# Study theme chips: toggle any combination

**Type:** Fix
**Status:** verified

## The problem

Feature 95a's chips on `/study` (Openings / Endings / Inserts / All) behave as a
single choice: `withThemeChip` replaces `themeTypes` with exactly one type, so
"Openings and Inserts" or "Openings and Endings" can only be set through the
Filters popup. They should be independent toggles.

## The fix

- Openings, Endings and Inserts are toggles: each click adds or removes that
  type from `StudyFilters.themeTypes`, so any combination works.
- All stays as a button: it clears the selection (no OP/ED filter) and shows as
  active exactly when nothing is selected.
- Selecting all three is the same as All, so it normalises to an empty list and
  All lights up, matching how the server reads an empty `themeTypes`.
- The three type chips use `aria-pressed` for their own state. The Filters
  popup's Theme pills already toggle the same field, so the two stay in sync.
- `?themes=OP|ED|IN` from `/decks` still sets exactly that one type.
- Must not break: the filter badge count, saved filters in `localStorage`, or
  the "Narrows this session only" note.

## Build steps

- [x] 1. **Toggle logic + component.** Replace `activeThemeChip`/`withThemeChip`
  in `app/utils/studyFilters.ts` with `toggleThemeType(filters, type)` (adds or
  removes, normalises all three to `[]`) and `clearThemeTypes(filters)`; keep a
  `withThemeChip`-style single set for the `?themes=` param. `StudyThemeChips.vue`
  marks each of OP/ED/IN active when it is in `themeTypes` and All when empty.
  Update `studyFilters.test.ts`.
  **Done when:** `bun run test` passes with cases for toggling on, toggling off,
  OP plus IN together, all three collapsing to All, and All clearing a mix; and
  on `/study` clicking Openings then Inserts shows both highlighted and the
  Filters badge reads 1.

## Verify

`bun run test` and `bun run build`; then on `/study` click Openings, Endings,
Inserts in turn and confirm each toggles on and off independently, All clears
them, and the Filters popup's Theme pills agree.
