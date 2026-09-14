# Feature: Mascot (Temi)

**From build-plan:** feature 63
**Status:** verified

## Goal

Give the app a face. Temi, a pink-twintailed girl in headphones at a
quiz-buzzer desk, becomes the favicon, the hero art on Home, and a small
companion on the moments that are otherwise bare text: the "all caught up"
screen on `/study` and the empty libraries on `/cards` and `/decks`. The
source art is a 1.35MB PNG, so the app ships resized, optimized copies, never
the original.

## Design reference

- `blueprint/reference/mascot/temi-source.png` - the source art, 1254x1254,
  transparent background. Every shipped image is derived from this file.
- Palette and radii are feature 62's tokens in `main.css`. Temi's own colors
  (pink hair, black uniform, red ribbon) already sit inside the Option B rose
  palette, so no token changes are expected.

## In scope

- **Favicon and touch icon** from a head-and-shoulders crop (the full desk
  scene is unreadable at 16px): `favicon.ico` carrying 16, 32, and 48px
  frames, replacing today's 285KB `public/favicon.ico`, plus a 180px
  `apple-touch-icon.png` on an opaque `#2a2826` ground (touch icons render
  transparency as black). Explicit `<link>` tags in `nuxt.config.ts`.
- **Optimized full-art copies**: transparent WebP at 320px and 640px wide
  (1x and 2x), served from `public/mascot/`.
- **`MascotTemi.vue`**, one small presentational component rendering the
  `<img>` with `srcset`, fixed `width`/`height` attributes (no layout shift),
  `decoding="async"`, and a `size` prop for its two uses.
- **Home hero**: Temi at the left of the hero panel beside "N cards due",
  with `alt="Temi, the GAQ SRS mascot"`.
- **Companions** (decorative, `alt=""`): `/study`'s "All caught up! Nothing
  due right now." state, `/cards`' "No cards yet" state, and `/decks`' "No
  decks yet" state.

## Out of scope

- The rail (62a removed its logo tile on purpose), the Study player and info
  panel, tables, modals, and the "No cards match ..." search states. Working
  surfaces stay uncluttered (project-plan §7, build 63).
- Animation, alternate poses or expressions, or a mascot settings toggle.
- A web app manifest or PWA install icons (the app is localhost-only).
- An image-processing dependency or build step. The assets are generated once
  with the ImageMagick and `cwebp` already on this machine and committed; the
  exact commands go in the review packet and the archive so they can be re-run.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Generate assets + favicon links** - produce
  `public/mascot/temi-320.webp`, `public/mascot/temi-640.webp`, the new
  `public/favicon.ico` (16/32/48 face crop), and
  `public/apple-touch-icon.png` (180px), then add `rel="icon"` and
  `rel="apple-touch-icon"` links to `app.head.link` in `nuxt.config.ts`.
  *Done when:* file sizes are reported and within budget (see Data /
  contracts); `magick identify public/favicon.ico` lists 16, 32, and 48px
  frames; a zoomed render of the 16px and 32px frames shows a recognizable
  pink-haired face, not a blur (screenshot); the page `<head>` on `/` contains
  both links; `bun run build` passes and `.output/public/` contains
  `mascot/`, `favicon.ico`, and `apple-touch-icon.png` (so `bun run package`
  ships them).
- [x] **Step 2 - `MascotTemi` component + Home hero** - add
  `components/mascot/MascotTemi.vue` and place it in `pages/index.vue`'s
  hero panel, left of the text. *Done when:* `bun run measure / --size
  1920x1080 --size 800x900 --select ".hero-panel,.mascot-temi,.hero-actions"`
  shows Temi inside the hero at both sizes, the hero actions fully inside the
  viewport, and no horizontal page scroll; screenshots at both sizes; the
  `<img>` requests only the WebP copies, never `temi-source.png`; build
  passes.
- [x] **Step 3 - Companions on caught-up and empty states** - add the
  companion size to `/study`'s session-complete state, `/cards`' "No cards
  yet", and `/decks`' "No decks yet". *Done when:* screenshots of all three
  against an empty library (a second dev server on an empty
  `GAQ_SRS_DATA_DIR` in the scratchpad, port 3001, measured with `--base
  http://localhost:3001`), each with Temi beside or above the message and the
  links or buttons in those states still clickable; the "No cards match"
  search state on `/cards` shows no Temi; the real library's pages are
  unchanged; build passes.

## Files / areas

- `nuxt-app/public/favicon.ico` (replaced), `public/apple-touch-icon.png`,
  `public/mascot/temi-320.webp`, `public/mascot/temi-640.webp` (new)
- `nuxt-app/nuxt.config.ts` - head links
- `nuxt-app/app/components/mascot/MascotTemi.vue` (new). Nuxt strips the
  folder prefix, so the file name must start with `Mascot` to register as
  `<MascotTemi>` (the same rule as `card/CardPreviewModal.vue`).
