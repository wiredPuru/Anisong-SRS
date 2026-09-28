import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { cardTrack, reviewLog } from "../db/schema.ts";
import { writeTrackState } from "./cardTrack.ts";
import { getCardWithDetails, type CardWithDetails } from "./cards.ts";
import { isTitleCriterion, type GradingCriterion } from "./gradingCriterion.ts";

export const UNDO_PRE_FEATURE_MESSAGE = "This review was recorded before undo existed and cannot be undone.";
export const UNDO_NOT_LATEST_MESSAGE = "A later review of this card has to be undone first.";

export type UndoReviewResult = { notFound: true } | { conflict: string } | { card: CardWithDetails };

/** Validates a POST /api/study/undo body, returning an error message when it is unusable. */
export function parseUndoBody(body: unknown): { reviewLogId: number } | { error: string } {
  const reviewLogId = typeof body === "object" && body !== null ? (body as { reviewLogId?: unknown }).reviewLogId : undefined;
  if (typeof reviewLogId !== "number" || !Number.isSafeInteger(reviewLogId) || reviewLogId <= 0) {
    return { error: "reviewLogId is required and must be a positive integer" };
  }
  return { reviewLogId };
}

function latestLogIdForTrack(cardId: number, criterion: GradingCriterion) {
  return db
    .select({ id: reviewLog.id })
    .from(reviewLog)
    .where(and(eq(reviewLog.cardId, cardId), eq(reviewLog.criterion, criterion)))
    .orderBy(desc(reviewLog.id))
    .limit(1)
    .get()?.id;
}

/**
 * Reverses one review: restores its track from the state logged before it and
 * deletes the log row. Only the latest review of a (card, criterion) track can
 * be undone, so repeated undos always unwind in order.
 */
export function undoReview(reviewLogId: number): UndoReviewResult {
  return db.transaction(() => {
    const row = db.select().from(reviewLog).where(eq(reviewLog.id, reviewLogId)).get();
    if (!row) return { notFound: true };
    if (row.streakBefore === null || row.nextReviewAtBefore === null) return { conflict: UNDO_PRE_FEATURE_MESSAGE };
    if (latestLogIdForTrack(row.cardId, row.criterion) !== row.id) return { conflict: UNDO_NOT_LATEST_MESSAGE };

    db.delete(reviewLog).where(eq(reviewLog.id, row.id)).run();

    // A non-title track with no reviews left never existed before this one, so
    // it goes back to having no row rather than a lookalike that stats would
    // count as part of the track's population.
    if (!isTitleCriterion(row.criterion) && latestLogIdForTrack(row.cardId, row.criterion) === undefined) {
      db.delete(cardTrack).where(and(eq(cardTrack.cardId, row.cardId), eq(cardTrack.criterion, row.criterion))).run();
    } else {
      writeTrackState(row.cardId, row.criterion, {
        box: row.boxBefore,
        streak: row.streakBefore,
        nextReviewAt: row.nextReviewAtBefore,
      });
    }

    return { card: getCardWithDetails(row.cardId, row.criterion)! };
  });
}
