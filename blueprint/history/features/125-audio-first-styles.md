# Feature: Audio-first styles (125)

**From build-plan:** feature 125
**Status:** verified (build, tests and browser evidence; Listen's edit modal picker, Auto Reveal and session Hide Video combinations left to the user's manual check)

## Goal

Feature 124's audio-first mark always hides the picture completely. This feature
gives each audio-first card a **style** for how Study hides it:

- **Blind** - today's veil, the default
- **Blur**
- **Pixelate**
- **Peephole** - a small circle that drifts over the video
- **Random** - picks Blur, Pixelate or Peephole for each showing

The style is stored on the card. It applies on `/study` only. `/listen` keeps
124's plain hidden picture whatever the style (decided at approval).

## Design reference

None. There is no new screen. The visual targets are three CSS or canvas
treatments of the existing `<video>` inside the existing player frame. The
pixelate technique is the one in `components/party/PartyPixelCanvas.vue`: draw
the frame small, then scale it up with smoothing off.

## Behaviour (the rule every step builds against)

124's reveal rule is unchanged. `audioFirstHidden` in `pages/study/index.vue`
still decides **whether** the picture is hidden. This feature only decides
**how** it is hidden:

| Situation | What shows |
|---|---|
| `audioFirstHidden` false | The normal picture |
| `audioFirstHidden` true, and the session Hide Video or Auto Reveal's visual target is also hiding the picture | The Blind veil (the stronger hide wins) |
| `audioFirstHidden` true, nothing else hiding, resolved style `blind` | The Blind veil (exactly as in 124) |
| `audioFirstHidden` true, nothing else hiding, resolved style `blur` / `pixelate` / `peephole` | The video plays visibly with that treatment. No Kai "Listening" veil |

**Details:**

- **Random:** it resolves once per showing, from a seed of `presentationKey`,
  `card.id`, and a per-session salt set after mount (so a fresh session does
  not repeat the last one's rolls). It stays the same for the whole showing, including across a pause.
  A repeat showing (after a fail, or Previous) may roll a different style. It
  never resolves to Blind.
- **`V` and the Video toggle:** they lift a styled card exactly as they lift a
  Blind one (124). The Video toggle's pressed state reads "hidden" while a
  style is applied.
- **Auto Reveal set to Video or Both:** this forces the session hide, so these
  cards show Blind until it fires. Styles are visible with Auto Reveal Off or
  set to Info.
- **Ambient glow and chrome tint:** both stay off while a style is applied, so
  the glow can't leak the picture's colours.
- **Pause:** the paused veil sits over the still-treated picture. The treatment
  is applied to the picture itself, not to a veil, so pausing never shows the
  clear frame.
- **Audio-only cards:** a naturally audio-only card, or one forced audio-only
  by Playback mode, has no video. The style does nothing there, as in 124.
- **Reduced motion:** under `prefers-reduced-motion` the peephole holds still
  at the centre instead of drifting.

**Fixed strengths (no sliders):**

| Style | Strength |
|---|---|
| Blur | `blur(28px)`, scaled 1.15 so the soft edges stay out of frame |
| Pixelate | a block size of about 1/20 of the drawn width (minimum 12px) |
| Peephole | radius 14% of the frame's shorter side, drifting on a slow Lissajous path that stays inside the frame |

## In scope

- `Card.audioFirstStyle`: text, not null, default `"blind"`, migration
  `0045`. It goes on `CardWithDetails` and every client copy.
- `POST /api/cards/audio-first` takes an optional `style`. Leaving it out keeps
  the stored style. Unmarking a card leaves its stored style alone.
- `StudyMediaPlayer` takes an `obscure` prop (`"blur" | "pixelate" |
  "peephole" | null`), plus a new `StudyPixelCanvas.vue`.
- Study wiring.
- A style picker shown while a card is marked, in:
  - Study's Edit card panel
  - the `/cards` inspector (also on `/decks`)
  - `CardPreviewModal`'s edit mode (Listen's edit modal)
- A style select beside the `/cards` bulk bar's Audio first button.
- The badge names a non-Blind style, for example "Audio first · Blur".

## Out of scope

- Listen playback. Listen ignores the style and keeps 124's Blind veil, and
  the Mix dissolve is untouched.
