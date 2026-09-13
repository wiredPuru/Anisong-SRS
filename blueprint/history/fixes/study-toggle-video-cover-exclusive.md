# Fix: Study display toggles show both "Video" and "Cover" pills at once

**Type:** Fix
**Status:** verified

## The problem

`StudyDisplayToggles.vue`'s segmented control always renders three pills -
Video, Cover, Info - regardless of the current card's actual media kind. Video
and Cover are mutually exclusive by design (`StudyMediaPlayer.vue`'s
`showCoverArt` only ever shows the spinning-record cover art when
`mediaKind === "audio"`, and the `<video>` element only mounts when
`mediaKind === "video"` - a card is always one or the other, never both). But
the toggle strip doesn't know which one currently applies, so it shows both
pills lit "on" side by side at all times, which reads as if both a video and
a cover are showing together - confusing, since only one of the two toggles
ever does anything for the card actually on screen.

`mediaKind` (video-source-present, Playback mode setting, and the per-card
"Use audio for this card" fallback all folding into one value) is currently
computed only inside `StudyMediaPlayer.vue` and never surfaced to
`app/pages/study/index.vue`, which owns the toggle strip.

## The fix

Surface the player's resolved media kind to the page, and let
`StudyDisplayToggles` show only the one pill that applies to the current
card: "Video" when the card is playing as video, "Cover" when it's playing
as audio (and has cover art to show/hide) - never both, matching how
feature 46's Auto Reveal already treats Hide Video/Hide Cover as one shared
"whichever visual applies" slot.

`StudyMediaPlayer.vue` now emits its resolved `mediaKind` via a new
`update:media-kind` event (an immediate `watch` on the existing `mediaKind`
computed, so it fires as soon as the player mounts and on every change
after). `study/index.vue` stores it in a `currentMediaKind` ref and passes
it to `StudyDisplayToggles` as a new `media-kind` prop; the component
renders the "Video" segment button only when `mediaKind === "video"` and
the "Cover" segment button only when `mediaKind === "audio"` - "Info"
always renders. The underlying `hideVideo`/`hideCover` state, hotkeys
(`V`/`C`), and Auto Reveal's forcing behavior are unchanged.
`CardPreviewModal` never had this toggle row and is unaffected.

## Build steps

- [x] `StudyMediaPlayer.vue` emits its resolved `mediaKind` ("video" | "audio")
   whenever it changes, e.g. `emit("update:media-kind", mediaKind.value)`
   via a `watch(mediaKind, ..., { immediate: true })`. `study/index.vue`
   stores it in a ref and passes one new prop, e.g. `:media-kind`, to
   `StudyDisplayToggles`. `StudyDisplayToggles` renders the "Video" segment
   button only when `mediaKind === "video"` and the "Cover" segment button
   only when `mediaKind === "audio"`; "Info" always renders. No change to
   the emitted toggle events, hidden state, or hotkey bindings.

   Done when: on a video-source card, only "Video" + "Info" show in the
   segmented control; on an audio-only (or Audio Only setting-forced, or
   post-"Use audio for this card") card, only "Cover" + "Info" show;
   toggling whichever pill is visible still hides/shows the right thing.

## Verify

- Load `/study` on a normal video card: segmented control shows Video +
  Info only, Video pill lit, hitting `V` still hides the video behind the
  plain veil.
- Force Audio Only (Settings or the session toggle) and advance to the next
  card, or trigger "Use audio for this card" on a broken video: segmented
  control switches to Cover + Info only, Cover pill lit, hitting `C` still
  hides the record/cover art.
- `CardPreviewModal` (`/cards` or `/decks` Preview) is unaffected - it has
  no display-toggle row.

Confirmed via `bun run test` (172/172 passed), `bun run build` (clean), and
browser evidence (`bun run measure` screenshots) on both a video card and
an Audio-Only-forced card: exactly one pill shows each time, matching the
actually-rendered media.
