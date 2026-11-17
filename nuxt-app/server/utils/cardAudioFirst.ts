import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { parseCardIds } from "./cardSuspend.ts";

export const AUDIO_FIRST_STYLES = ["blind", "blur", "pixelate", "peephole", "random"] as const;
export type AudioFirstStyle = (typeof AUDIO_FIRST_STYLES)[number];

export interface AudioFirstBody {
  ids: number[];
  audioFirst: boolean;
  style?: AudioFirstStyle;
}

export interface AudioFirstResult {
  updated: number;
  notFound: number[];
}

function isAudioFirstStyle(value: unknown): value is AudioFirstStyle {
  return typeof value === "string" && (AUDIO_FIRST_STYLES as readonly string[]).includes(value);
}

/** Validates a POST /api/cards/audio-first body, returning an error message when it is unusable. */
export function parseAudioFirstBody(body: unknown): AudioFirstBody | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "ids and audioFirst are required" };
  const { ids, audioFirst, style } = body as { ids?: unknown; audioFirst?: unknown; style?: unknown };

  if (typeof audioFirst !== "boolean") return { error: "audioFirst must be true or false" };
  if (style !== undefined) {
    if (!isAudioFirstStyle(style)) return { error: `style must be one of ${AUDIO_FIRST_STYLES.join(", ")}` };
    if (!audioFirst) return { error: "style can only be set while marking cards audio first" };
  }
  const parsedIds = parseCardIds(ids);
  if ("error" in parsedIds) return parsedIds;
  return style === undefined ? { ids: parsedIds, audioFirst } : { ids: parsedIds, audioFirst, style };
}

/**
 * Marks or unmarks cards as audio first, setting the style only when one is
 * given so unmarking and re-marking keeps it. Touches no other flag, schedule, or history.
 */
export function setCardsAudioFirst(
  ids: readonly number[],
  audioFirst: boolean,
  style?: AudioFirstStyle,
): AudioFirstResult {
  const found = new Set(
    db
      .update(card)
      .set(style === undefined ? { audioFirst } : { audioFirst, audioFirstStyle: style })
      .where(inArray(card.id, [...ids]))
      .returning({ id: card.id })
      .all()
      .map((row) => row.id),
  );
  return { updated: found.size, notFound: ids.filter((id) => !found.has(id)) };
}
