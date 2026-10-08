# Autoplay on next song (Listen and Study)

**Type:** Fix
**Status:** verified

## The problem

Moving to the next song in Listen (`/listen`) or Study (`/study`) mounts a fresh
`StudyMediaPlayer` (`:key="presentationKey"`) that sits on the "Ready?" veil
until Play is pressed (or `S`). For a hosted listening session or a run of
reviews that is one extra click per song. Wanted: an option that starts each
new song by itself; if the clip is already downloaded it just plays, if it is
not, download it into the library first and then start.

## The fix

A session-wide **Autoplay** toggle, shared by both pages, **on by default**,
remembered in `localStorage` (`gaqSrs:autoplayNext`; nothing stored means on, only an explicit "0" means off; try/catch like the other
stored toggles), so it survives reloads and is the same on both pages.

- **Toggle:** one new "Autoplay" button in `StudyDisplayToggles.vue` (used by
  both pages), `autoplay` prop plus `toggle-autoplay` event, hover tooltip
  "Starts each song by itself. Downloads it first if it is not saved yet."
  The state lives in a small `useAutoplayNext()` composable so Study and
  Listen read and write one value.
- **Player:** `StudyMediaPlayer.vue` gets an `autoplay?: boolean` prop. On mount,
  when set:
  1. `mediaKind` already local (or nothing downloadable, or no default download
     folder configured): `playIfPaused()` straight away.
  2. Otherwise (`canDownload(card, mediaKind)` and `hasDefaultDownloadFolder`):
     `await retryDownload(kind)` (which releases the source pin so the new
     local file is what loads), then `playIfPaused()`. The "Loading" veil shows
     the existing download progress while it runs.
  3. If the download fails, fall back to `playIfPaused()` on the remote stream
     instead of leaving the song dead; the failure still shows through the
     existing `downloadError`.
  Skip the step-2 download when Auto Download (feature 59) is on, since
  `triggerAutoDownload` already runs on mount; wait for that same download
  rather than starting a second one for the same card and kind.
- **Blocked autoplay:** the browser may refuse `play()` with no user gesture
  yet (the very first song after a fresh page load). That `NotAllowedError`
  must leave the "Ready?" veil in place and set no error, rather than the
  "Couldn't play this clip." state `playIfPaused` shows today. Later songs
  are fine, since the Next click/keypress counts as a gesture.
- **Pages:** `listen/index.vue` and `study/index.vue` pass `:autoplay` to the
  player and wire the toggle. Study's Auto Reveal countdown starts from the
  `playing` event, and Typed Answers is unaffected, so both keep working.
  Autoplay does not apply to `CardPreviewModal` (it has no queue).

Must not break: manual play/pause, Audio only, Clip source blocking (a card
with nothing allowed still shows the error state), random start, the
`start-on-mount` path used by `CardInspector`, feature 59's Auto Download, and
SRS scheduling (nothing here touches review state).

## Build steps

- [x] **1. Autoplay in the player.** `autoplay` prop on `StudyMediaPlayer.vue`:
  play-if-local, download-then-play, remote fallback on failure, silent on
  `NotAllowedError`. Pure decision logic (play now vs download first) goes in a
  small tested helper. *Done when:* a Preview-style harness or the pages from
  step 2 show a local clip starting by itself and a remote-only clip
  downloading (card gets a local path) and then starting.
- [x] **2. Toggle on both pages.** `useAutoplayNext`, the button in
  `StudyDisplayToggles.vue`, and `:autoplay` passed from `/listen` and
  `/study`. *Done when:* with the toggle on, pressing Next in Listen and
  answering/passing in Study each start the following song without a click;
  with it off, the "Ready?" veil still waits; the choice survives a reload.

## Verify

1. `bun run test` passes, including the new helper test; `bun run build` is clean.
2. In `/listen` with a deck that has both downloaded and remote-only songs:
   turn Autoplay on, press Next onto a downloaded song (plays at once), then onto
   a remote-only song (progress shows, the card gains a local file in `/cards`,
   then it starts). Repeat with the default download folder unset: it streams
   and starts, no download.
3. In `/study`, with Typed Answers off and on, finish a card and confirm the next
   one starts on its own, and Auto Reveal still counts down from playback start.
4. Reload `/listen` with Autoplay on: the first song stays on "Ready?" with no
   error if the browser blocks it, and the next one autoplays.
5. Toggle Autoplay off: next songs wait on "Ready?" again, and it stays off after a reload. A fresh browser profile (nothing stored) starts with it on.
