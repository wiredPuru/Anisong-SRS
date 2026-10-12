import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { cardStatusExpr, type CardStatus } from "./cardStatus.ts";

/** The current status of each id that exists, so a client can show it without guessing New from Learning. */
export function getCardStatuses(ids: readonly number[]): Record<number, CardStatus> {
  if (!ids.length) return {};
  const rows = db
    .select({ id: card.id, status: cardStatusExpr })
    .from(card)
    .where(inArray(card.id, [...ids]))
    .all();
  return Object.fromEntries(rows.map((row) => [row.id, row.status]));
}
