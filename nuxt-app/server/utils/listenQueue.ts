/** Puts loaded cards back in the order their ids were picked, dropping ids with no card and repeats. */
export function orderCardsByIds<T extends { id: number }>(ids: readonly number[], cards: readonly T[]): T[] {
  const byId = new Map(cards.map((item) => [item.id, item]));
  const seen = new Set<number>();
  const ordered: T[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    seen.add(id);
    ordered.push(item);
  }
  return ordered;
}
