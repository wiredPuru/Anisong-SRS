import { describe, expect, it } from "vitest";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { trackBoxExpr, trackDueCondition, trackNextReviewAtExpr, trackStreakExpr } from "./cardTrack.ts";

const NON_TITLE = ["song", "both"] as const;

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
