# Fix: Card download progress bar + live edit-form refresh

**Type:** Fix
**Status:** verified
**Fixes:** F-01, F-02

## The problem

Two issues in the card-download flow (`/cards`, `/cards/new`,
`/api/cards/download`), both raised after feature 8 shipped:

1. **No download progress.** `POST /api/cards/download` blocks until the
   whole file is downloaded, buffering it fully in memory
   (`response.arrayBuffer()`) before writing to disk, then returns one JSON
   response. The client just shows a static "Downloading..." label the
   whole time - no percentage, no sense of how big the file is or how far
   along it is. This is also findings ledger entry **F-01** (P2, from
   `/audit`): the in-memory buffering has no size cap and already handled a
   real 47MB file this way during feature 8's testing.
2. **Edit form goes stale after a download.** In `cards/index.vue`, editing
   a card snapshots its `localVideoPath`/`localAudioPath` into two local
   refs (`editVideoPath`, `editAudioPath`) only once, when you click Edit.
   If you then trigger a download for that same card while the edit form is
   still open, the download succeeds and the underlying card list refreshes
   (badges update correctly), but the edit form's text inputs keep showing
   their old (usually empty) values - confirmed by reading the code, not
   guessed: `startEdit()` is the only place those refs are ever set, and
   nothing re-syncs them afterward. You have to close and reopen Edit to
   see the real path. This is also findings ledger entry **F-02** (P2, from
   `/audit`): the download state/logic (`downloadKey`, `canDownload`,
   `hasAnyDownloadableSource`, `downloadMedia`, and the reactive state
   backing them) is duplicated near-verbatim between `cards/index.vue` and
   `cards/new.vue`.

## The fix

**Progress (server):** rework `downloadMediaFile` in
`server/utils/mediaDownload.ts` into an async generator that streams the
download to disk chunk-by-chunk (via the fetch response's
`body.getReader()`, writing each chunk immediately instead of buffering the
whole thing) and yields a JSON progress line after every chunk. This
directly fixes F-01 as a side effect - no more full in-memory buffering.
`server/api/cards/download.post.ts` keeps all its existing upfront
validation (card exists, source present, not already local, default folder
configured) as normal `createError` responses, then switches to a streamed
`application/x-ndjson` response (`sendStream(event,
Readable.from(theGenerator()))`) once the actual download starts. Each
line is one JSON object: `{"type":"progress","loaded":N,"total":N}`,
ending with either `{"type":"done","card":{...}}` or
`{"type":"error","message":"..."}`. `total` is read from the source
response's `Content-Length` header (confirmed present on real
animethemes.moe responses); if it's ever missing, `total` is `0` and the
client shows loaded bytes without a percentage instead of dividing by
zero.

**Progress (client) + duplication (F-02):** extract a new
`nuxt-app/app/composables/useCardDownloads.ts` owning `downloading`,
`downloadProgress` (`{ loaded, total }` per key), `downloadError`,
`downloadKey`, `canDownload`, `hasAnyDownloadableSource`, and a
`downloadMedia(key, cardId, kind)` that does the `fetch` + reads the
ndjson stream line-by-line (`response.body.getReader()` + a
`TextDecoder`), updating `downloadProgress` as lines arrive and resolving
with the updated card object (or `null`, with `downloadError[key]` set) at
the end. `key` is separate from `cardId` because the two pages index
error/downloading state differently today (`cards/index.vue` by card id,
`cards/new.vue` by song id) - the composable doesn't force that to change.
Both pages switch to this composable instead of their own copies, which is
what actually resolves F-02 (not just the progress-bar addition riding
along). Each page then renders a thin progress bar (fill percentage from
`downloadProgress`) in place of the static "Downloading..." button label
while a download is in flight.

**Edit-form refresh:** in `cards/index.vue`, after a successful download,
if `editingId.value` matches the card that was just downloaded for,
re-assign `editVideoPath`/`editAudioPath` from the returned updated card
(the same object `useCardDownloads`'s `downloadMedia` resolves with) so
the open edit form reflects the new path immediately, no re-opening Edit
required.

Must not break: the existing refuse-if-already-local / refuse-if-no-source
/ refuse-if-no-default-folder validation, the timeout/cleanup-on-failure
behavior, or `/cards/new`'s "Added" card state.

## Build steps

- [x] **Step 1 - Streaming download with progress (server)** - rework
  `downloadMediaFile` into a chunked, progress-yielding async generator;
  update `cards/download.post.ts` to stream an ndjson response once
  validation passes. *Done when:* `curl -N` (no-buffer) against
  `/api/cards/download` with a valid `cardId`/`kind` for a real
  animethemes.moe source prints a stream of growing `loaded` values
  followed by a final `done` line with the updated card, matching the
  actual file that lands on disk; a broken/unreachable source URL still
  ends in an `error` line with no partial file left behind (same as
  before); the upfront validation errors (missing card, already local, no
  default folder) are still plain non-streamed error responses.
- [x] **Step 2 - `useCardDownloads` composable** - extract the composable
  described above; switch `cards/index.vue` and `cards/new.vue` to use it,
  removing their duplicated versions of the same state/functions. No
  visual progress bar yet - `downloading[...]` still just drives a
  "Downloading..." label, now sourced from the shared composable. *Done
  when:* both pages still download correctly end-to-end (confirmed in the
  browser) with identical behavior to before, and
  `downloadKey`/`canDownload`/`hasAnyDownloadableSource`/`downloadMedia`
  exist in exactly one place.
- [x] **Step 3 - Progress bar UI** - replace the static "Downloading..."
  label on both pages with a thin fill-percentage progress bar driven by
  `downloadProgress[key]`, falling back to a loaded-bytes label (no
  percentage) when `total` is `0`. *Done when:* watching a real download in
  the browser shows the bar actually filling as bytes arrive, not just
  jumping from empty to done.
- [x] **Step 4 - Live edit-form refresh** - in `cards/index.vue`, resync
  `editVideoPath`/`editAudioPath` after a download completes for the
  currently-edited card, per **The fix** above. *Done when:* open Edit on a
  card with a remote-only source, trigger a download for it without
  closing the edit form, and confirm the local-path input updates to the
  new path on its own - no closing/reopening Edit required.

## Verify

- `bun run build` clean after every step.
- Step 1: `curl -N` streaming check against a real animethemes.moe source
  (this sandbox has confirmed network access to it), plus a broken-URL
  check for the error path.
- Steps 2-4: browser click-through - no Playwright in this project (per
  `coding-standards.md`, not added silently here), so each needs your
  confirmation in a real browser, same as every other UI step this
  session.
- No test runner configured (`AGENTS.md` Commands has no `test` entry).

## Notes for the AI

- `updateCard()` in `server/utils/cards.ts` is unchanged - the generator
  still calls it once, after the file is fully written, exactly as before.
- Keep the ndjson framing dead simple: one JSON object per line, not SSE
  (`text/event-stream`) - this is a POST with a body, which `EventSource`
  can't do, and a plain streamed `fetch` response is simpler here than
  wiring up SSE semantics for no benefit.
- The composable's `key` vs `cardId` split matters - don't collapse them
  just because `cards/index.vue` happens to use the same value for both;
  `cards/new.vue` genuinely needs them separate (song id vs. the card id
  that only exists after adding).
- Mark F-01 and F-02 `fixed` (not `closed`) in `blueprint/context/findings.md`
  when Steps 1 and 2 land, per the normal `/implement` convention - a
  later `/audit` re-review is what moves them to `closed`.
