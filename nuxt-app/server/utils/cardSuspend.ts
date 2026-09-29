import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { BULK_DELETE_MAX } from "./cardDelete.ts";

export interface SuspendBody {
  ids: number[];
  suspended: boolean;
}

/** Validates a POST /api/cards/suspend body, returning an error message when it is unusable. */
export function parseSuspendBody(body: unknown): SuspendBody | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "ids and suspended are required" };
  const { ids, suspended } = body as { ids?: unknown; suspended?: unknown };

  if (typeof suspended !== "boolean") return { error: "suspended must be true or false" };
  if (!Array.isArray(ids) || ids.length === 0) return { error: "ids must be a non-empty array" };
  if (ids.length > BULK_DELETE_MAX) return { error: `ids may hold at most ${BULK_DELETE_MAX} entries` };
  if (!ids.every((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)) {
    return { error: "ids must all be positive integers" };
  }
  return { ids: [...new Set(ids as number[])], suspended };
}

/** Suspends or unsuspends cards without touching their schedule or history. */
export function setCardsSuspended(ids: readonly number[], suspended: boolean): { updated: number; notFound: number[] } {
  const found = new Set(
    db.update(card).set({ suspended }).where(inArray(card.id, [...ids])).returning({ id: card.id }).all().map((row) => row.id),
  );
  return { updated: found.size, notFound: ids.filter((id) => !found.has(id)) };
}
