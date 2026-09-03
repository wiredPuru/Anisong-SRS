# Fix: Artist and Created deck tiles have no picture in the poster grid

**Type:** Fix
**Status:** verified

## The problem

`/decks`' poster grid (feature 50d) renders `.deck-tile-cover` for every deck
tile, but only Anime-type decks have a real `coverImageUrl`
(`Anime.coverImageUrl`, feature 12) - `deckItems` in
`nuxt-app/app/pages/decks/index.vue` hardcoded `coverImageUrl: null` for both
Artist and Created (manual) decks. Since `.deck-tile-cover` only rendered an
`<img>` when `coverImageUrl` was truthy, the By Artist and Created tabs
showed an empty `surface-raised`-colored box with no visual identity at all,
next to the By Title tab's real posters - it read as broken/unfinished, not
intentional.

## The fix

Gave Artist and Created deck tiles their own generated visual treatment
inside the existing `.deck-tile-cover` slot, purely client-side (no new API
calls, no schema change):

- A monogram tile: the deck's first letter/glyph (artist name initial, or
  manual deck name initial) centered in large display type, on a tinted
  background derived from the Akiba Neon accent tokens (`--accent` /
  `--accent-secondary` / `--pass` / `--warning`), hashed per deck id via
  `color-mix(in srgb, var(<token>) 20%, var(--surface-raised))` so a grid of
  many decks doesn't look uniform.
  - Created decks get a small `✦` badge in the corner alongside the
    monogram, so the two tabs stay visually distinguishable at a glance.
- The Anime tab is untouched - it keeps its real cover image, and the
  monogram fallback is explicitly gated to `activeType !== 'anime'` so a
  cover-less anime (a pre-existing, accepted "absent, not broken" case) still
  falls back to the plain box exactly as before.
- The existing `.deck-tile-due` badge overlay still works on top of the new
  treatment exactly as it did on cover images.

## Build steps

- [x] **Step 1 - Monogram/icon cover for Artist and Created deck tiles** -
  added `deckTint()`/`deckInitial()` helpers and a `.deck-tile-monogram`
  block in `nuxt-app/app/pages/decks/index.vue`, rendered whenever
  `item.coverImageUrl` is null and `activeType !== 'anime'`. *Done when:*
  the By Artist and Created tabs on `/decks` show a tinted monogram tile per
  deck (no more empty boxes), the By Title tab is visually unchanged, and
  the due-count badge still overlays correctly on all three tab types.

## Verify

- `bun run build` passes clean.
- Verified visually via `bun run measure` screenshots of `/decks?type=artist`,
  `/decks?type=created`, and `/decks?type=anime` against the running dev
  server: Artist tiles show a 4-color hashed monogram rotation, Created
  tiles show the same plus the `✦` badge, due badges still overlay
  correctly, and the Anime tab's real cover art is unchanged.
