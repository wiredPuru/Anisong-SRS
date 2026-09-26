# Feature: Kai assets

**From build-plan:** feature 84a (parent 84, Kai mascot overhaul)
**Status:** verified

## Goal

Replace Temi with the new mascot, Kai, everywhere Temi appears today, and
give the app a set of Kai poses the later 84 sub-features can place on the
Study player, the result panel, and empty and loading states.

## Design reference

- `blueprint/reference/mascot-v2/kai-sheet-transparent.png` - the expression
  sheet with a transparent background (1536x1024). Every pose file is cut
  from it.
- `blueprint/reference/mascot-v2/kai-hero.png` - the hero illustration (opaque,
  with a classroom background), 1056x724. Source of the favicon face crop and
  the hero art 84e places on Home.
- `blueprint/reference/mascot-v2/expression-sheet.png` and `mascot-desk.png` -
  the first, non-transparent versions, kept for reference only.

## In scope

- **Pose cutouts** in `public/mascot/kai-<pose>.webp`, 13 poses: `cheer`,
  `slump`, `think`, `point`, `clap`, `surprised`, `laptop`, `giggle`, `sleepy`,
  `shy`, `peek`, `ready`, `wave`. Cut at native resolution (about 2x their
  largest display height), with neighbouring art trimmed from the edges. The
  sheet's lettered banners (CORRECT!, WRONG..., GUESS?, Nice Guess!) are not
  cut: they become real DOM text in 84d so they stay selectable and themeable.
- **Hero art** `kai-hero-1056.webp` and `kai-hero-528.webp`.
- **Favicon and touch icon** from a face crop of the hero art: `favicon.ico`
  (16/32/48) and a 180px `apple-touch-icon.png`, replacing Temi's.
- **`MascotKai.vue`** replacing `MascotTemi.vue`: `pose` (default `wave`),
  `size` (`hero` 150px, `companion` 96px, `small` 56px tall), `alt`
  (default `""`), with `width`/`height` attributes computed from each pose's
  native ratio so nothing shifts on load.
- **The four existing spots**: Home hero (`wave`, with alt text), `/study`
  all caught up (`sleepy`), empty `/cards` (`laptop`), empty `/decks`
  (`point`).
- Temi's `public/mascot/temi-*.webp` removed. Temi's source art under
  `blueprint/reference/mascot/` is kept as history.

## Out of scope

- New placements (Study player, result panel, rail, loading states) - 84c to
  84e.
- Theme tokens and fonts - 84b.
- An image-processing dependency. The assets are generated once with the
  ImageMagick, `cwebp`, and Python Pillow already on this machine and
  committed; the commands are recorded in the archive.

## Data / contracts

- `KaiPose` union exported from `MascotKai.vue`.
- Budget: each pose under 60KB, hero 1056 under 80KB, favicon under 20KB.

## Build steps

- [x] **Step 1 - Assets, component, and swap** - generate the 13 poses, hero
  art, favicon, and touch icon; add `MascotKai.vue`; swap the four
  `MascotTemi` uses; delete `MascotTemi.vue` and the Temi WebPs. *Done when:*
  no `Temi`/`temi-` reference remains under `app/` or `nuxt.config.ts`; file
  sizes are within budget; `magick identify public/favicon.ico` lists 16, 32,
  and 48; `bun run test` and `bun run build` pass; a screenshot of Home shows
  Kai waving in the hero panel, resting on its bottom edge.

## Testing

No in-scope logic: a component with a lookup table and a width calculation
from fixed data. Evidence is the build, the grep, and screenshots.

## Evidence

- `bun run test`: 81 files, 1281 tests passed. `bun run build` passed and
  `.output/public/mascot/` holds the Kai files.
- `grep -rn "Temi\|temi-" app nuxt.config.ts`: no matches.
- Sizes: poses 12-45KB, hero 1056 52KB, hero 528 21KB, favicon 15KB (16/32/48
  frames), touch icon 45KB.
- `bun run measure / --base http://localhost:3100 --size 1400x900` against the
  production build: `.mascot-kai` 182.5x150 in a 165px hero panel, resting on
  its bottom edge (screenshot reviewed). The already-running dev server served a
  stale component registry after `components/mascot/` was deleted and
  recreated, so it rendered an unresolved `<mascotkai>`; a dev-server restart
  clears it.

## Regenerating the assets

Crops are cut from the transparent sheet by `crop.py` (Pillow + NumPy): each
pose's box, then any small alpha island touching the crop edge (a sliver of
neighbouring art) is cleared, then the result is trimmed to its alpha bbox.
Boxes (x0, y0, x1, y1 on the 1536x1024 sheet): cheer (20,15,575,346), slump
(565,20,1060,372), think (1075,15,1520,362), point (15,470,240,695), clap
(240,470,455,695), surprised (455,470,662,695), laptop (658,470,880,705),
giggle (875,470,1080,695), sleepy (1072,480,1335,695), shy
(1335,470,1525,695), peek (20,810,410,925), ready (430,800,622,1024), wave
(1100,805,1352,1024). Island threshold 1500px.

    cwebp -q 85 -alpha_q 90 -exact crop-<pose>.png -o public/mascot/kai-<pose>.webp
    cwebp -q 80 kai-hero.png -o public/mascot/kai-hero-1056.webp
    magick kai-hero.png -resize 528x hero-528.png && cwebp -q 80 hero-528.png -o public/mascot/kai-hero-528.webp
    magick kai-hero.png -crop 440x440+300+30 +repage -define icon:auto-resize=48,32,16 public/favicon.ico
    magick kai-hero.png -crop 440x440+300+30 +repage -resize 180x180 -strip public/apple-touch-icon.png
