import { sql } from "drizzle-orm";
import { card, reviewLog } from "../db/schema.ts";

export const CARD_STATUSES = ["new", "learning", "known", "suspended"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export function isCardStatus(value: unknown): value is CardStatus {
  return typeof value === "string" && (CARD_STATUSES as readonly string[]).includes(value);
}

/** What POST /api/cards/known and /suspend return: statuses cover the updated ids. */
export interface FlagUpdateResult {
  updated: number;
  notFound: number[];
  statuses: Record<number, CardStatus>;
}

// One SQL expression rather than a JS function over fetched rows, because every
// card query shares cardSelection and would otherwise each need the mapping.
// Suspended wins over known so a row that ever held both still reads honestly.
export const cardStatusExpr = sql<CardStatus>`case
  when ${card.suspended} then 'suspended'
  when ${card.known} then 'known'
  when exists (select 1 from ${reviewLog} where ${reviewLog.cardId} = ${card.id}) then 'learning'
  else 'new'
end`;
