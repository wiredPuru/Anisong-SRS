# Feature: Anime title opens a Cards search

**From build-plan:** feature 106
**Type:** Feature
**Status:** verified

## Goal

Clicking the anime title on a card in Study or Listen opens `/cards?q=<romaji
title>` in a new tab, so the user can trim the pre-filled search (for example
to "Higurashi") and see every season. Same shape as feature 105b.

## In scope

- A pure helper `animeCardsSearchPath(title)` in `app/utils/deckLinks.ts`
  returning `/cards?q=<encodeURIComponent(title.trim())>`, or `/cards` for a
  blank title.
- `StudyInfoPanel` gains an optional `animeNewTab` prop. With `animeHref` set,
  the title block gets `target="_blank"` and `rel="noopener"` (mirrors
  `artistNewTab`).
- `/study` and `/listen` pass `animeCardsSearchPath(currentCard.animeTitleRomaji)`
  and `anime-new-tab`.

## Out of scope

- Preview and the `/cards` inspector keep their same-tab anime deck link.
- No server, schema, or `/cards` change: `?q=` already seeds the search and
  matches anime titles (features 35a, 49c).
- No change to the title's language toggles or Hide Info behaviour.

## Build steps

- [x] **Step 1 - Helper + test** - add `animeCardsSearchPath` and cases in
  `deckLinks.test.ts`. *Done when:* tests cover a normal title, special
  characters (`&`, `#`, spaces, Japanese), surrounding whitespace, and a blank
  title; `bun run test` passes.
- [x] **Step 2 - Panel prop and call sites** - `animeNewTab` on `StudyInfoPanel`;
  pass href and flag from `/study` and `/listen`. *Done when:* clicking the
  anime title on `/listen` opens `/cards?q=<romaji>` in a new tab with the box
  pre-filled and the Listen tab unchanged; on `/study` the link is not clickable
  while info is hidden (panel is already blurred and inert) and works after
  reveal; Preview's anime link still opens in the same tab; `bun run build`
  passes.

## Files / areas

- `nuxt-app/app/utils/deckLinks.ts`, `deckLinks.test.ts`
- `nuxt-app/app/components/study/StudyInfoPanel.vue`
- `nuxt-app/app/pages/study/index.vue`, `nuxt-app/app/pages/listen/index.vue`

## Data / contracts

None. Reads existing `animeTitleRomaji`; uses the existing `/cards?q=` param.

## Testing

Vitest for `animeCardsSearchPath` (pure). Components and pages ride on build
plus a browser check of the click path.

## Notes for the AI

- The title block is the link, so it contains the EN/Romaji/JP spans; keep the
  `deck-link` styling used by the anime deck link.
- Search is always the romaji title regardless of which language toggles are on.
- Follow the `artistNewTab` pattern in `StudyInfoPanel.vue`.
- No em dashes in comments or docs.
