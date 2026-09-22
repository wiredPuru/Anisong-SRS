import { describe, expect, it } from "vitest";
import { parseReviewBody } from "./studyReview.ts";

describe("parseReviewBody", () => {
  it("defaults an absent criterion to title", () => {
    expect(parseReviewBody({ cardId: 4, result: "pass" })).toEqual({ cardId: 4, result: "pass", criterion: "title" });
  });

  it.each(["title", "song", "both"])("accepts the %s criterion", (criterion) => {
    expect(parseReviewBody({ cardId: 4, result: "fail", criterion })).toEqual({ cardId: 4, result: "fail", criterion });
  });

  it.each([[{}], [null], ["4"], [{ result: "pass" }]])("rejects a body with no cardId %j", (body) => {
    expect(parseReviewBody(body)).toHaveProperty("error");
  });

  it("rejects a non-numeric cardId", () => {
    expect(parseReviewBody({ cardId: "4", result: "pass" })).toHaveProperty("error");
  });

  it.each([["maybe"], ["PASS"], [undefined]])("rejects result %j", (result) => {
    expect(parseReviewBody({ cardId: 4, result })).toHaveProperty("error");
  });

  it.each([["artist"], ["Song"], [""], [null], [2]])("rejects criterion %j", (criterion) => {
    expect(parseReviewBody({ cardId: 4, result: "pass", criterion })).toHaveProperty("error");
  });
});
