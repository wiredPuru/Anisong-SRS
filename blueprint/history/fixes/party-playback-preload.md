# Current Feature

## Party playback: preload, seamless play/pause, downloaded-only queues

**Type:** Fix

**Status:** verified

## The problem

Party mode (feature 86) feels slow between songs, and play/pause does not feel
immediate. Measured on the live party server, 2026-09-26:

- **The server is not the bottleneck.** A 38MB local clip streams through the
  display door (`:4000` -> `:4002`) in 42ms, and the first MB arrives in 2ms.
- **The display loads each song from scratch.** `PartyDisplayPlayer.vue` has
  one `<video>` whose `src` changes with the token. Every Next makes the
  browser fetch, parse, seek to the random start, and buffer a new file before
  anything plays. The display is never told what comes next, so it cannot
  preload.
- **Every new song starts paused.** `atItem` (`server/utils/partyGame.ts`) sets
  `playing: false`, so each song needs Next, then Play: two round trips.
- **Play/Pause shows the server's intent, not what the screen is doing.**
  `PartyNowPlaying.vue` and the Space hotkey flip on `state.playing`. The label
  changes only after the POST and SSE round trip, and it reads "Pause" while
  the display is still buffering and nothing is audible.
- **Remote clips block until fully cached.** `/api/party/display/clip` awaits
  `resolveCachedPath`, which downloads the whole remote file before sending a
  byte. `prefetchAround` covers the current song and the next two, so this only
  bites when the host skips ahead quickly. 30 of the 229 cards in the dev
  library have no local file.

## The fix

1. **Downloaded-only toggle** (user's choice: filter, not bulk download). A
   "Downloaded clips only" checkbox in the queue builder, beside Shuffle.
   - `parsePartySource` takes an optional `downloadedOnly` boolean.
     `listPartyCardIds` adds `localVideoPath IS NOT NULL OR localAudioPath IS
     NOT NULL`, so the preview count is right.
   - The `load` command carries the same flag. With it on, `resolveQueue` drops
     any card whose picked clip is remote. That covers a stale local path that
     would fall back to the stream, and Audio only mode on a card that has only
     a local video. The existing `skipped` count reports them.
2. **Keep playing across moves** (user's choice). `atItem` keeps `playing: true`
   when the previous song was playing, for Next, Previous, and Jump. A paused
   game stays paused. `load` and `clear` still start paused. Lightning already
   plays after its own `next`, so it is unchanged.
3. **Display preloads the next songs.** The display view gains `upcoming:
   string[]`, the tokens for the next two queue items. It carries tokens only:
   no kind, no answer, no URL, so nothing about a song reaches the screen
   before its turn. Two songs matches `PREFETCH_AHEAD`, so the server is
   already caching those remote clips.
   - `PartyDisplayPlayer` keeps one `<video preload="auto">` per token in
     `[current, ...upcoming]`, keyed by token. Only the current one is
     visible, unmuted, and playing. The others are paused, muted, hidden, and
     buffering.
   - On a move, the next element is already loaded. It seeks to the new song's
     start and plays, with no fresh load.
   - Effects, the pixel canvas, and position reports always target the current
     element.
4. **Honest, instant Play/Pause on the host.**
   - The button and the Space hotkey flip their label optimistically on click,
     then settle to the server state.
   - A "Loading..." chip shows while `state.playing` is true but the display's
     latest report for the current token says it is not playing. It uses the
     existing position report, with no new field.
   - The Kai veil on the display reads "Loading..." rather than "Listen
     closely!" until the element fires `playing`.

**Must not break:**

- The display never learns an answer, a path, or a URL before the reveal. New
  fields are opaque tokens only.
- Random start, seek, reveal, effects, blur/pixelate decay (measured from each
  song's own start), lightning timing, and lobby music all behave as before.
- Party play still never writes `ReviewLog`, `Card`, or `CardTrack`.
- The stream cache's size cap still holds. Preloading adds at most two songs,
  and the server already prefetches both.

## Build steps

- [x] **1. Downloaded-only queues.** Flag through `parsePartySource`,
  `listPartyCardIds`, the `load` command, and `resolveQueue`, plus the
  checkbox in `PartyQueueBuilder.vue`. Tests in `partySources.test.ts` and
  `partyGame.test.ts` (or a store-level test) cover: the flag parses, remote
  clips are dropped, and a stale local path counts as not downloaded.
  **Done when:** with the toggle on, the preview count drops to cards with a
  local file, and a loaded game's queue has no remote clip.
- [x] **2. Keep playing across moves.** `atItem` carries `playing` for
  next/previous/jump. Tests in `partyGame.test.ts`: playing stays playing,
  paused stays paused, load and clear start paused. **Done when:** pressing
  Next during a song goes straight into the next one.
- [x] **3. Display preloading.** `upcoming` tokens in `toDisplayState` (a test
  asserts it holds tokens only and is empty at the queue's end), the client
  type copy in `usePartyDisplay.ts`, and the per-token element pool in
  `PartyDisplayPlayer.vue`. **Done when:** in the browser, Next starts the new
  song audibly within a few hundred ms, measured from the `playing` event,
  where today it reloads from scratch.
- [x] **4. Host Play/Pause feedback.** An optimistic label in
  `PartyNowPlaying.vue` and `usePartyHotkeys.ts`, the Loading chip, and the
  display veil text. **Done when:** the button flips on tap, and the Loading
  chip shows only while the screen is actually buffering.

## Verify

- `bun run test` and `bun run build` pass.
- Restart party mode from the new build (`bun run party`, with
  `GAQ_SRS_DATA_DIR` pointing at `.data` to use the dev library). Then:
  - Load a shuffled queue with "Downloaded clips only" on. The count matches
    the cards with local files, and no song shows a loading delay.
  - Load the same queue with it off, press Play, then press Next repeatedly.
    Each song starts on its own, with no second Play. A remote song may show
    the Loading chip briefly, but only on the first uncached one.
  - Pause and resume from the phone. The button flips immediately, and the
    display follows within a beat.
  - While guessing, `upcoming` in the display SSE (`curl -N
    http://127.0.0.1:4000/api/party/display/stream`) shows bare tokens only.

## Outcome

Built and verified 2026-09-26. `bun run test` (1437 passed) and `bun run build`
passed. Measured in headless Chrome against an isolated party instance:

| Case | Time to `playing` after the state arrives |
|---|---|
| Next onto a preloaded local song | 1ms |
| Previous onto a song that was not preloaded | 17ms |
| Next onto a preloaded remote song | 13-33ms |
| Rapid skip past the preload window, cold remote clip | ~0.8-2.5s, shown as "Loading..." |

Changes beyond the spec's wording:

- The display's position report now counts a song as playing only once it is
  audible (`playing` event, cleared on `waiting` or `pause`), not when `play()`
  was requested. Lightning rounds, which step on that report, now count only
  audible time.
- `.party-veil` is a centring flex box, so the in-flow loading Kai sits in the
  middle of the screen; the other moods stay absolutely positioned.

Testing note: macOS AirPlay Receiver listens on port 5000, so a test party
instance there can get a 403 from the browser. Use other ports (5100-5102 were
fine).
