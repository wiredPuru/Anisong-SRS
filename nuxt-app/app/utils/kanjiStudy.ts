import { isPlayableCard, type PlayableSourceCard } from "./listenQueue";
import type { ClipSource } from "./clipSource";

export type KanjiKeyAction = "reveal" | "pass" | "fail";

// Space and Enter reveal; the arrows grade, but only once the answer is showing.
export function kanjiKeyAction(
  key: string,
  revealed: boolean,
  modifiers: { ctrl?: boolean; meta?: boolean; alt?: boolean } = {},
): KanjiKeyAction | null {
  if (modifiers.ctrl || modifiers.meta || modifiers.alt) return null;
  if (!revealed) return key === " " || key === "Enter" ? "reveal" : null;
  if (key === "ArrowRight") return "pass";
  if (key === "ArrowLeft") return "fail";
  return null;
}

export function nextClipIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return index + 1 >= total ? 0 : index + 1;
}

export function backgroundClips<T extends PlayableSourceCard>(cards: readonly T[], clipSource: ClipSource, limit: number): T[] {
  return cards.filter((card) => isPlayableCard(card, clipSource)).slice(0, limit);
}
