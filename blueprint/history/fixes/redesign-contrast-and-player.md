# Fix: Redesign contrast and the collapsed study player

**Type:** Fix
**Status:** verified

## What was reported

Three problems, from screenshots taken after 50c merged:

1. `/study` - the video player was missing.
2. Active buttons showed unreadable black text ("black on that color is not
   readable I cant read the buttons").
3. The per-card Preview modal on `/cards` was redundant next to the new
   inspector rail, and should be replaced by it.

The work was reported in chat and built directly, so no `/fix` spec existed
while it was being built; the spec file was written afterwards as a record.

## What was changed

- [x] **Study player restored.** 50b wrapped `StudyMediaPlayer` in a
  `.player-pane` flex **row**, where it became a flex item sizing to its own
  content. It had been a grid child, which stretches to its column by default.
  The pane is now `flex-direction: column`, leaving `align-items` at `stretch`
  so the player fills the width, with `justify-content: center` for vertical
  placement.

- [x] **Active-button contrast.** `main.css`'s ambient-glass block strips
  backgrounds with `!important`, and its own comment records the rule: those
  buttons must indicate "active" with border and glow, never a fill. 50b gave
  `.lang-btn.on` a cyan fill plus `--accent-ink` text, so ambient mode removed
  the fill and left near-black text on dark glass. The glass treatment now
  targets `.lang-toggles` (the container), matching how `.display-toggles .seg`
  already worked, so the active segment keeps its fill.

- [x] **Two latent instances of the same conflict**, found by sweeping for it:
  `.toggle-btn.active` on `/stats` and on `/decks`, both
  `background: var(--accent)` with `--accent-ink`. Pre-existing, not from
  feature 50. Both switched to border and glow.

- [x] **Immersive overlay over bright video.** The overlay's frosted chips were
  fully transparent, so `--muted`/`--faint` text went dark-on-light whenever
  the frame behind was bright. They now carry a `--bg` scrim; row labels and
  the romaji line are lifted off `--faint`.

- [x] **Cards preview replaced by the inspector.** The rail holds a real
  `StudyMediaPlayer` for the selected card, flush to the top of the panel, and
  the per-card Preview button is gone. NavBar's global search now selects the
  card in the rail instead of opening an overlay, splicing it into the list
  when it is not on the loaded page. `CardPreviewModal` remains **only** for
  the add-candidate groups, whose results have no table row to select.

## Files

- `nuxt-app/app/pages/study/index.vue` - `.player-pane` direction.
- `nuxt-app/app/assets/css/main.css` - ambient-glass targets `.lang-toggles`.
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - overlay scrim, label
  colours.
- `nuxt-app/app/pages/stats/index.vue`, `nuxt-app/app/pages/decks/index.vue` -
  `.toggle-btn.active`.
- `nuxt-app/app/pages/cards/index.vue` - inspector player, Preview removal,
  nav-search handoff.

## Evidence

`bun run build` clean (exit 0). All six routes 200. Served CSS confirms
`.player-pane` is a column and the ambient-glass block targets `.lang-toggles`
while `.lang-btn.on` keeps `background: var(--accent-secondary)`.

Against the five browser checks the spec listed:

| # | Check | Evidence |
|---|---|---|
| 1 | `/study` player at full width | Confirmed, user screenshot |
| 2 | Ambient-mode active buttons readable | Confirmed, user screenshot: `Video`/`Cover`/`Info` cyan-filled with dark text, `Ambient` a pink outline |
| 3 | `/stats` and `/decks` tab toggles | Confirmed, headless-Chrome screenshots of both routes: active tab is an accent outline with a glow, not a filled pill |
| 4 | Immersive over a bright video | Not observed. Needs a running session with a bright frame |
| 5 | `/cards` inspector | Preview button gone: confirmed by screenshot. Row-select-plays-in-rail and the nav-search handoff: code read only (`selectCard(c.id)` -> `selectedCard` -> `StudyMediaPlayer`; the `pendingCardPreview` watch selects and splices) |

Checks 4 and 5's interactive halves were left to a live session rather than
claimed; `verification.uiEvidence` is `when-available`, not `required`.

## Follow-on found while verifying

The same `/study` screenshot that confirmed check 1 exposed a separate bug: the
restored player is sized purely by pane width, so on a wide, short window its
16:9 height overflows the pane. That is a new fix
(`fix/study-player-fit-and-search-placement`), not a regression of this one -
before this fix there was no player to overflow.

## Open question left unresolved

`CardPreviewModal` is still mounted on `/cards` for the add-candidate groups
only. If those should lose preview too, the modal and `previewCard` can come
out of the page entirely. Not decided.
