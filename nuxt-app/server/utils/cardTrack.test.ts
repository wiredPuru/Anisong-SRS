import { describe, expect, it } from "vitest";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import {
  trackBoxExpr,
  trackDueBeforeCondition,
  trackDueCondition,
  trackNextReviewAtExpr,
  trackPopulationCondition,
  trackStreakExpr,
} from "./cardTrack.ts";

const NON_TITLE = ["song", "title+song", "title+slot+artist"] as const;

const selectSql = (expr: Parameters<typeof db.select>[0][string]) =>
  db.select({ value: expr }).from(card).toSQL();

describe("track expressions on the title criterion", () => {
  it.each([
    ["box", trackBoxExpr, card.box],
    ["streak", trackStreakExpr, card.streak],
    ["nextReviewAt", trackNextReviewAtExpr, card.nextReviewAt],
  ])("returns the card row's own %s column, not a subquery", (_label, build, column) => {
    // Identity, not SQL text: drizzle leaves names unqualified in a
    // single-table select, so the rendered string cannot tell the two apart.
    expect(build("title")).toBe(column);
    expect(selectSql(build("title")).sql).not.toContain("card_track");
  });
});

describe("track expressions on a non-title criterion", () => {
  it.each(NON_TITLE)("reads box from a card_track subquery for %s", (criterion) => {
    const { sql: text, params } = selectSql(trackBoxExpr(criterion));
    expect(text).toContain("card_track");
    expect(text).toMatch(/coalesce\(\(select/i);
    expect(params).toContain(criterion);
  });

  it.each(NON_TITLE)("scopes the subquery to the card and the criterion for %s", (criterion) => {
    const { sql: text } = selectSql(trackStreakExpr(criterion));
    expect(text).toContain(`"card_track"."card_id" = "card"."id"`);
    expect(text).toContain(`"card_track"."criterion" =`);
  });

  it("defaults a missing row to box 1, streak 0, and an always-due date", () => {
    expect(selectSql(trackBoxExpr("song")).params).toContain(1);
    expect(selectSql(trackStreakExpr("song")).params).toContain(0);
    expect(selectSql(trackNextReviewAtExpr("song")).params).toContain(0);
  });
});

describe("trackDueCondition", () => {
  const conditionSql = (criterion: Parameters<typeof trackDueCondition>[0], now: Date) =>
    db.select().from(card).where(trackDueCondition(criterion, now)).toSQL();

  const NOW = new Date("2026-09-22T12:00:00.000Z");

  it("compares the card's own column on the title criterion", () => {
    const { sql: text } = conditionSql("title", NOW);
    expect(text).toContain(`"card"."next_review_at" <=`);
    expect(text).not.toContain("card_track");
  });

  it.each(NON_TITLE)("compares the %s track against the same instant in unix seconds", (criterion) => {
    const { sql: text, params } = conditionSql(criterion, NOW);
    expect(text).toContain("card_track");
    expect(params).toContain(Math.floor(NOW.getTime() / 1000));
  });
});

describe("trackPopulationCondition", () => {
  const whereSql = (criterion: "title" | (typeof NON_TITLE)[number]) =>
    db.select({ id: card.id }).from(card).where(trackPopulationCondition(criterion)).toSQL();

  it("adds nothing for the title track, which every card has", () => {
    expect(trackPopulationCondition("title")).toBeUndefined();
    expect(whereSql("title").sql).not.toContain("where");
  });

  it.each(NON_TITLE)("counts cards with a %s track row or in a deck graded on it", (criterion) => {
    const { sql: text, params } = whereSql(criterion);
    expect(text).toContain('"card_track"."card_id" = "card"."id"');
    expect(text).toContain('"deck"."grading_criterion" = ?');
    expect(params).toEqual([criterion, criterion]);
  });
});

describe("trackDueBeforeCondition", () => {
  const before = new Date("2026-10-01T00:00:00.000Z");

  it("compares the card row's own column for the title track", () => {
    const { sql: text } = db.select({ id: card.id }).from(card).where(trackDueBeforeCondition("title", before)).toSQL();
    expect(text).toContain('"next_review_at" < ?');
    expect(text).not.toContain("card_track");
  });

  it.each(NON_TITLE)("compares the %s track's due date in unix seconds, strictly", (criterion) => {
    const { sql: text, params } = db.select({ id: card.id }).from(card).where(trackDueBeforeCondition(criterion, before)).toSQL();
    expect(text).toContain("card_track");
    expect(text).toMatch(/\) < \?$/);
    expect(params).toContain(Math.floor(before.getTime() / 1000));
  });
});
