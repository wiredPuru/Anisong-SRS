// What imports store when a provider names no artist; searching it finds nothing useful.
const PLACEHOLDER_ARTIST = "unknown artist";
// CardAddArtistResults does not search below this length.
const MIN_QUERY_LENGTH = 2;

/** The catalog search text for an artist deck, or null when searching for it would be pointless. */
export function artistCatalogQuery(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return null;
  if (trimmed.toLowerCase() === PLACEHOLDER_ARTIST) return null;
  return trimmed;
}