- Preview playback and Party.
- Adjustable strength per card or per style.
- Blind as one of Random's choices.
- A style filter on `/cards`.
- Any change to scheduling, `ReviewLog`, `CardTrack`, the status chip, or the
  session Hide Video default.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Column, card shape, and route.**
  - Schema: add `audioFirstStyle` to `server/db/schema.ts` (`audio_first_style`,
    text, not null, default `'blind'`). Generate the migration with
    `bun run db:generate`.
  - Server shape: add `audioFirstStyle` to `CardWithDetails` and the card
    selection in `server/utils/cards.ts`, right after `audioFirst`.
  - `server/utils/cardAudioFirst.ts`:
    - Export `AUDIO_FIRST_STYLES` and the `AudioFirstStyle` type.
    - `parseAudioFirstBody` accepts an optional `style`. An unknown style, or a
      `style` sent with `audioFirst: false`, is a `400`.
    - `setCardsAudioFirst` sets the style only when one is given.
  - Extend `cardAudioFirst.test.ts` to cover:
    - each valid style
    - an unknown style
    - a style with `audioFirst: false`
    - style omitted keeps the stored value
    - unmarking keeps the stored style
  - *Done when:*
    - The migration applies on boot.
    - `GET /api/cards` rows carry `audioFirstStyle: "blind"`.
    - A POST with `style: "pixelate"` persists it.
    - A bad style gets a `400`.
    - `bun run test` and `bun run build` are green.
- [x] **Step 2 - Style resolution helpers.**
  - Add to `app/utils/audioFirst.ts`:
    - the client `AudioFirstStyle` type and `AUDIO_FIRST_STYLE_OPTIONS`
      (value and label pairs, in the order Blind, Blur, Pixelate, Peephole,
      Random)
    - `resolveAudioFirstStyle(style, seed)`, which returns
      `"blind" | "blur" | "pixelate" | "peephole"`. It is deterministic in
      `seed`, and Random never returns Blind.
    - `audioFirstObscure({ hidden, forcedBlind, treatment })` (treatment is the resolved style), which returns the
      player's `obscure` value or `null`, following the table above
    - `peepholeCenter(seconds, seed)`, which returns a centre as percentages
      inside the frame
  - Tests in `audioFirst.test.ts`:
    - Each fixed style resolves to itself.
    - Random reaches all three styles across seeds and never Blind.
    - The same seed gives the same result.
    - `audioFirstObscure` follows each row of the table.
    - `peepholeCenter` stays within bounds.
  - *Done when:* `bun run test` is green. Nothing visible changes yet.
- [x] **Step 3 - Player treatments, wired into Study.**
  - `StudyMediaPlayer` gets an `obscure` prop:
    - **blur:** a class on the `<video>` that applies the filter and scale
      (the frame already clips).
    - **pixelate:** the `<video>` is kept decoding at `opacity: 0`, and
      `StudyPixelCanvas.vue` draws it. This is a Study-owned copy of the party
      technique, since 123a will delete the party one.
    - **peephole:** a `clip-path: circle(...)` on the `<video>`, driven by
      `peepholeCenter` on `requestAnimationFrame`, and still under reduced
      motion.
    - `ambientActive` is false while `obscure` is set.
  - `useStudySession.ts`'s card type gains `audioFirstStyle`.
  - In `pages/study/index.vue`:
    - Compute the resolved style per showing.
    - Pass `obscure` to the player.
    - Drop `audioFirstHidden` from the player's `hide-video` expression when a
      non-Blind style is applied.
    - Leave the Video toggle's `:hide-video` as is.
  - *Done when:* a card set to each style by a direct POST shows that treatment
    on `/study`:
    - Blind looks exactly as in 124.
    - `V`, the typed result, and an `I` reveal each show the clear picture.
    - Session Hide Video on shows Blind.
    - Pause keeps the treatment.
    - The ambient glow is off while treated.
    - Random changes between repeat showings.
    - The same card on `/listen` still shows the Blind veil.
    - Browser screenshots of all three treatments.
