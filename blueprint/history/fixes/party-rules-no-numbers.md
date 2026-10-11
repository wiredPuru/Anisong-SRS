# Fix: party display rules show without list numbers

**Type:** Fix
**Status:** verified
**Fixes:** none (not from a findings-ledger entry)

## The problem

The rules on the party display are drawn as an ordered list, so every line the
host types gets a number added in front ("1. +2 Anime Title", "2. +1 Op/ED").
The host's own text is what should show: they write the rules as plain lines
(or add their own numbers or bullets if they want them).

`PartyRulesCard.vue` renders each non-empty line of `state.rules` inside an
`<ol class="rules-list">`, which supplies the numbers. It is the only place
rules are numbered; the host's Rules panel is a plain text box and the phone
page does not show rules.

## The fix

- In `nuxt-app/app/components/party/PartyRulesCard.vue`, render the lines as an
  unmarked list: a `<ul>` with `list-style: none` and no left padding, so each
  rule sits flush left exactly as typed. Keep the one-rule-per-line splitting,
  the gap between lines, the wrapping, and the dashed divider above the scores.
- No change to the host panel, the `rules` command, saved rules, or the layout.

**Must not break**
- Rules still wrap long lines and still skip blank lines.
- The rules block still sits above "Scores" in the same card.

## Build steps

- [x] **1. Drop the list numbers from the rules block.** Swap `<ol>` for an
  unmarked `<ul>` and remove the marker indent in `PartyRulesCard.vue`.
  *Done when:* on `/party/display` (arrange mode, or with rules set) each rule
  line shows exactly the text the host typed, with no added "1.", "2." and no
  extra left indent; `bun run test` and `bun run build` pass.

## Verify

- Screenshot `/party/display` in arrange mode (press `L`): rules read as plain
  lines above "Scores".
- Type a rule that starts with its own number or bullet in the host panel and
  confirm it shows once, not twice.
