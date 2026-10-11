# Fix: party display rules join the scoreboard, and the dark panels go clearer

**Type:** Fix
**Status:** verified
**Fixes:** none (not from a findings-ledger entry)

## The problem

Two things on the party display (`/party/display`):

1. **Rules float on their own.** `PartyRulesCard` is a separate movable piece
   (`rules`, default left edge, mid-height) from the scoreboard (top right), so
   the house rules and the scores sit in different places. The host wants them
   in one area: rules above the scoreboard.
2. **The dark panels are nearly opaque.** The scoreboard, answer reveal, round
   points, timer, join chip, and answer options all use
   `--glass-surface-panel` (`rgba(14, 14, 17, 0.86)`), and the rules card, hint
   cards, and the waiting-screen join card use `--surface` (`#141417`, fully
   opaque). They hide a lot of the clip behind them. The host wants them "a
   little bit more transparent".

## The fix

**Rules into the scoreboard card**
- `PartyDisplayOverlays.vue` takes a `rules: string | null` prop and renders
  the rules at the top of the scoreboard `<aside>`, above the "Scores" title and
  list, as a titled block inside the same card (no second border or background).
- `PartyRulesCard.vue` becomes that block: drop its own width, border,
  background, and shadow; keep the Rules heading and numbered list.
- The `scoreboard` piece shows when there are scores to show **or** rules to
  show. If the host has hidden the scoreboard but rules are set, the card shows
  the rules alone, so hiding scores does not hide the rules. (Chosen default,
  flagged for review.)
- Rules text can be long, so the block keeps the card's width and wraps; it
  does not stretch the card.
- While arranging, the sample rules (`SAMPLE_RULES`) show inside the sample
  scoreboard so the card looks as it will in play.
- Remove the `rules` piece everywhere it is declared: `PARTY_PIECES`,
  `PIECE_ANCHORS`, `DEFAULT_LAYOUT`, the Main category in `PIECE_CATEGORIES`,
  and `PIECE_LABELS` in `app/utils/partyLayout.ts`, plus its `PartyLayoutFrame`
  in `display.vue`. A saved layout that still has a `rules` entry is ignored
  (`parseLayout` only reads known pieces), so no version bump or migration.
- Host side is unchanged: `PartyRulesPanel` and the `rules` command stay as is.

**Clearer panels**
- On the party display only, lower the panel opacity from 0.86 to about 0.62
  and make the `--surface` panels follow the same value instead of being opaque.
  Set the overrides on the display page's root (`.display` in
  `app/pages/party/display.vue`) so Study, Listen, the host panel, and every
  other page keep today's look. `PartyRoundSummary` builds its panels with
  `color-mix` on `--surface`, so check it does not go too faint.
- Text stays readable over a bright clip: keep the existing borders and text
  shadows, and check the result against a bright frame.

**Must not break**
- Feature 91b's drag/resize layout (other pieces keep their saved positions).
- The summary screen, the buzz-in and banner scrims (`--scrim`), and the
  ambient glow are not part of this change.
- No server, state, or schema change: `rules` already reaches the display as
  `state.rules`.

## Build steps

- [x] **1. Rules inside the scoreboard card.** Remove the `rules` layout piece;
  add the `rules` prop and block to the scoreboard; show the card when there
  are scores or rules; update `partyLayout.test.ts` if it lists pieces.
  *Done when:* with rules set and scores visible, one card shows the rules
  above "Scores"; with scores hidden, the card shows the rules alone; with no
  rules, the card looks as before; the layout toolbar no longer lists a "Rules"
  piece; `bun run test` passes.
- [x] **2. More transparent panels on the display.** Add the scoped overrides in
  `display.vue`; adjust `PartyRoundSummary` only if it comes out too faint.
  *Done when:* the scoreboard, answer reveal, round points, timer, join chip,
  answer options, hint cards, and the waiting-screen join card show the clip
  through them, while Study and Listen panels are unchanged and text is still
  easy to read over a bright frame.

## Verify

- `bun run test` and `bun run build` in `nuxt-app/`.
- Screenshot `/party/display` (arranging mode shows every piece): rules above
  scores in one card, panels visibly clearer. Compare against a bright clip.
- `bun run measure /party/display --select ...` is available if a layout claim
  needs numbers. Check Study (`/study`) still has its dark panels.
- Manual: set rules in the host panel, toggle Scores visible/hidden, confirm
  the display follows.
