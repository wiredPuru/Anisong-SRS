import type { NetworkMode } from "./networkMode.ts";

export type AnswerSearchKind = "anime" | "artist" | "song";

// Offline (or not yet known), typed-answer suggestions come from the library's
// own titles instead of a provider, so the route that would be refused is never called.
export function answerSearchRoute(
  kind: AnswerSearchKind,
  offlineMode: NetworkMode,
  onlinePath: string,
  q: string,
): { path: string; query: Record<string, string> } {
  if (offlineMode === false) return { path: onlinePath, query: { q } };
  return { path: "/api/study/answer-local", query: { kind, q } };
}
