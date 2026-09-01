# Current Feature

## Title

Escape furigana `v-html` input to close an HTML-injection path

## Type

Fix

## Status

Verified

## Fixes

F-07

## The problem

F-07 flagged that `kuroshiro`'s escaping behavior was unverified. It's now
verified, and the answer is: **`kuroshiro` does not escape at all.** Tested
directly against the installed package:

```
IN:  "<script>alert(1)</script>"
OUT: "<script>alert(1)</script>"      // passed through completely unescaped

IN:  "境界のRINNE & Others"
OUT: "<ruby>境界...</ruby>のRINNE & Others"   // "&" also passed through raw
```

`kuroshiro.convert()` only wraps detected kanji spans in `<ruby>` tags; every
other character (including literal `<`, `>`, `&`) passes straight through
unmodified. `toFuriganaHtml()` (`nuxt-app/server/utils/furigana.ts`) returns
that raw output, `GET /api/furigana` forwards it unchanged, and
`StudyInfoPanel.vue` renders it via `v-html` (`animeJpHtml`/`songJpHtml`,
`nuxt-app/app/components/study/StudyInfoPanel.vue:158,164`) - sourced from
`animeTitleNative`/`songTitleNative`, which come from AniList.

While investigating, a second, more direct instance of the same class of bug
turned up in the same component: `animeJpHtml`/`songJpHtml` are also set
directly to the **raw, un-processed** title text (not run through kuroshiro
at all) in three places, and that raw text still renders through the same
`v-html` span:

- Initial ref value, before any fetch (`StudyInfoPanel.vue:81-82`)
- Whenever the Furigana toggle is off (`:91-93`) - this is a routine, common
  state, not an edge case
- On a failed `/api/furigana` fetch (`:110-112`)

So today, any time Furigana is off (a totally normal toggle state), the raw
AniList title string goes through `v-html` with zero escaping of any kind -
not even kuroshiro's (nonexistent) escaping stands between it and the DOM.

Real-world risk is still low (single-user local app - any injected script
only runs in the user's own browser against their own already-trusted data;
AniList is a reasonably trusted upstream, not arbitrary user input), which is
why this stayed P3. But it's a real, now-confirmed gap worth closing cheaply.

## The fix

Two independent changes, both verified against the installed `kuroshiro`
package before writing this spec:

**1. Escape the input text before it reaches `kuroshiro.convert()`**, in
`toFuriganaHtml()` (`server/utils/furigana.ts`). HTML-escaping the source
text first (`&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`, `"` -> `&quot;`,
`'` -> `&#39;`) and *then* running it through kuroshiro does not break kanji
detection or ruby-tag generation - verified directly:

```
IN:      "<script>alert(1)</script>"
ESCAPED: "&lt;script&gt;alert(1)&lt;/script&gt;"
OUT:     "&lt;script&gt;alert(1)&lt;/script&gt;"   // inert, renders as text

IN:      "鬼滅の刃"
OUT:     "<ruby>鬼<rp>(</rp><rt>おに</rt>...</ruby>..."  // ruby markup intact
```

kuroshiro's analyzer only looks for Japanese-script characters to wrap; the
escaped HTML entities are plain ASCII and pass through as inert text exactly
like the original unescaped characters did, so this closes the gap with no
behavior change for real anime/song titles (which never contain raw `<`/`>`/
`&`/`"`/`'` in practice).

**2. Stop routing raw, non-kuroshiro text through `v-html`** in
`StudyInfoPanel.vue`. Add `animeJpIsHtml = ref(false)` and `songJpIsHtml =
ref(false)`, set `true` only immediately after a successful `/api/furigana`
result is applied (alongside the existing `animeJpHtml.value =
animeResult.html` assignment), and `false` in every other case (initial
value, Furigana-off, fetch error) - matching exactly where `animeJpHtml`/
`songJpHtml` are already being set today, no new branches. In the template,
render `v-html` only when the flag is true; otherwise render the same text
via plain interpolation (auto-escaped by Vue), keeping the identical `class="jp"`
wrapper either way so `.jp`'s existing styling is unaffected:

```html
<span v-if="showJapanese && animeTitleNative !== animeTitleRomaji && animeJpIsHtml" class="jp" v-html="animeJpHtml" />
<span v-else-if="showJapanese && animeTitleNative !== animeTitleRomaji" class="jp">{{ animeJpHtml }}</span>
```

(same pattern for the song title's `songJpHtml`/`songJpIsHtml`.)

Together: the only remaining `v-html` sink now only ever receives genuine
kuroshiro output, and that output is now provably inert even in the
worst case (a hostile string as input), while the "no furigana yet" case no
longer touches `v-html` at all.

Must not break:

- Furigana still renders exactly as today for every real anime/song title -
  verified the escape-then-convert round-trip preserves ruby-tag generation
  and doesn't visibly alter output for genuinely Japanese text (no `<`/`>`/
  `&`/`"`/`'` in real titles).
- The Furigana-off display (plain native title, no ruby) - unchanged, just no
  longer routed through `v-html` to get there.
- The loading/fetch-error fallback display - unchanged in content, same
  fallback text.
- `CardPreviewModal`, which reuses `StudyInfoPanel` unchanged - gets the fix
  automatically, no separate work needed there.

## Build steps

- [x] **Step 1 - escape input before `kuroshiro.convert()`** - add a small
  `escapeHtml()` helper in `server/utils/furigana.ts` and apply it to `text`
  before calling `kuroshiro.convert()`. *Done when:* `/api/furigana?text=<script>` (or any string containing `<`/`>`/`&`/`"`/`'`) returns HTML
  with those characters entity-escaped instead of literal, and a real
  Japanese title (e.g. `鬼滅の刃`) still returns correct `<ruby>` markup,
  unchanged from before.
- [x] **Step 2 - stop rendering raw text through `v-html`** - add
  `animeJpIsHtml`/`songJpIsHtml` refs to `StudyInfoPanel.vue`, set them
  alongside the existing `animeJpHtml`/`songJpHtml` assignments (`true` only
  on a successful furigana fetch, `false` everywhere else), and split each
  template span into an `v-html`/plain-text pair gated on the flag, as shown
  above. *Done when:* with Furigana on, a title still shows ruby annotations
  exactly as before; with Furigana off, the plain native title still shows
  (now via text interpolation, not `v-html`); forcing `/api/furigana` to fail
  (e.g. temporarily break the route) still shows the plain native title as a
  fallback, not an error or blank; visual appearance (`.jp` styling) is
  unchanged in every case.

## Verify

- Run `bun run build` (typecheck + build) - must pass clean.
- Manually on `/study` or a card Preview: toggle Japanese and Furigana on/off
  and confirm titles render identically to before in every combination.
- Temporarily point `/api/furigana` at a broken URL (or stop the dev server
  briefly mid-toggle) and confirm the fallback still shows plain text, not a
  broken render.
- Spot-check that `GET /api/furigana?text=%3Cscript%3Ex%3C%2Fscript%3E`
  returns `&lt;script&gt;x&lt;/script&gt;` (escaped), not the literal tag.

## Findings

None raised against this fix.
