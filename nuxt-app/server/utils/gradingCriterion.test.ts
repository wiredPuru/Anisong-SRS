import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRADING_CRITERION,
  GRADING_CRITERIA,
  isTitleCriterion,
  parseGradingCriterion,
} from "./gradingCriterion.ts";

describe("parseGradingCriterion", () => {
  it.each(GRADING_CRITERIA)("accepts %s", (criterion) => {
    expect(parseGradingCriterion(criterion)).toBe(criterion);
  });

  it.each([
    ["an unknown string", "artist"],
    ["an empty string", ""],
    ["whitespace around a valid value", " title "],
    ["the wrong case", "Title"],
  ])("rejects %s", (_label, value) => {
    expect(parseGradingCriterion(value)).toBeNull();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 1],
    ["an object", { criterion: "title" }],
  ])("rejects %s", (_label, value) => {
    expect(parseGradingCriterion(value)).toBeNull();
  });
});

describe("isTitleCriterion", () => {
  it("is true only for the track stored on the card row", () => {
    expect(isTitleCriterion("title")).toBe(true);
    expect(isTitleCriterion("song")).toBe(false);
    expect(isTitleCriterion("both")).toBe(false);
  });

  it("defaults to the title track", () => {
    expect(isTitleCriterion(DEFAULT_GRADING_CRITERION)).toBe(true);
  });
});
