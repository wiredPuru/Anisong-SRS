# Feature: Language display toggles

**From build-plan:** feature 6c
**Status:** verified

## Goal

Independently toggleable English / Romaji / Japanese+Furigana display for the
anime title on the study screen (`StudyInfoPanel`, built in 6b), plus the
Japanese morphological-analyzer dependency needed to generate the furigana
readings. This is the last sub-feature of build-plan item 6 ("Study
session").

Verified fresh against the real code: `anime.titleNative` already exists as a
`NOT NULL` column (`nuxt-app/server/db/schema.ts:10`) and is populated at
import time from AniList (`lookup/import.post.ts`) - the raw Japanese text is
already in the database for every anime. Nothing from 6b's `CardWithDetails`
selects it yet (confirmed in `cards.ts`'s `cardSelection`), which is exactly
the gap 6b's Design reference table flagged and deferred to this feature. No
schema migration or backfill is needed - this is additive selection plus a
new, separate furigana-generation endpoint.

## Design reference

`prototypes/study.html` was deleted at the end of 6b (per `/complete`'s
"discard consumed prototypes" step - a call made without checking whether a
later sub-feature still needed it, which this spec is now flagging as a
process gap). The relevant markup and CSS for the lang toggles, the Japanese
line, and the Migaku hint were read during this session before deletion and
are reproduced verbatim below as this feature's design reference, since the
live file no longer exists to link to:

```html
<div class="lang-toggles">
  <button class="lang-btn on">EN</button>
  <button class="lang-btn on">Romaji</button>
  <button class="lang-btn on">JP + Furigana</button>
</div>

<div class="title-block">
  <span class="en">Bocchi the Rock!</span>
  <span class="romaji">Seishun Complex</span>
  <span class="jp">
    <ruby>青春<rt>せいしゅん</rt></ruby><ruby>コンプレックス<rt></rt></ruby>
  </span>
</div>
...
<p class="hint">Japanese text is real, selectable text - Migaku can look up any word here.</p>
```

```css
.lang-toggles { display: flex; gap: 10px; flex-wrap: wrap; }

.lang-btn {
  padding: 9px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
}

.lang-btn.on {
  background: color-mix(in srgb, var(--accent-secondary) 24%, var(--surface-raised));
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
}

.title-block .jp {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-secondary);
}

.title-block .jp ruby rt {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}

.hint {
  font-size: 13px;
  color: var(--faint);
  line-height: 1.5;
}
```

Note the mockup's own furigana example: `<ruby>コンプレックス<rt></rt></ruby>`
- the katakana word "Complex" gets an **empty** `<rt>`, because katakana is
already phonetic and needs no reading. Only kanji segments get a real
reading. This is exactly what `kuroshiro`'s `mode: "furigana"` conversion
produces natively, which is why Step 1 below uses it directly rather than
hand-rolling segment logic.

All three toggles default **on** (matching the mockup), and are independently
toggleable - not a single-select mode. This doesn't change the study screen's
default look for EN/Romaji (6b already always showed both); it adds the JP
line as newly visible by default and makes all three individually hideable.

## In scope

- `kuroshiro` + `kuroshiro-analyzer-kuromoji` dependency (the pairing
  `project-overview.md`'s Tech stack section already names for this feature).
- `GET /api/furigana?text=<japanese text>` - a small, generic server route
  that converts arbitrary Japanese text to furigana-annotated HTML via
  kuroshiro, returning `{ html: string }`. Not anime-specific - it just
  wraps kuroshiro's conversion.
- A lazily-initialized, singleton kuroshiro instance server-side (the
  kuromoji dictionary load is expensive; do it once per server process, not
  per request).
- `animeTitleNative` added to the shared `cardSelection`/`CardWithDetails` in
  `cards.ts` - a single change that propagates to all four endpoints that
  already reuse `cardQuery()` (`/api/cards`, `/api/decks/cards`,
  `/api/study/next`, `/api/study/review`).
- `animeTitleNative` added to the client-side `CardWithDetails` mirror in
  `useStudySession.ts` (the canonical import point for study components, per
  6b's convention) and threaded through to `StudyInfoPanel` as a new prop.
- Three independently-toggleable lang buttons (EN / Romaji / JP+Furigana) in
  `StudyInfoPanel`, each showing/hiding its corresponding title line. Toggle
  state lives in the panel's own local state (no persistence across page
  loads - nothing else in this app persists UI preferences either); since
  `StudyInfoPanel` isn't remounted per card (no `:key` on it, unlike the
  player), toggle state naturally persists across cards within one session,
  which is the more useful behavior (set your preferred display once).
- The JP line renders kuroshiro's furigana HTML for the current card's
  `animeTitleNative` via `v-html`, fetched on demand (only when the JP
  toggle is on and the card's native title changes) rather than for every
  card up front.
- Restoring the mockup's "Migaku" hint paragraph now that the JP line is
  real (6b explicitly dropped it since there was no JP line yet).

## Out of scope

- Applying language toggles to the **song title** or **artist name** - the
  data model only gives the *anime* title EN/Romaji/Native variants (`Song`
  has a single `title` field, `Artist` a single `name`); nothing to toggle
  there. Matches 6b's Design reference table, which scoped the deferred
  toggle to the anime title block specifically.
- Any schema change or migration - `titleNative` already exists and is
  already populated for every anime via the existing import flow.
- Updating `cards/index.vue` or `decks/index.vue`'s own local
  `CardWithDetails` type mirrors to include `animeTitleNative` - they don't
  display it and adding an unused field to their independent local
  interfaces would be dead weight, consistent with 6b's precedent of not
  touching those pages for unrelated fields.
- Persisting toggle preferences (localStorage, DB, or URL) across page
  reloads - session-local state only, per the In scope note above.
- Any other feature 7/8 work (review stats, deck export/import).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Furigana generation endpoint** - add the `kuroshiro` and
  `kuroshiro-analyzer-kuromoji` dependencies. Add
  `nuxt-app/server/utils/furigana.ts` exporting `toFuriganaHtml(text:
  string): Promise<string>`, backed by a module-level lazily-initialized
  singleton (`let instance; let initPromise;` pattern) so the kuromoji
  dictionary loads once per server process, not per request. Add
  `nuxt-app/server/api/furigana.get.ts` handling `GET
  /api/furigana?text=<japanese text>`: 400 if `text` is missing/empty,
  otherwise `{ html: string }` from `toFuriganaHtml`. *Done when*: `curl -i
  'localhost:3000/api/furigana?text=%E9%9D%92%E6%98%A5'` (URL-encoded 青春)
  returns `200` with `html` containing `<ruby>` tags and a real hiragana
  reading; a request with a katakana-only or romaji string returns `200`
  with the text passed through with no spurious readings (matching the
  mockup's empty-`<rt>`-for-katakana behavior); a missing `text` param
  returns `400`; build + `tsc --build` clean. **Correction made during
  implementation:** `kuroshiro`'s CJS build only sets `exports.default`,
  never reassigns `module.exports` - so the default ESM import resolves to
  the whole `{ default: Kuroshiro }` object, not the class (confirmed by a
  runtime probe: `typeof import` was `"object"`, not `"function"`), throwing
  "Kuroshiro is not a constructor". Fixed with an explicit `.default` unwrap
  in `furigana.ts`. Separately, the ambient `.d.ts` for both packages
  (neither ships types) had to live under `nuxt-app/shared/types/`, not
  `server/types/` as originally planned - Nuxt's typed-route inference for
  `useFetch` pulls server route handlers into the **app** project's own
  TypeScript program too, and that program's "include" only covers
  `shared/**/*.d.ts` and the project root, not `server/types/`. Confirmed by
  isolating which of the four project-reference builds actually threw the
  "could not find a declaration file" error (`tsconfig.app.json`, not
  `tsconfig.server.json`).

- [x] **Step 2 - Propagate `animeTitleNative`** - add `animeTitleNative:
  anime.titleNative` to `cardSelection` and the `CardWithDetails` interface
  in `nuxt-app/server/utils/cards.ts`. Add the same field to the client-side
  `CardWithDetails` mirror in `nuxt-app/app/composables/useStudySession.ts`.
  *Done when*: `curl localhost:3000/api/study/next?type=all` (with a due
  card available) includes a non-empty `animeTitleNative` field in its JSON
  response, alongside the existing `animeTitleEnglish`/`animeTitleRomaji`;
  build + `tsc --build` clean.

- [x] **Step 3 - Lang toggles and JP line in `StudyInfoPanel`** - add an
  `animeTitleNative: string` prop to `StudyInfoPanel`. Add three local
  reactive booleans (`showEn`, `showRomaji`, `showJp`, all defaulting
  `true`) and a `.lang-toggles` row of three buttons (EN / Romaji / JP +
  Furigana) per the Design reference above, each toggling its own boolean
  and getting the `.on` class when active. Gate the existing `.en`/`.romaji`
  spans behind `showEn`/`showRomaji`. Add a `.jp` span shown behind `showJp`:
  a `watch` on `[currentCard's animeTitleNative, showJp]` (as props/local
  state) fetches `GET /api/furigana?text=<encoded animeTitleNative>` via
  `$fetch` when `showJp` is true and the text has changed since the last
  fetch, storing the result in a local ref rendered via `v-html` inside the
  `.jp` span; skip the fetch entirely while `showJp` is false. Until that
  fetch resolves, and if it ever rejects, the `.jp` span falls back to the
  plain `animeTitleNative` text (no ruby) instead of staying blank - one
  fallback ref covers both the loading moment and a failed request, so the
  line is never empty once `showJp` is on. Restore the mockup's `.hint`
  paragraph below the meta-row. Pass `:anime-title-native` through from
  `nuxt-app/app/pages/study/index.vue`. *Done when*: in the browser, all
  three toggles start on and show EN/Romaji/JP+ruby lines for the current
  card; clicking any toggle hides only that line and turns the button off;
  turning JP back on re-shows it (re-fetching only if the card changed
  since); switching to a different due card while JP is on shows that
  card's own furigana, not the previous card's; stopping the dev server (or
  otherwise forcing `/api/furigana` to fail) and toggling JP shows the
  plain native title instead of a blank line; build + `tsc --build` clean.

## Files / areas

- `nuxt-app/server/utils/furigana.ts` - new
- `nuxt-app/server/api/furigana.get.ts` - new
- `nuxt-app/shared/types/kuroshiro.d.ts` - new (ambient module declarations;
  lives under `shared/` rather than `server/` - see Step 1's implementation
  note)
- `nuxt-app/server/utils/cards.ts` - add `animeTitleNative`
- `nuxt-app/app/composables/useStudySession.ts` - add `animeTitleNative` to
  the client `CardWithDetails` mirror
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - toggles, JP line, hint
- `nuxt-app/app/pages/study/index.vue` - pass the new prop through
- `nuxt-app/package.json` - new dependencies

## Data / contracts

No schema changes. `CardWithDetails` (server and client) gains one field:

```ts
interface CardWithDetails {
  // ...unchanged fields from 6b...
  animeTitleNative: string;
}
```

**New server contract:**

```
GET /api/furigana?text=<japanese text>
  200 -> { html: string }   // kuroshiro furigana-mode HTML, e.g. "<ruby>青春<rt>せいしゅん</rt></ruby>..."
  400 -> missing/empty `text`
```

## Testing

Still no test runner configured. Rides on the curl/browser evidence in each
step's *Done when*. If `/tests` runs before this feature, `toFuriganaHtml`
would be a reasonable focused-test candidate (mock kuroshiro, assert the
wrapper's empty/missing-text handling) - not written now since no runner
exists.

## Notes for the AI

- **Process gap this spec had to route around:** `/complete` deleted
  `prototypes/` at the end of 6b without checking whether 6c (the very next
  planned sub-feature) still needed it as a design reference. It did. The
  Design reference section above reproduces the needed markup/CSS from this
  session's earlier read rather than linking a now-deleted file. Nothing
  else in the build plan currently points at `prototypes/`, so this
  shouldn't recur, but it's worth remembering that a "last consumer" check
  should consider sub-features of the same parent item, not just the one
  just completed.
- **kuromoji's dictionary is a real file-loading step**, not instant - the
  singleton pattern in Step 1 exists specifically so a study session doesn't
  pay that cost on every card. Verify during Step 1 that the *second*
  `/api/furigana` request in the same server process is fast; if it isn't,
  the singleton isn't actually being reused.
- `kuroshiro`'s `init()` needs an analyzer instance (`kuroshiro-analyzer-kuromoji`'s
  `KuromojiAnalyzer`) - both packages are required together, not `kuroshiro`
  alone.
- The `v-html` in Step 3 renders server-generated furigana markup, not
  arbitrary user input - the source text is an anime title from AniList
  (external, but not attacker-controlled in this single-user local app), and
  kuroshiro only ever wraps segments in `<ruby>`/`<rt>` tags rather than
  interpreting the source as HTML. Still worth a second look during review
  given `v-html` is a standing XSS surface in general.
- Match the mockup's empty-`<rt>`-for-non-kanji behavior by trusting
  kuroshiro's own furigana-mode output rather than post-processing it -
  don't strip or fill empty `<rt>` tags.
