// Deck detail lives at a query-string route, not a dynamic segment - see the
// established conventions in project-overview.md. Built here rather than
// inline at each call site so the three surfaces linking to a deck cannot
// drift from the shape /decks actually parses.
export function artistDeckPath(artistId: number): string {
  return `/decks?type=artist&id=${artistId}`;
}

export function animeDeckPath(animeId: number): string {
  return `/decks?type=anime&id=${animeId}`;
}