- [x] **Step 4 - Pick the style, and the badge.**
  - `CardAudioFirstBadge` takes an optional `hideStyle` (`style` is reserved in Vue) and reads "Audio first ·
    Blur" and so on, with Blind reading plain "Audio first".
  - Study's Edit card panel, the `/cards` inspector, and `CardPreviewModal`'s
    edit mode show a style `<select>` while the card is marked:
    - Changing it POSTs `{ ids: [id], audioFirst: true, style }` and emits
      `updated`.
    - Marking a card keeps its stored style.
  - The `/cards` bulk bar gets a style select (default Blind) used by "Audio
    first", sent through `applyAudioFirst`.
  - Add `audioFirstStyle` to the remaining client copies:
    - `CardInspector.vue`
    - `CardTable.vue`
    - `pages/cards/index.vue`
    - `pages/decks/index.vue`
    - `StudyCardEditPanel.vue`
    - `CardPreviewModal.vue`
  - *Done when:*
    - The style can be set from each of the three surfaces and from the bulk
      bar, and persists across a reload.
    - A style change made in Study's panel applies to the card on screen.
    - The badge shows the style on `/cards` rows, `/decks` rows, and the
      inspector.
    - `bun run test` and `bun run build` are green.

## Files / areas

- `server/db/schema.ts`, `server/db/migrations/0045_*`
- `server/utils/cards.ts`, `server/utils/cardAudioFirst.ts` (+ test)
- `server/api/cards/audio-first.post.ts` (unchanged unless the parse result's
  shape needs it)
- `app/utils/audioFirst.ts` (+ test)
- `app/components/study/StudyMediaPlayer.vue`
- `app/components/study/StudyPixelCanvas.vue` (new)
- `app/pages/study/index.vue`
- `app/composables/useStudySession.ts`
- `app/components/study/StudyCardEditPanel.vue`
- `app/components/card/CardInspector.vue`
- `app/components/card/CardPreviewModal.vue`
- `app/components/card/CardTable.vue`
- `app/components/card/CardAudioFirstBadge.vue`
- `app/pages/cards/index.vue`, `app/pages/decks/index.vue`

## Data / contracts

Load-bearing:

- `Card.audioFirstStyle: "blind" | "blur" | "pixelate" | "peephole" |
  "random"` (`card.audio_first_style`, default `'blind'`). It sits on
  `CardWithDetails` right after `audioFirst`, in every copy.
- `POST /api/cards/audio-first` body: `{ ids: number[] (1-500), audioFirst:
  boolean, style?: AudioFirstStyle }`. `style` is allowed only with
  `audioFirst: true`. Response unchanged: `{ updated, notFound }`.
- `StudyMediaPlayer` prop `obscure?: "blur" | "pixelate" | "peephole" | null`.
  It only treats the picture: it never hides the controls, the cover art, or
  an audio-only card.

## Testing

Vitest is configured, so the logic gate is on.

- Step 1: `cardAudioFirst.test.ts` covers the body parsing and the style
  update.
- Step 2: `audioFirst.test.ts` covers style resolution, the obscure decision,
  and the peephole bounds.
- Steps 3 and 4 are UI. They ride on browser evidence (playwright-cli
  screenshots of each treatment and of each picker) plus `bun run build`.
- Leave the Typed Answers plus Auto Reveal combinations to the user's manual
  check if they can't be driven headless, as 124 did.

## Notes for the AI

- Keep 124's `audioFirstVeiled` rule and the `V` handling untouched. This
  feature only maps "hidden" to a treatment.
- Party's `PartyPixelCanvas` and `PartyDisplayPlayer` peek are reference
  techniques only. Do not import them into Study, since 123a deletes them.
- Drawing a cross-origin video to a canvas taints it. That is fine for
  display. Never call `getImageData` on the pixelate canvas.
- The player remounts per `presentationKey`, so the per-showing Random pick
  can be a computed value from the seed. No extra reset watcher is needed.
- Listen must keep passing no `obscure`. Verify `/listen` is unchanged in
  step 3.
- Colours and sizes go through `main.css` tokens where they are colours. The
  fixed strengths above are layout constants, fine as named constants.
- No em dashes in code comments or docs.

## Review fix (2026-11-17)

Found at merge review: Study's Edit card panel closed after Audio first was
toggled (124's rule, since the open form disables Missed and Got it), so the
style picker that appears with the mark could not be reached. Marking now keeps
the form open; unmarking closes it as before unless it holds unsaved edits.
Checked in the browser: after marking, the form stays open with the picker on
Blind.
