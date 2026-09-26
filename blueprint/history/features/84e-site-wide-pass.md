# Feature: Site-wide pass

**From build-plan:** feature 84e (parent 84, Kai mascot overhaul)
**Status:** verified

## Goal

Carry Kai's look and Kai herself off Study and across the rest of the app: the
rail, Home, Cards, Decks, Stats, Settings, and the modals, so every screen
reads as the same sticker-sheet world. Presentation only.

## Design reference

- `blueprint/reference/mascot-v2/kai-hero.png` (Home hero art),
  `kai-sheet-transparent.png` (the "ANIME OP QUIZ" pill badge with Kai's
  head, the sticker plates, the stars and notes).
- 84a poses, 84b tokens, 84d `.kai-banner`.

## In scope

- **Rail**: Kai's head (`giggle`) as a logo at the top, linking Home; the
  active item takes a 2px `--outline` sticker border and the accent. Reverses
  62a's removal of the rail's logo tile, per project-plan §7 (build 84).
- **Home hero**: the hero illustration (`kai-hero-528/1056.webp`) fills the
  hero panel's right side, fading into the panel on its left edge, replacing
  the waving cutout; the "Ready to go" eyebrow becomes a pill badge with a
  music note, like the sheet's "ANIME OP QUIZ" badge. Panels take a 2px
  `--outline` border.
- **`MascotState.vue`** (named so Nuxt registers it as `<MascotState>`; `KaiState.vue` in `components/mascot/` would register as `<MascotKaiState>`): one component for a page's empty, loading, and error
  states - Kai (`pose` prop), a message in the default slot, optional actions
  slot. Applied to:
  - page loading: Home, Cards, Decks, Stats, Settings (`laptop`), keeping the
    existing `ActivityStatus` text inside it;
  - page load errors: the same five (`slump`);
  - empty and no-match: `/cards` no match (`surprised`), `/cards` inspector
    with nothing selected (`point`), `/decks` no match (`surprised`), `/stats`
    with no reviews (`sleepy`), where those states exist today.
  Existing copy is unchanged.
- **Modals**: every `.backdrop > .panel` dialog (nine components) takes a 2px
  `--outline` border and the larger sticker radius.

## Out of scope

- Study (84c, 84d already cover it), table row layout, chart styling, and any
  copy or behaviour change.

## Build steps

- [x] **Step 1 - Rail + Home hero** - *Done when:* screenshots of Home in both
  themes show the Kai logo on the rail and the hero art fading into the hero
  panel, and at 800px wide the rail's collapsed logo still fits its 56px
  width (measured); `bun run build` passes.
- [x] **Step 2 - `MascotState` on page states** - *Done when:* screenshots show
  Kai on the Cards no-match state and the empty inspector, the Decks no-match
  state, and a page loading state; `bun run build` passes.
- [x] **Step 3 - Modals** - *Done when:* a screenshot of one Study modal and
  one Decks modal shows the outlined panel; `bun run test` and `bun run build`
  pass.

## Testing

Presentation only. Evidence is screenshots, a measure, and the build.

## Evidence

- `bun run test`: 82 files, 1289 tests passed. `bun run build` passed.
- Home (production build on a scratch database copy, `playwright-cli`):
  Kai's head logo on the rail and the hero art filling the hero panel's
  right side in both themes. The first two art sizes cropped to just her
  face at 1400px and ran under the headline at 800px; as built it is
  `clamp(260px, 42%, 460px)` wide with the buttons moved under the headline,
  checked at 1400x900 and 800x700. At 800px the collapsed rail's logo is 38px
  in the 56px rail.
- Kai on `/cards?q=zzzzqqq` (no match, `surprised`) and the empty inspector
  (`point`); `/decks` no-match state contains the mascot image.
- `StudyFiltersModal` and `DeckCopyCardsModal` screenshots show the outlined
  panel; the same two-line swap was applied to all nine `.backdrop > .panel`
  modals.
- As built, the state component is `MascotState.vue`: a first version named
  `KaiState.vue` rendered as plain text, because Nuxt registers it as
  `<MascotKaiState>`. Its message has no bubble of its own, since every page
  `.state` block already draws a bordered box.
