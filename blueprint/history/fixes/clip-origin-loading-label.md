# Fix: Say where a loading clip is coming from

**Type:** Fix
**Status:** verified

## The problem

While a clip buffers, the player veil only says "Loading video..." (or
"Loading audio...") with a seconds counter, in `StudyMediaPlayer.vue`
(`<ActivityStatus :label="`Loading ${mediaKind}`" .../>`). Since feature 60 a
card's remote clip can come from AnisongDB's AMQ hosts or from
AnimeThemes.moe, and a clip can also be a local file, but nothing on screen
says which. When a load is slow the user cannot tell which provider is the
slow one, or whether Clip source (feature 64) is doing what they set.

## The fix

Name the origin in the loading message, for the clip the player is actually
loading:

- `Loading video from AnisongDB...`
- `Loading video from AnimeThemes.moe...`
- `Loading audio from your library...` (a local file)

How:

- Add a pure helper to `app/utils/clipSource.ts`, next to the existing host
  map so the two can never disagree: `clipOrigin(localPath, remoteUrl)` returns
  `"library"` when a local path is the source, otherwise `"anisongdb"` or
  `"animethemes"` from the remote URL's host (the same `PROVIDER_HOSTS`
  domains), and `null` for no source or an unknown host. A second small
  function maps an origin to its display name.
- In `StudyMediaPlayer.vue`, compute the origin from the same inputs
  `cardSrc` uses (local path first, else the allowed remote URL, for the
  current `mediaKind`) and put it in the label. With no known origin the label
  stays exactly "Loading video" / "Loading audio".
- The label lives in the shared player, so Study, Listen and Preview all get it.

Must not break:

- `cardSrc`, `loadedSrc`, the stream and cache routes, and playback itself:
  this only changes a label.
- The "Still waiting" line, elapsed timer, Try again and Use audio actions.
- The "Downloading video/audio" label and the error state, which stay as they
  are.
- Offline mode: a local file reads "from your library"; a remote clip offline
  still names its provider.

Out of scope: saying whether the clip is being read from the stream cache
(only the server knows that) and naming the provider on the error state. Both
are small follow-ups if wanted.

## Build steps

- [x] **Step 1 - Origin helper + tests.** Add `clipOrigin` and the display-name
  function to `app/utils/clipSource.ts`, with tests in
  `app/utils/clipSource.test.ts`.
  *Done when:* tests cover a local path winning over a remote URL, AMQ hosts
  (`naedist`/`eudist.animemusicquiz.com`) giving AnisongDB, `v.animethemes.moe`
  and `a.animethemes.moe` giving AnimeThemes.moe, an unknown host, an invalid
  URL, and no source giving null.

- [x] **Step 2 - Show it in the loading message.** Compute the origin in
  `StudyMediaPlayer.vue` and use it in the `ActivityStatus` label.
  *Done when:* `bun run test` and `bun run build` pass, and in `/study` a clip
  that takes over 400ms to buffer reads "Loading video from AnisongDB..." (or
  AnimeThemes.moe, or your library) matching its stored source.

## Verify

1. `cd nuxt-app && bun run test` and `bun run build`.
2. `bun run dev`, open `/study`, and throttle the network in the browser
   devtools so a clip takes a few seconds to load.
3. Study a card whose clip is remote on an AMQ host: the veil says "from
   AnisongDB". Study one whose clip is on animethemes.moe (Clip source set to
   Both or AnimeThemes.moe): it says "from AnimeThemes.moe".
4. Study a card with a downloaded local file: it says "from your library".
5. Open the same card in Listen and in a Preview: same wording.
