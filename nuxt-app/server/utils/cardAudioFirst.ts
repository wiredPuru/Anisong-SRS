import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { parseCardIds } from "./cardSuspend.ts";

export interface AudioFirstBody {
  ids: number[];
  audioFirst: boolean;
}

export interface AudioFirstResult {
  updated: number;
  notFound: number[];
}

/** Validates a POST /api/cards/audio-first body, returning an error message when it is unusable. */
export function parseAudioFirstBody(body: unknown): AudioFirstBody | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "ids and audioFirst are required" };
  const { ids, audioFirst } = body as { ids?: unknown; audioFirst?: unknown };

  if (typeof audioFirst !== "boolean") return { error: "audioFirst must be true or false" };
  const parsedIds = parseCardIds(ids);
  if ("error" in parsedIds) return parsedIds;
  return { ids: parsedIds, audioFirst };
}

/** Marks or unmarks cards as audio first. Touches no other flag, schedule, or history. */
export function setCardsAudioFirst(ids: readonly number[], audioFirst: boolean): AudioFirstResult {
  const found = new Set(
    db
      .update(card)
      .set({ audioFirst })
      .where(inArray(card.id, [...ids]))
      .returning({ id: card.id })
      .all()
      .map((row) => row.id),
  );
  return { updated: found.size, notFound: ids.filter((id) => !found.has(id)) };
}
