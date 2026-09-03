# Handoff: Anisong SRS — UI redesign

## Overview
Redesign of the Anisong-SRS Nuxt app (repo: `wiredPuru/Anisong-SRS`, code at `nuxt-app/app/`). Goal: move off the current mobile-style single-column layout and purple-glow pill controls toward a wider, denser desktop layout with an anime/Akihabara visual identity, and clean up the study screen's fullscreen video overlay.

## About the design files
The two `.dc.html` files in this folder are **design references built in HTML**, not production code. `Current UI.dc.html` is a pixel recreation of the existing app (built from the real Vue source) for comparison. `Redesign.dc.html` contains the proposed directions. **Do not port this HTML directly** — recreate the layouts, spacing, and component structure in Vue/Nuxt using the app's existing component patterns (`components/nav/NavBar.vue`, `components/study/*`, page files under `pages/`).

## Fidelity
High-fidelity for layout, spacing, and interaction structure. Colors/type are a proposed direction, not final tokens — video thumbnails and cover art are grey placeholders (no real assets generated).

## Status / open decision
Nothing here is finalized yet. Two independent decisions are open:
1. **Overall app direction** — `#1a` (icon rail nav, wide split-pane layouts across all pages) vs keeping the current nav and just restyling.
2. **Study video overlay** — three candidates for the fullscreen/ambient player specifically: `#1b` (floating glass panels over the video, coral/amber palette), `#2a` (side panel — video stays clean, all text/controls in a right-hand panel, Nocturne-styled), `#2b` (bottom bar — video stays clean, all text/controls in a bar underneath, Nocturne-styled).

Confirm the pick with the user before implementing; this README documents all candidates so any of them can be built.

## Screens / views

### Home (`#1a`, section `data-screen-label="1a Home"`)
Dashboard replacing the current 5 link-cards. Left icon rail (82px, icons + 10px labels, active item pink `#ff3e88` bg tint + border). Header: page title + search field + "Add card" button. Content grid: hero banner (session summary + Start/Pick-deck CTAs) spanning both columns, a stats card with a bar chart + streak counters, and a "weakest decks" card with progress bars.

### Add card (`#1a`)
Was a single stacked column (search results, then selected anime's themes, below the fold). Redesigned as two panes side by side: left 430px = search results list; right = the selected anime's header + a table of its themes (theme code, song, artist, source, add/added state) — opens to the right, no scrolling down. Tab switcher (Anime/Artist/Song) in the header.

### Cards (`#1a`)
Was a 720px-wide vertical card list. Redesigned as a dense table (thumbnail, song, anime, source tags, due date, pass %) with a persistent 400px inspector panel on the right showing the selected card's detail, sources, decks, and edit/delete actions — actions removed from every row.

### Decks (`#1a`)
Was a 640px vertical list. Redesigned as a 6-column poster grid (2:3 cover cards with a "N due" badge) plus sort controls and search in the header.

### Stats (`#1a`)
Was a stacked list of artist/title rows. Redesigned as a dashboard: 4 stat tiles, a combined reviews+pass-rate chart (bar + line), and a by-artist breakdown with progress bars.

### Study — main layout (`#1a`)
Keeps the current two-column layout (video left, info+answer right) but collapses the row of glowing purple toggle pills into one segmented icon strip (Video/Cover/Info toggles + Auto reveal + Random start + Ambient), and swaps the purple glow for pink/cyan accents.

### Study — fullscreen/ambient overlay: three candidates
This is the screen in question — currently text panels and Fail/Pass buttons are alpha-blended directly on top of the playing video, so they fight the anime scene for contrast (see the screenshot the user attached).

- **`#1b` "Jukebox"**: video full-bleed behind everything; song info floats in a glass panel bottom-left, Fail/Pass float bottom-right, a ⋯ menu in the top bar holds the toggles that used to be a pill row. Coral/amber palette. Text still sits over the video, just consolidated into fewer, glass-backed panels.
- **`#2a` "Side panel"** *(Nocturne design system)*: video keeps full height and is left completely clean (only a small theme tag + collapse icon). All text (title/romaji/japanese, song, artist, learning count) and the Fail/Pass buttons move into a fixed 340px panel on the right, built from Nocturne's `.card`, `.seg`, `.tag`, `.btn` components. Playback scrubber stays as a bar under the video.
- **`#2b` "Bottom bar"** *(Nocturne design system)*: video keeps full width and is left completely clean. Everything — scrubber, language toggle, title/song/artist, Fail/Pass — moves into a horizontal bar underneath the video, also built from Nocturne components.

2a and 2b both solve the messiness by never putting text or interactive controls on top of the video pixels; 1b solves it partially by reducing panel count and glass-backing them, but keeps them over the video.

## Design tokens

### 1a / 1b (Akiba Neon / Jukebox direction)
- Background: `#0a0a12` / `#07070d`, panels `#12121f`, `#0c0c16`, borders `#23233c`
- Accent pink: `#ff3e88`; accent cyan: `#34e7e4`; success green: `#46e39b`; warning `#ffd166`; fail red: `#ff5470`
- Headings: "RocknRoll One" (display), body: "Zen Kaku Gothic New"
- Radius: 4–6px; row/card padding 12–22px; icon rail 82px; inspector/side panels 340–430px

### 2a / 2b (Nocturne design system — see the bound design system for the full token set)
- `--color-bg` #161826, `--color-text` #e9e9ed, `--color-accent` #9184d9 (mono-accent; ramps `--color-neutral-100…900`)
- Components used: `.card` / `.elev-md` / `.elev-lg`, `.seg` + `.seg-opt`, `.tag` / `.tag-accent` / `.tag-outline`, `.btn` / `.btn-block` / `.btn-icon` / `.btn-primary`
- Fail/Pass are a deliberate exception to Nocturne's mono-accent rule: semantic red `#ff5470`/`#ff8a9c` and green `#46e39b`/`#7cf0bb`, used only as outline + text color on transparent `.btn`, never as a fill — kept consistent with Nocturne's "outline, not flood" button rule
- Font: Inter (`--font-heading` / `--font-body`), radius 8px baked into `--radius-*`

## Assets
No real images generated. Cover art / video frames are flat-color placeholders (`#2a2a44` boxes, gradient blobs) — swap for real anime screenshots/cover art in implementation.

## Files
- `Current UI.dc.html` — pixel recreation of the current app, 8 screens, built from `nuxt-app/app/pages/*` and `nuxt-app/app/components/*`.
- `Redesign.dc.html` — turn 1 (`#1a` full-app direction, `#1b` study overlay v1) and turn 2 (`#2a`, `#2b` study overlay v2, Nocturne-based).

Open either file directly in a browser to view; each screen is a labeled `<div data-screen-label="...">` section for easy reference.
