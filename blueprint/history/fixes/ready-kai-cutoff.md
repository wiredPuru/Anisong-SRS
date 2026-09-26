# Fix: Kai's "Ready?" pose is visibly cut off

**Type:** Fix
**Status:** verified
**Branch:** `fix/ready-kai-cutoff`

## The problem

Before a clip first plays, `StudyMediaPlayer`'s veil shows
`StudyPlayerKai` in the `ready` mood: Kai beside a "Ready?" speech box. The
`ready` pose (`public/mascot/kai-ready.webp`, 190x205) ends in a hard vertical
edge down its right side, which slices through her face, her right twintail,
and her arms (see the user's screenshot).

The cut is baked into the artwork, not the CSS. On the source sheet
(`blueprint/reference/mascot-v2/kai-sheet-transparent.png`, crop
`430,800,622,1024` per the 84a archive), this pose leans behind the sheet's
own "Ready ?" box, which covers her right side and the cat. There are no
hidden pixels to recover by re-cropping. 84c tried to hide the edge by
putting the speech box flush against it (the `.mood-ready` rules), but the
box is shorter than the image, so the cut still shows above and below it.

## The fix

Show a complete pose for the ready mood instead: `wave` (Kai waving, winking,
fully drawn). Map `ready: "wave"` in `StudyPlayerKai.vue`'s `POSES`, and delete
the `.mood-ready` CSS overrides, so the ready bubble uses the same tail
speech box as the other moods ("Guess?", paused).

Must not break:
- The other moods' poses and layout.
- Preview's expanded mode, where Kai scales with the frame in `cqw`.
- The `hasStarted` logic that picks ready vs paused.

Left alone:
- `kai-ready.webp` and the `ready` value of `KaiPose` stay in place. Nothing
  else uses them after this, but deleting a file needs your say-so.
  Removing both is a one-line follow-up if you want it.
- `wave` also appears as `MascotKai`'s default companion pose on Home. That's
  a different screen, so reusing it here isn't a clash.

## Build steps

- [x] **Step 1 - Swap the ready pose** - make the `POSES` change and delete
  the `.mood-ready` rules in `StudyPlayerKai.vue`. *Done when:* a screenshot
  of `/study` before playback shows the whole of Kai (no hard edge) with the
  "Ready?" bubble and its tail pointing at her, at both normal size and in
  Preview's expanded mode. Build and tests pass.

## Verify

1. Open `/study` with at least one due card. Before pressing play, Kai
   waves beside a "Ready?" bubble, with no part of her cut off.
2. Press play, then pause. The paused veil still shows the `shy` pose.
3. Open a card's Preview from `/cards`, expand it, and check that the ready
   veil scales up cleanly.

## Completion evidence

- `bun run test`: 83 files, 1321 tests passing. `bun run build`: passing.
- Dev server screenshots: `/study` before playback shows the full `wave` pose
  (`/mascot/kai-wave.webp`) beside a tailed "Ready?" bubble; a `/cards` card's
  player expanded shows the same veil scaled up cleanly.
