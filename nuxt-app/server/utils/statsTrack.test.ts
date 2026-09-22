import { describe, expect, it } from "vitest";
import { db } from "../db/client.ts";
import { reviewLog } from "../db/schema.ts";
import { reviewsFor } from "./stats.ts";
import { parseStatsTrack } from "./statsTrack.ts";

describe("parseStatsTrack", () => {
  it("defaults an absent track to title", () => {
    expect(parseStatsTrack(undefined)).toBe("title");
  });

  it.each(["title", "song", "both"])("accepts %s", (track) => {
    expect(parseStatsTrack(track)).toBe(track);
  });

  it.each([["nope"], ["Song"], [""], [["song"]], [null]])("rejects %j", (track) => {
    expect(parseStatsTrack(track)).toHaveProperty("error");
  });
});

describe("reviewsFor", () => {
  const whereSql = (condition: ReturnType<typeof reviewsFor>) =>
    db.select({ id: reviewLog.id }).from(reviewLog).where(condition).toSQL();

  it("filters to the title track by default", () => {
    const { sql: text, params } = whereSql(reviewsFor());
    expect(text).toContain('"criterion" = ?');
    expect(params).toEqual(["title"]);
  });

  it.each(["song", "both"] as const)("filters to the %s track when asked", (criterion) => {
    expect(whereSql(reviewsFor(criterion)).params).toEqual([criterion]);
  });
});
