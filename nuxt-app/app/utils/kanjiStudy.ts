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

export function pickSourceClip<T extends PlayableSourceCard>(sourceCard: T | null, clipSource: ClipSource): T | null {
  return sourceCard && isPlayableCard(sourceCard, clipSource) ? sourceCard : null;
}

export type StoryView =
  | { kind: "personal"; text: string }
  | { kind: "default"; text: string; author: string; url: string }
  | { kind: "none" };

export function storyView(
  personal: string | null,
  defaultStory: { text: string | null; author: string | null; url: string } | null,
): StoryView {
  const own = personal?.trim();
  if (own) return { kind: "personal", text: own };
  if (defaultStory?.text && defaultStory.author) {
    return { kind: "default", text: defaultStory.text, author: defaultStory.author, url: defaultStory.url };
  }
  return { kind: "none" };
}
