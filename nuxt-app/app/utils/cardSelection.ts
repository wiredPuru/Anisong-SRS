export type SelectionState = "none" | "some" | "all";

export function selectionState(selected: ReadonlySet<number>, loadedIds: readonly number[]): SelectionState {
  const count = loadedIds.filter((id) => selected.has(id)).length;
  if (count === 0) return "none";
  return count === loadedIds.length ? "all" : "some";
}

/** Ids from anchor to target inclusive, in list order; just the target when the anchor is no longer loaded. */
export function rangeIds(orderedIds: readonly number[], anchorId: number | null, targetId: number): number[] {
  const to = orderedIds.indexOf(targetId);
  const from = anchorId === null ? -1 : orderedIds.indexOf(anchorId);
  if (to === -1) return [];
  if (from === -1) return [targetId];
  return orderedIds.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export function chunkIds(ids: readonly number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}
