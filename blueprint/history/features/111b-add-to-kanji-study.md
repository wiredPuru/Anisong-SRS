# Feature: Add kanji to Kanji Study from the breakdown (111b)

**From build-plan:** feature 111, sub-feature 111b
**Status:** verified

## Goal

Let the user put kanji from the Japanese breakdown (109/110) into their personal
kanji deck (111a) with one click, and see which are already in it. A "Kanji
Study" entry joins the left rail. Everything is hidden while Settings >
Japanese breakdown is off. The page behind the rail entry is 111c; until it
lands `/kanji` has no page.

## In scope

- `app/utils/kanjiDeck.ts` (pure): `canAddToKanjiDeck(entry)` is true only for a
  character with a dictionary entry; `kanjiDeckAfter(set, char, added)` returns
  a new set.
- `useKanjiDeck` composable: shared `useState` set of added characters, `load()`
  from `GET /api/kanji/cards` (chars only), `add(char)` -> `POST /api/kanji/cards`
  and `remove(char)` -> `DELETE`, with per-character pending and an error
  message.
- `KanjiDeckButton.vue`: "Add to Kanji Study" / "Added" (click removes) button,
  shown only for characters with an entry.
- Tiles in `StudyJapaneseBreakdown.vue` and the detail view in
  `StudyKanjiDetail.vue` carry the button; part chips show an "in deck" state and
  the detail view's Add acts on the drilled character, so a part is added by
  opening it (parts with no entry get no button).
- `useJapaneseBreakdownSetting` composable (shared `useState`, loaded from
  `/api/media-library`) so the rail can read the flag; Settings' toggle refreshes
  it on save.
- Rail: a "Kanji Study" link to `/kanji` (icon `漢`), only when the setting is on.

## Out of scope

- The `/kanji` page itself and any study UI (111c).
- Bulk add, a deck list view, or removing from anywhere but the button.
- Any change to cards, scheduling, stats or the server routes from 111a.

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Pure helpers + composables** - `kanjiDeck.ts` with tests, and
  `useKanjiDeck` / `useJapaneseBreakdownSetting`. *Done when:* `bun run test`
  passes with the new cases.
- [x] **Step 2 - Add button on tiles and detail view** - `KanjiDeckButton.vue`,
  wired into the breakdown tiles and `StudyKanjiDetail` (including in-deck state on
  part chips). *Done when* (browser, Listen): Add on 魔 flips to Added, a reload
  keeps it, clicking again removes it, a no-entry part shows no button, and
  `GET /api/kanji/cards` matches.
- [x] **Step 3 - Rail entry + setting gate** - `NavBar.vue` shows Kanji Study only
  while Japanese breakdown is on; toggling the setting updates the rail without
  a reload. *Done when* (browser): the rail entry is absent with the setting off
  and present with it on; `bun run build` passes.

## Files / areas

- `nuxt-app/app/utils/kanjiDeck.ts` (+ `.test.ts`)
- `nuxt-app/app/composables/useKanjiDeck.ts`, `useJapaneseBreakdownSetting.ts`
- `nuxt-app/app/components/study/StudyKanjiDeckButton.vue` (new), `StudyKanjiDetail.vue`,
  `StudyJapaneseBreakdown.vue`
- `nuxt-app/app/components/nav/NavBar.vue`,
  `app/components/settings/SettingsJapaneseBreakdownControl.vue`

## Data / contracts

- Uses 111a's routes unchanged. `GET /api/kanji/cards` returns every added kanji
  with its entry; the client keeps only `char`.
- No schema or server change.

## Testing

- Pure helpers ship tests. UI steps: browser on `/listen` against a scratch
  database, console clean, plus `bun run build`.

## Notes for the AI

- Scoped styles with `var(--token)`, no inline styles, no hard-coded colors.
- No em dashes in comments or copy.

**Built as:** `kanjiDeck.ts` helpers, `useKanjiDeck` and `useJapaneseBreakdownSetting` composables, `StudyKanjiDeckButton.vue` (named with the folder prefix so Nuxt registers it) on tiles and the detail view, an in-deck border on part chips, and a rail link labelled "Kanji" (icon 漢; "Kanji Study" does not fit the rail) shown only while the breakdown setting is on. `/kanji` has no page until 111c. Verified: `bun run test` (2552 passed), `bun run build`, and browser checks on `/listen` against a scratch database (Add, reload keeps Added, Remove, no button on a bare stroke shape, rail entry present and absent with the setting on and off).