- `nuxt-app/app/pages/index.vue`, `pages/study/index.vue` (line ~612),
  `pages/cards/index.vue` (line ~817), `pages/decks/index.vue` (line ~817)
- `blueprint/reference/mascot/temi-source.png` (already saved during intake)

## Data / contracts

No data, routes, or types change.

**Asset URLs** (root-relative, served from `public/`; the packaged build
copies `public/` beside the binary):

| Path | Contents | Budget |
|---|---|---|
| `/favicon.ico` | 16, 32, 48px frames, face crop | 20KB (today 285KB) |
| `/apple-touch-icon.png` | 180x180, opaque `#2a2826` ground | 40KB |
| `/mascot/temi-320.webp` | 320x320, transparent | 30KB |
| `/mascot/temi-640.webp` | 640x640, transparent | 80KB |

Budgets are targets. If one cannot be met without visible artifacts at
display size, report the smallest clean size instead of shipping a smeared
image.

**Component**: `<MascotTemi size="hero" | "companion" :alt="string" />`.
`alt` defaults to `""` (decorative); only the Home hero passes a name.
`hero` renders about 150px tall at desktop and about 96px under the 820px
breakpoint; `companion` about 96px. Final numbers are tuned against the
step 2 and 3 screenshots.

## Testing

- No in-scope logic: one presentational component and static assets. The
  unit-test gate is exempt (`coding-standards.md` Testing); evidence is
  `bun run measure` geometry and screenshots, `magick identify` output, file
  sizes, and `bun run build`. `bun run test` must still pass before
  `/complete`.
- Empty states are checked against a throwaway empty data directory, never by
  deleting cards from the real library.
- Favicon: browsers cache favicons hard, so check `/favicon.ico` directly and
  the `<head>` links rather than relying on a tab screenshot.

## Notes for the AI

- Styles in the component's scoped `<style>` using tokens; no inline styles;
  no new color literals (the touch icon's `#2a2826` ground lives inside the
  PNG, not in CSS).
- Always set `width` and `height` on the `<img>` so the hero does not jump
  when the image loads.
- Keep the source PNG out of `public/`; it belongs to `blueprint/reference/`.
- The hero panel already has an absolutely positioned `.hero-glow` and
  `overflow: hidden`; Temi can sit on the glow but must not be clipped
  through her face.
- `/study`'s `.state` is centered with `max-width: 420px`; `/cards` and
  `/decks` `.state` blocks are full-width bordered boxes. Match each page's
  existing layout rather than forcing one shared empty-state wrapper.
- A second dev server on port 3001 with a scratchpad `GAQ_SRS_DATA_DIR`
  creates and migrates a fresh database there; stop it after step 3.
- No em dashes in comments or docs.

## Found during the build

- **Crop.** Two head crops were rendered at 16/32/48px and compared zoomed;
  the tighter 600px square at `+300+130` stays recognizable at 16px, the
  looser 720px one did not.
- **Touch icon over budget, then fixed.** The full-color 180px PNG was 63KB
  against a 40KB target; quantizing to 256 colors (Floyd-Steinberg) brought it
  to 16KB with only faint dithering in the skin at 2x zoom.
- **Shipped sizes:** `favicon.ico` 15KB (was 285KB), `apple-touch-icon.png`
  16KB, `temi-320.webp` 26KB, `temi-640.webp` 64KB. All within budget.
- **Hero geometry.** Temi grows the Home hero from 99px to 165px tall at
  1920x1080 and to 129px at 800x900 (she shrinks to 96px under 820px). The
  "scrolls" flags and the 800px vertical page scroll `bun run measure` reports
  are identical with Temi hidden, so they predate this feature.
- **Empty states were checked on a throwaway server,** the built output on
  port 3001 with `GAQ_SRS_DATA_DIR` in the scratchpad (a second `nuxt dev`
  would have shared `.nuxt/` with the running dev server). The built server
  also needs `GAQ_SRS_MIGRATIONS_DIR` set, the same gap as F-14.
- **Not verified:** that a 2x display requests `temi-640.webp`; the headless
  browser runs at 1x and loads the 320px copy.

## Regenerating the assets

Run from the repo root with ImageMagick and `cwebp` installed:

```sh
SRC=blueprint/reference/mascot/temi-source.png; P=nuxt-app/public
magick $SRC -crop 600x600+300+130 +repage -filter Lanczos -define icon:auto-resize=48,32,16 $P/favicon.ico
magick $SRC -crop 600x600+300+130 +repage -filter Lanczos -resize 180x180 -background '#2a2826' -flatten -strip -dither FloydSteinberg -colors 256 -define png:compression-level=9 PNG8:$P/apple-touch-icon.png
for n in 320 640; do magick $SRC -filter Lanczos -resize ${n}x${n} -strip /tmp/temi-$n.png; cwebp -quiet -q 82 -alpha_q 90 -m 6 /tmp/temi-$n.png -o $P/mascot/temi-$n.webp; done
```
