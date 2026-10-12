import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { getCardStatuses } from "./cardStatusLookup.ts";
import type { FlagUpdateResult } from "./cardStatus.ts";
import { parseCardIds } from "./cardSuspend.ts";

export interface KnownBody {
  ids: number[];
  known: boolean;
}

/** Validates a POST /api/cards/known body, returning an error message when it is unusable. */
export function parseKnownBody(body: unknown): KnownBody | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "ids and known are required" };
  const { ids, known } = body as { ids?: unknown; known?: unknown };

  if (typeof known !== "boolean") return { error: "known must be true or false" };
  const parsedIds = parseCardIds(ids);
  if ("error" in parsedIds) return parsedIds;
  return { ids: parsedIds, known };
}

/** Marks or unmarks cards as known without touching their schedule or history. Marking also clears suspended. */
export function setCardsKnown(ids: readonly number[], known: boolean): FlagUpdateResult {
  const found = new Set(
    db
      .update(card)
      .set(known ? { known, suspended: false } : { known })
      .where(inArray(card.id, [...ids]))
      .returning({ id: card.id })
      .all()
      .map((row) => row.id),
  );
  return {
    updated: found.size,
    notFound: ids.filter((id) => !found.has(id)),
    statuses: getCardStatuses([...found]),
  };
}
