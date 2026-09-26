# Feature: Study player

**From build-plan:** feature 84c (parent 84, Kai mascot overhaul)
**Status:** verified

## Goal

Make the player (`StudyMediaPlayer`, shared by `/study` and Preview) look like
it belongs on Kai's sticker sheet, and let Kai tell the user what the player
is doing: "Ready?" before a clip starts, peeking over a loading bar while it
buffers, bopping along while an audio-only clip plays, and slumped when a clip
fails. Playback behaviour does not change.

## Design reference

- `blueprint/reference/mascot-v2/kai-sheet-transparent.png`: the player icon
  row (pink note, play, pause, skip, speaker, blue waveform), the "Ready ?"
  speech box with Kai resting her chin on it, the loading bar with Kai peeking
  over it and spaced "LOADING..." lettering, and the soft-outlined pill
  banners.
- Tokens from 84b (`--outline`, `--star`, `--note`), poses from 84a.

## In scope

- **`StudyPlayerKai.vue`** - Kai plus a speech box, one `mood` prop:
  `ready` (pose `ready`), `paused` (`shy`), `listening` (`clap`, with
  floating music notes), `loading` (`peek` over an indeterminate pill bar,
  message in the default slot), `error` (`slump`). Sized in `cqw` against
  `.player-frame` so it scales with Preview's expanded mode. Decorative:
  `alt=""`; the message stays real text.
- **Veil states in `StudyMediaPlayer`**: the plain "Paused" / "Listening..."
  text and the equalizer icon are replaced by `StudyPlayerKai`. "Ready?" shows
  until the clip first plays (a `hasStarted` flag reset on each new load, set
  on `playing`), "Paused" after that. The loading message and the error veil
  get the `loading` and `error` moods; their existing text, retry, and
  download actions are unchanged. Cover-art cards and `hideListeningLabel`
  keep showing no mascot, as they show no text today.
- **Chrome**: the player card and frame take a 2px `--outline` border and a
  larger radius, with a star and a music note sticker on the card's corners
  (hidden when expanded). The controls become a floating outlined pill inside
  the frame's bottom edge instead of a dark gradient; play/pause and the
  speaker become inline SVG icons instead of emoji glyphs; the scrub bar is an
  outlined pink pill with a pink gradient fill; the theme-slot badge is an
  outlined sticker pill.
- All animation (notes, loading stripe) stops under
  `prefers-reduced-motion`.

## Out of scope

- The answer controls, result panel, and info panel (84d, 84e).
- Any playback logic: autoplay, buffering detection, retries, downloads, and
  the auto-reveal timer are untouched.

## Build steps

- [x] **Step 1 - `StudyPlayerKai` + veil states** - *Done when:* on `/study`
  with Hide Video on, a playing audio veil shows Kai clapping with
  "Listening..."; pausing mid-clip shows "Paused"; a fresh card before play
  shows "Ready?"; screenshots in both themes; `bun run build` passes.
- [x] **Step 2 - Player chrome** - *Done when:* screenshots of `/study` (video
  card and cover-art card) in both themes show the outlined card, the floating
  control pill with SVG icons, and the sticker badge; Preview's expanded mode
  still fits its controls inside the frame (`bun run measure`); `bun run
  build` and `bun run test` pass.

## Testing

Presentation only: a pose lookup and a boolean flag with no branching logic
worth a unit test. Evidence is screenshots in both themes, a measure of
Preview's expanded frame, and the build.

## Evidence

- `bun run test`: 82 files, 1289 tests passed. `bun run build` passed.
- `/study` (production build, `playwright-cli`): a fresh card read
  `mood-ready | Ready?`; with Hide Video on and `s` pressed,
  `mood-listening | Listening...`; `s` again, `mood-paused | Paused`.
  Screenshots in light (video card playing, control pill over the frame) and
  dark (Hide Video, Kai clapping with notes) reviewed.
- The ready pose's right edge is where the sheet cut her off at its speech
  box, so as built that mood drops the tail and sits the box flush against her.
- `/cards` inspector player expanded (the same `allow-expand` mechanism
  Preview uses): control pill inside the frame at 1400x900 (frame 150-1332 x
  117-783, controls 161-1321 x 718-771) and 900x600 (frame 125-857 x 94-506,
  controls 135-847 x 453-496).
- The expand button also took the outlined sticker style, which the spec did
  not list; same component, same look.
