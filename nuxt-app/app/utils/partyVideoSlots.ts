export function assignPartyVideoSlots(
  previous: readonly (string | null)[],
  requested: readonly string[],
): (string | null)[] {
  const wanted = [...new Set(requested.filter(Boolean))].slice(0, previous.length);
  const next = previous.map((token) => token && wanted.includes(token) ? token : null);
  for (const token of wanted) {
    if (next.includes(token)) continue;
    const free = next.indexOf(null);
    if (free !== -1) next[free] = token;
  }
  return next;
}
