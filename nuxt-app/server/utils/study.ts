import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card, reviewLog } from "../db/schema.ts";
import { getCardWithDetails } from "./cards.ts";
import type { CardWithDetails } from "./cards.ts";

const MAX_BOX = 5;
const INTERVAL_DAYS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeNextBoxState(currentBox: number, result: "pass" | "fail"): { box: number; nextReviewAt: Date } {
  const box = result === "pass" ? Math.min(currentBox + 1, MAX_BOX) : 1;
  const nextReviewAt = new Date(Date.now() + (INTERVAL_DAYS[box] ?? 0) * DAY_MS);
  return { box, nextReviewAt };
}

export type RecordReviewResult = { notFound: true } | { card: CardWithDetails };

export function recordReview(cardId: number, result: "pass" | "fail"): RecordReviewResult {
  const existing = db.select().from(card).where(eq(card.id, cardId)).get();
  if (!existing) {
    return { notFound: true };
  }

  const { box, nextReviewAt } = computeNextBoxState(existing.box, result);

  db.update(card).set({ box, nextReviewAt }).where(eq(card.id, cardId)).run();
  db.insert(reviewLog).values({ cardId, result, boxBefore: existing.box, boxAfter: box }).run();

  return { card: getCardWithDetails(cardId)! };
}
