# Fix: Show the meaning of each part on the Kanji page

**Type:** Fix
**Status:** verified

## The problem

After Reveal, `/kanji` lists a kanji's parts (primitives) as bare glyphs
(`app/pages/kanji/index.vue:94`), with no definition. The glyphs are not
clickable there either, so the user cannot see what 鬼 means inside 魔 without
leaving for the Japanese breakdown. For recalling a kanji by its parts (the
point of the RTK-style keywords) the meanings need to be on the page.

## The fix

Return each part's keyword with the study item and show it under the glyph once
revealed.

- Server: `KanjiStudyItem` (`server/utils/kanjiCards.ts`) gains
  `partInfo: { char: string; keyword: string | null }[]`, built in `withEntry`
  from `lookupKanji(entry.parts)`. A part with no dictionary entry (the bare
  stroke shapes ノ ハ ｜ ユ ヨ マ) gets `keyword: null`. The part that equals the
  kanji itself stays filtered out on the page, as today.
- Client: mirror the field in `useKanjiStudy.ts`'s `KanjiStudyItem` (same field
  order, per F-09). The page renders each part as a small chip: glyph on top,
  keyword beneath (`(shape)` when null). Same reveal timing as today, so no
  hint appears before Reveal. Wrapping and narrow widths keep working.

Must not break: grading, the story line, the Add/Remove buttons in the
breakdown, or `GET /api/kanji/cards` consumers (`useKanjiDeck` reads only
`char`). The breakdown's own part chips are out of scope.

## Build steps

- [x] **Step 1 - Server returns part keywords** - add `partInfo` to `KanjiStudyItem` and `withEntry`, with a test. *Done when:* `bun run test` passes with a test that 魔 returns a `partInfo` entry for 鬼 with a non-empty keyword, and a part without a dictionary entry returns `keyword: null`; `GET /api/kanji/cards/next` shows the field.
- [x] **Step 2 - Show them on /kanji** - type the field in `useKanjiStudy.ts` and render glyph plus keyword chips after Reveal. *Done when:* in the running app, with a kanji in the deck, Reveal shows every part with its meaning (a stroke-shape part shows "(shape)"), nothing extra shows before Reveal, and `bun run build` passes.

## Verify

1. `bun run test` from `nuxt-app/`.
2. `bun run dev`, add 魔 from a card's Japanese breakdown, open `/kanji`, press Space: parts show with meanings. Resize narrow: chips wrap, no horizontal scroll.

## Notes for the AI

- Plain CSS tokens, no inline styles, no em dashes, minimal comments.
- Test lives in `server/utils/kanjiCards.test.ts`; UI rides on build plus browser evidence.
- No `project-plan.md` or `build-plan.md` change: it deepens the existing Kanji Study page (feature 111c).
