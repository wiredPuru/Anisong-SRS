import { and, eq, getTableName, lt, lte, or, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "../db/client.ts";
import { card, cardTrack, deck, deckCard } from "../db/schema.ts";
import { isTitleCriterion, type GradingCriterion } from "./gradingCriterion.ts";

// A card with no row for the criterion being studied is new and immediately
// due: knowing an anime's title says nothing about knowing its song, so a
// track starts fresh instead of inheriting the title track's progress.
const NEW_TRACK = { box: 1, streak: 0 } as const;
const ALWAYS_DUE_SECONDS = 0;

export interface TrackState {
  box: number;
  streak: number;
}

// Correlated subqueries rather than a join, following the precedent scopeFilter
// set in cards.ts: every due query already carries its own join list, and
// adding a conditional left join to each of them would mean restructuring all
// of them for a criterion that is "title" almost every time.
//
// Every reference is written table-qualified by hand. Inside this subquery
// drizzle renders a bare column object unqualified, which would have produced
// `where "card_id" = "id"` - and since card_track has an `id` column of its
// own, that compares card_track.card_id to card_track.id rather than to the
// outer card row. Silently wrong, not a syntax error.
function qualified(column: AnySQLiteColumn) {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}

function trackColumn(criterion: GradingCriterion, column: AnySQLiteColumn, fallback: number) {
  return sql`coalesce((select ${qualified(column)} from ${cardTrack} where ${qualified(cardTrack.cardId)} = ${qualified(card.id)} and ${qualified(cardTrack.criterion)} = ${criterion}), ${fallback})`;
}

export function trackBoxExpr(criterion: GradingCriterion) {
  if (isTitleCriterion(criterion)) return card.box;
  return trackColumn(criterion, cardTrack.box, NEW_TRACK.box).mapWith(Number);
}

export function trackStreakExpr(criterion: GradingCriterion) {
  if (isTitleCriterion(criterion)) return card.streak;
  return trackColumn(criterion, cardTrack.streak, NEW_TRACK.streak).mapWith(Number);
}

// mapWith(card.nextReviewAt) reuses the column's own timestamp mapper, so a
// selected track date comes back as a Date like card.nextReviewAt does rather
// than as the raw unix seconds better-sqlite3 hands back.
export function trackNextReviewAtExpr(criterion: GradingCriterion) {
  if (isTitleCriterion(criterion)) return card.nextReviewAt;
  return trackColumn(criterion, cardTrack.nextReviewAt, ALWAYS_DUE_SECONDS).mapWith(card.nextReviewAt);
}

// The comparison lives here rather than at the call sites because a raw SQL
// expression carries no timestamp mapper, so the Date has to be converted to
// unix seconds explicitly on the way in.
export function trackDueCondition(criterion: GradingCriterion, now: Date = new Date()) {
  if (isTitleCriterion(criterion)) return lte(card.nextReviewAt, now);
  return sql`${trackNextReviewAtExpr(criterion)} <= ${Math.floor(now.getTime() / 1000)}`;
}

// Strictly before, for a forecast window's exclusive end; same seconds
// conversion as trackDueCondition above.
export function trackDueBeforeCondition(criterion: GradingCriterion, before: Date) {
  if (isTitleCriterion(criterion)) return lt(card.nextReviewAt, before);
  return sql`${trackNextReviewAtExpr(criterion)} < ${Math.floor(before.getTime() / 1000)}`;
}

// Which cards a track's collection health and forecast count. Every card has a
// title track. Any other track exists for a card once it has a row, and
// also for every card in a manual deck graded on it, so a deck just switched to
// that criterion shows its cards as never reviewed instead of hiding them.
export function trackPopulationCondition(criterion: GradingCriterion) {
  if (isTitleCriterion(criterion)) return undefined;
  return or(
    sql`exists (select 1 from ${cardTrack} where ${qualified(cardTrack.cardId)} = ${qualified(card.id)} and ${qualified(cardTrack.criterion)} = ${criterion})`,
    sql`exists (select 1 from ${deckCard} inner join ${deck} on ${qualified(deck.id)} = ${qualified(deckCard.deckId)} where ${qualified(deckCard.cardId)} = ${qualified(card.id)} and ${qualified(deck.gradingCriterion)} = ${criterion})`,
  );
}

export function readTrackState(cardId: number, criterion: GradingCriterion): TrackState | undefined {
  if (isTitleCriterion(criterion)) {
    return db.select({ box: card.box, streak: card.streak }).from(card).where(eq(card.id, cardId)).get();
  }

  const existing = db
    .select({ box: cardTrack.box, streak: cardTrack.streak })
    .from(cardTrack)
    .where(and(eq(cardTrack.cardId, cardId), eq(cardTrack.criterion, criterion)))
    .get();

  // Undefined means the card itself is gone, which the caller reports as a 404.
  // A missing track row on a card that does exist is a new track, not a miss.
  if (existing) return existing;
  const cardExists = db.select({ id: card.id }).from(card).where(eq(card.id, cardId)).get();
  return cardExists ? { ...NEW_TRACK } : undefined;
}

export function writeTrackState(
  cardId: number,
  criterion: GradingCriterion,
  state: TrackState & { nextReviewAt: Date },
): void {
  if (isTitleCriterion(criterion)) {
    db.update(card).set(state).where(eq(card.id, cardId)).run();
    return;
  }

  db.insert(cardTrack)
    .values({ cardId, criterion, ...state })
    .onConflictDoUpdate({ target: [cardTrack.cardId, cardTrack.criterion], set: state })
    .run();
}
