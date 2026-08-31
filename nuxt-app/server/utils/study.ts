import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card, reviewLog } from "../db/schema.ts";
import { getCardWithDetails } from "./cards.ts";
import type { CardWithDetails } from "./cards.ts";
import { getBoxOneStreakRequired } from "./mediaLibrary.ts";

const MAX_BOX = 5;
const INTERVAL_DAYS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeNextBoxState(
  currentBox: number,
  currentStreak: number,
  result: "pass" | "fail",
  requiredStreak: number,
): { box: number; nextReviewAt: Date; streak: number } {
  let box: number;
  let streak: number;

  if (result === "fail") {
    box = 1;
    streak = 0;
  } else if (currentBox === 1) {
    const nextStreak = currentStreak + 1;
    if (nextStreak >= requiredStreak) {
      box = 2;
      streak = 0;
    } else {
      box = 1;
      streak = nextStreak;
    }
  } else {
    box = Math.min(currentBox + 1, MAX_BOX);
    streak = 0;
  }

  const nextReviewAt = new Date(Date.now() + (INTERVAL_DAYS[box] ?? 0) * DAY_MS);
  return { box, nextReviewAt, streak };
}

export type RecordReviewResult = { notFound: true } | { card: CardWithDetails };

export function recordReview(cardId: number, result: "pass" | "fail"): RecordReviewResult {
  const existing = db.select().from(card).where(eq(card.id, cardId)).get();
  if (!existing) {
    return { notFound: true };
  }

  const { box, nextReviewAt, streak } = computeNextBoxState(
    existing.box,
    existing.streak,
    result,
    getBoxOneStreakRequired(),
  );

  db.update(card).set({ box, nextReviewAt, streak }).where(eq(card.id, cardId)).run();
  db.insert(reviewLog).values({ cardId, result, boxBefore: existing.box, boxAfter: box }).run();

  return { card: getCardWithDetails(cardId)! };
}
