# Feature: Screen effects

**From build-plan:** feature 86d (parent: 86, Guess the Anime party mode)
**Status:** verified
**Branch:** `feature/86d-party-screen-effects`

## Goal

Give the host the classic guess-the-anime handicaps: blur, pixelate, mute, and
blackout, plus a cover-art mode that shows the show's cover (blurred or
pixelated) instead of the clip. Each effect applies live to the current song,
or can be armed for the next song so the room never glimpses it clear.

## In scope

- `PartyEffects` in the game state:
  - `effects` for the current song, carried over to later songs until changed
  - `nextEffects`, a one-shot preset applied when the game moves to another
    song
- Revealing lifts every effect on the display. The stored effects stay, for
  the next song.
- Blur: 0-40px, optionally clearing to 0 over `decaySeconds`.
- Pixelate: a block size, drawn on a canvas, optionally sharpening to clear
  over `decaySeconds`.
- Mute. A picture mode:
  - `video`: the clip, or Kai's veil for an audio clip
  - `blackout`: Kai's veil, even for a video clip
  - `cover`: the anime cover, subject to blur and pixelate
- `GET /api/party/display/cover?t=` serves the cover through the server, so
  no image URL reaches the display.
- A host Effects panel with "This song" and "Next song" tabs, an "Armed"
  badge, and Cancel.

## Out of scope

- Timed round automation and lightning modes (86e). Timers, scoreboard,
  hotkeys (86f).
- Saving effect presets across restarts.
- Effects on the reveal overlay itself.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Effects in the game model** -
  - `PartyEffects`, `NO_EFFECTS`, and `parsePartyEffects` (ranges clamped,
    unknown picture rejected).
  - An `effects` command, `{ target: "current" | "next"; effects:
    PartyEffects | null }`, where `null` cancels an armed `next` and resets
    `current`.
  - Moving to a song applies and clears `nextEffects`, otherwise it keeps
    `effects`.
  - Both views carry `effects`, and the host view also carries
    `nextEffects`.
  - A pure client helper, `effectStrength(level, decay, decaySeconds,
    elapsed)`, in `app/utils/partyEffects.ts`.

  *Done when:* tests cover the parser's clamping and errors, current and
  next targets, apply-on-move for `next`/`previous`/`jump`/`load`,
  carry-over, `clear` keeping the effects, and the decay helper's linear
  fall to 0.
- [x] **Step 2 - Blur, mute, blackout, and cover on the display** -
  - The display applies CSS blur (decaying from the song's start position),
    `muted`, blackout (Kai's veil), and cover mode (the cover image, blurred,
    via the new cover route).
  - Reveal lifts all of them.

  *Done when:* screenshots show a blurred video, blur fading after the decay,
  blackout on a video clip, a blurred cover, and a clean reveal, and the
  cover route returns an image for a live token and 404 for a stale one.
- [x] **Step 3 - Pixelate** - pixelating draws the current picture (video or
  cover) into a canvas, drawing it small and then scaling it up with
  smoothing off, once per frame. The block size steps down over the decay
  when sharpening is on. Blur still applies on top. *Done when:*
  screenshots show a pixelated video, a pixelated cover, and the blocks
  shrinking over time.
- [x] **Step 4 - Host Effects panel** - `PartyEffectsPanel` sits in the
  dashboard:
  - "This song" and "Next song" tabs
  - a blur slider, a pixelate slider, a "clear over time" toggle, and a
    seconds control
  - mute, the picture mode, and Reset
  - on the next tab, an Armed badge and Cancel

  It sends `effects`. *Done when:* paired screenshots show a live change on
  the display, and an armed preset taking effect on Next.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `server/utils/partyStore.ts`
- `nuxt-app/server/api/party/display/cover.get.ts`
- `nuxt-app/app/utils/partyEffects.ts` (+ test), `app/composables/usePartyDisplay.ts`,
  `app/composables/usePartyHost.ts`
- `nuxt-app/app/components/party/PartyDisplayPlayer.vue`,
  `PartyPixelCanvas.vue`, `PartyEffectsPanel.vue`, `PartyHostDashboard.vue`

## Data / contracts

```ts
type PartyPicture = "video" | "blackout" | "cover";
interface PartyEffects {
  blur: number;          // px, 0-40; 0 = off
  pixelate: number;      // block size in px, 0 = off, else 4-64
  decay: boolean;        // blur and pixelate ease to clear over decaySeconds
  decaySeconds: number;  // 5-120
  muted: boolean;
  picture: PartyPicture;
}
// PartyGameState gains: effects: PartyEffects; nextEffects: PartyEffects | null
// PartyCommand gains: { type: "effects"; target: "current" | "next"; effects: PartyEffects | null }
// PartyDisplayState gains: effects: PartyEffects
// PartyHostState gains: effects: PartyEffects; nextEffects: PartyEffects | null
```

- **Stored vs shown:** `effects` survives `clear`, like `randomStart`, since
  it is the host's current handicap. The display shows none of it while
  revealed.
- **Decay clock:** time played since the song's start position (random
  start included), measured by the display from its own `currentTime`.
- **Cover route:** fetches the current or queued item's `coverImageUrl`
  server-side (AniList's CDN, with the app's User-Agent) and returns its
  bytes and type. It returns 404 for an unknown token or no cover.

## Testing

Vitest is on:

- The effects parser, reducer rules, and the decay helper get unit tests.
- Display effects and the host panel ride on screenshots.
- The cover route rides on `curl`.

Run `bun run test` and `bun run build` before each step closes.

## Notes for the AI

- Keep the "no answer before reveal" rule. The cover image is the answer's
  artwork, so it reaches the display only through the token route, and only
  in cover mode.
- The clip and cover are same-origin, so drawing them to a canvas never
  taints it.
- Respect `prefers-reduced-motion` only for decorative motion. The effects are
  game mechanics, so they stay.
