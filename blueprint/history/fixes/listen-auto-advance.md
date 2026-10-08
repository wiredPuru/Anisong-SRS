# Listen: advance when a song ends, and a play length per song

**Type:** Fix
**Status:** verified

## The problem

In `/listen` a song that finishes just sits there: `StudyMediaPlayer` emits no
event when its clip ends, so even with Autoplay on (the `autoplay-next-song`
fix) the user has to press Next. For a hosted listening session the playlist
should run by itself.

Also wanted: a setting for how much of each song to hear before moving on, so
a session can play, say, 30 seconds of every song instead of the whole thing.

## The fix

Both behaviours are **auto-advance, gated by the existing Autoplay toggle**
(`useAutoplayNext`): with Autoplay on, `/listen` moves to the next song by
itself; with it off, nothing advances on its own and the player behaves as
today. `/study` is untouched.

- **Song ended:** `StudyMediaPlayer.vue` emits a new `playback-ended` event from
  the `ended` event of its `<video>` and `<audio>` elements. `/listen` calls
  `next()` on it when Autoplay is on. On the last song `next()` already lands
  on "Playlist finished" with Play again, which is the right stop.
- **Play length:** a new `Play` select in `/listen`'s header-right (beside
  Shuffle), options **Full song** (default), 10s, 15s, 20s, 30s, 45s, 60s, 90s,
  2 min. Saved in `localStorage` (`gaqSrs:listenPlayLength`, try/catch like
  the other stored settings), stored as seconds with `0` meaning full song;
  anything unparseable reads as full song.
  - Counted in **played time**, not wall-clock: the countdown starts on
    `playback-started`, pauses on `playback-paused` and resumes where it left
    off, and resets on every new song (`presentationKey`). With Random start
    on it counts from the random start point, so "30s" is always 30s heard.
  - When it runs out, `/listen` calls `next()`. A clip shorter than the limit
    simply ends first and advances through the song-ended path.
  - **Random start must leave room for the play length.** Today
    `randomStartTime` in `StudyMediaPlayer.vue` only keeps clear of the last
    fixed 15 seconds, so a 30s play length could start 5s from the end and
    play 5s. `/listen` passes the length to the player as a new optional
    `playLength` prop (seconds, `0`/absent = unchanged behaviour), and the
    start is picked from `0` to `duration - max(15, playLength)`, so the full
    length (and at least the existing 15s) is always available to hear. When
    the 15s margin does not fit but the length does, the start leaves exactly
    the length (a 14s clip with a 10s length starts in 0 to 4s); a clip no
    longer than the length starts at `0`. Today's "anywhere in the clip"
    fallback could land on the last second. The calculation moves into a pure `randomStartTime(duration,
    playLength, random)` in `app/utils/randomStart.ts`, tested at the edges;
    with no play length it returns exactly what it does today, so `/study` and
    Preview are unchanged. The prop is read when the clip's metadata loads, so
    changing the length mid-song applies from the next song.
  - Select is disabled with a tooltip ("Needs Autoplay on") while Autoplay is
    off, rather than silently doing nothing.
- **One advance per song:** the limit timer and the `ended` event can both fire
  for the same song; a small guard on `presentationKey` makes the second a
  no-op so a song is never skipped.
- **Pure logic** in `app/utils/listenPlayLength.ts` (`PLAY_LENGTH_OPTIONS`,
  `parsePlayLength`, `formatPlayLength`) with a test; the pause-aware countdown
  is a small composable `useListenPlayLimit` modelled on `useListenAutoReveal`
  (kept separate, as that one is deliberately separate from Study's timer).

Must not break: manual Next/Previous and the arrow keys, Autoplay off, Auto
Reveal (its own timer is independent and unchanged), Random start, the
download-then-play path, error state with its "Next song" action (an errored
clip never emits `ended`, so it does not skip), and `/study` and
`CardPreviewModal`, which ignore the new event.

Known interaction, left as is: a play length shorter than the Auto Reveal
seconds moves on before the reveal fires. Both are the user's own settings.

## Build steps

- [x] **1. Ended event + advance on song end.** `playback-ended` emit in
  `StudyMediaPlayer.vue`; `/listen` advances on it when Autoplay is on, with
  the one-advance-per-song guard. *Done when:* with Autoplay on, a short clip
  playing to its end moves `/listen` to the next song with no click, the last
  song lands on "Playlist finished", and with Autoplay off it stays put.
- [x] **2. Play length setting.** `listenPlayLength.ts` + test,
  `useListenPlayLimit`, the header select, persistence. *Done when:* with
  Autoplay on and Play set to 10s, each song moves on after 10s of actual
  playing (pausing holds the countdown), the choice survives a reload, Full
  song restores today's behaviour, and the select is disabled with Autoplay off.
- [x] **3. Random start respects the play length.** `randomStart.ts` + test,
  `playLength` prop on `StudyMediaPlayer.vue` used by both of its
  `randomStartTime` call sites, passed from `/listen`. *Done when:* with Random
  start on and Play at 30s, no song ever starts within 30s of its end (clips
  longer than that), a clip shorter than the length starts at 0, and with no
  play length `/study` picks starts exactly as before.

## Verify

1. `bun run test` passes including the new helper test; `bun run build` is clean.
2. `/listen` with Autoplay on and Full song: let a clip end, the next song
   starts by itself; let the last one end, "Playlist finished" shows.
3. Set Play to 10s: songs advance at about 10s of playback; pause at 5s, wait,
   resume, it advances 5s later. With Random start on and Play at 30s, over
   several songs each one plays a full 30s (none starts in its last 30s) before
   advancing; the scrub bar's start position plus 30s never passes the duration.
4. Press Next manually around the limit: exactly one song is skipped each time.
5. Autoplay off: nothing advances, the Play select is disabled; reload keeps the
   chosen length.
6. `/study` still behaves as before (no auto-advance).
