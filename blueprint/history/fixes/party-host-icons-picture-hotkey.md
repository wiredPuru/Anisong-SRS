# Fix: party host panel icon transport buttons, and a hotkey for the picture effect

**Type:** Fix
**Status:** verified
**Fixes:** none (not from a findings-ledger entry)

## The problem

The host panel's Now playing card (`PartyNowPlaying.vue`) lays its five
transport controls out as wide text buttons: Previous, Pause/Play, Next
(Show results on the last song), Reveal, and Skip to end. Skip to end wraps
onto a second row. All five already have keyboard shortcuts
(`usePartyHotkeys.ts`), but nothing on the buttons says so, which is the
convention elsewhere in the app: Study's icon buttons name their key in a
hover tooltip ("Undo &middot; U").

## The fix

Turn the five transport buttons into icon buttons with a hotkey tooltip,
reusing Study's pattern (inline SVG in `aria-hidden`, `aria-label` for the
name, a custom `<span class="tooltip">` rather than the native `title`).

| Button | Icon | Tooltip | Label for assistive tech |
|---|---|---|---|
| Previous | skip back | `Previous song · P` | Previous song |
| Play / Pause | play, swaps to pause | `Play · Space` / `Pause · Space` | Play, Pause |
| Next | skip forward | `Next song · N` | Next song |
| Next on the last song | list or chart | `Show results` (no key) | Show results |
| Reveal | eye | `Reveal · R` | Reveal |
| Skip to end | fast-forward to bar | `Skip to the last 3 seconds · E` | Skip to end |

- Keep each button's current colours (Play/Pause accent fill, Reveal green,
  others outline), disabled rules (Previous at the start, Reveal once
  revealed, Skip to end with no duration, Next/Show results at the end), and
  commands. Only the face of the button changes.
- The five fit on one row (`repeat(5, 1fr)`), so the narrow-screen two-column
  rule goes away; the buttons keep a comfortable touch height (about 52px).
- The tooltip is a small `.tooltip` chip shown on hover and keyboard focus,
  above the button so the row below it is not covered. `icon-btn`'s tooltip
  CSS in `main.css` is scoped to `.icon-btn`, so this gets its own scoped rule
  in the component instead of changing the shared one.
- Phones have no hover, so the icons must read on their own (Play/Pause swap
  shows the state) and the `aria-label`s stay.
- Out of scope: the checkboxes and text links below the volume slider
  (Random start, Next on end, Buzzer mode, Show results, Add to deck, End
  game), the stuck-clip buttons (Cancel, Skip to next, Change source), the
  Correct/Wrong judge buttons, and the other panels' hotkeys. Say if you want
  any of those done the same way.

**Must not break**
- Space, R, N, P, arrow keys and E still do what they did (step 1 does not
  touch `usePartyHotkeys.ts`).
- Each button still sends the same command it does now.

## Second change: a hotkey for the picture effect

Added to this spec (folded in rather than a separate fix) because it touches
the same host-panel keys. Blur (`B`), Pixelate (`X`), Mute (`M`) and Censor
(`C`) already have keys; the **Picture** effect in the Effects panel
(Video / Bubbles / Music player) does not, so hiding the clip behind a picture
takes several taps.

- **`V` toggles the picture for the current song.** From Video it switches to
  the hiding picture; from Bubbles or Music player it goes back to Video. Like
  `B` and `X`, it sends the existing `effects` command with
  `target: "current"` and the other effect values left as they are.
- **Which hiding picture:** the one the host last used. Pressing `V` while a
  hiding picture is showing remembers it (so Music player picked in the panel
  returns on the next `V`); with none remembered it is Bubbles. The memory is
  just for the open host panel, not saved.
- The decision is a small pure helper, `togglePicture(current, lastHiding)` in
  `app/utils/partyPicture.ts`, with a test beside it, since it is the part with
  a wrong answer possible. `usePartyHotkeys.ts` calls it.
- Ignored with no game loaded and while typing in a text field, the same as
  the other effect keys. It changes the current song's effects only, never the
  armed "next song" effects.
- Discoverable: a new `V` line in the hotkey list (`?` overlay, via
  `PARTY_HOTKEYS`) and a short "V toggles" hint beside the Picture pills in
  the Effects panel.
- During a lightning round the round owns the picture, so `V` changes the
  setting but the display keeps showing the round's picture, the same as the
  panel's own buttons today. Revealing a song still lifts every effect.
- Out of scope: new picture modes (blackout and cover stay lightning-only),
  other effects' keys, and any display-side key.

## Build steps

- [x] **1. Icon transport buttons with hotkey tooltips.** Replace the five
  text buttons in `PartyNowPlaying.vue` with icon buttons per the table, add
  the tooltip and icon styles to its scoped CSS, and drop the two-column
  media rule for the transport row.
  *Done when:* the transport row shows five icons on one line at desktop and
  phone widths; hovering or focusing each shows its tooltip with the key; the
  Play/Pause icon follows the game state; each button still sends its command
  and its disabled states match today's; `bun run test` and `bun run build`
  pass.
- [x] **2. `V` toggles the picture effect.** Add `app/utils/partyPicture.ts`
  (`togglePicture`, default hiding picture Bubbles) with
  `partyPicture.test.ts`; wire `V` into `usePartyHotkeys.ts`; add the `V`
  entry to `PARTY_HOTKEYS` and the "V toggles" hint to the Picture pills.
  *Done when:* with a game loaded, pressing `V` on the host panel hides the
  display's picture (Bubbles, or the last hiding picture used) and pressing it
  again shows the video; it does nothing while typing in a field or with no
  game; the `?` overlay lists it; the new test passes along with the rest of
  `bun run test`, and `bun run build` passes.

## Verify

- Check the host panel with a game loaded: the row is icons only, tooltips
  read as in the table, and clicking each icon does what its text button did
  (play/pause, previous, next, reveal, skip to the last 3 seconds).
- Press Space, R, N, P and E and confirm they still work with the tooltips
  showing.
- Press `V` with a game loaded: the display's picture switches to Bubbles and
  the Effects panel's Picture pill follows; `V` again returns to Video. Pick
  Music player in the panel, press `V` twice, and confirm it comes back to
  Music player. Click into a text field and confirm `V` types a letter.
- Screenshot at about 1280px and at a phone width (about 390px).
- To check without touching your real host password, run a second party
  process with `GAQ_SRS_DATA_DIR` pointing at a copy of the database and its
  own throwaway password and ports, then stop it afterwards.
