export type DeckScopeType = "artist" | "anime" | "created";

export type ScopePick = { type: "all" } | { type: DeckScopeType; id: number };

export interface DeckRowNames {
  name?: string;
  titleEnglish?: string;
  titleRomaji?: string;
}

export function scopeToQuery(pick: ScopePick): { type: string; id?: string } {
  return pick.type === "all" ? { type: "all" } : { type: pick.type, id: String(pick.id) };
}

export function isSameScope(scope: ScopePick | null, pick: ScopePick): boolean {
  if (!scope) return false;
  if (scope.type === "all" || pick.type === "all") return scope.type === pick.type;
  return scope.type === pick.type && scope.id === pick.id;
}

export function deckRowLabel(type: DeckScopeType, row: DeckRowNames): string {
  return type === "anime" ? row.titleEnglish || row.titleRomaji || "" : (row.name ?? "");
}
