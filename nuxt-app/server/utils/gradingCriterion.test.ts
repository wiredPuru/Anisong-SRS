import { describe, expect, it } from "vitest";
import {
  buildCriterion,
  criterionCategories,
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
    ["an unknown category", "composer"],
    ["an empty string", ""],
    ["whitespace around a valid value", " title "],
    ["the wrong case", "Title"],
    ["a non-canonical order", "song+title"],
    ["a repeated category", "title+title"],
    ["a trailing separator", "title+"],
    ["slot alone", "slot"],
    ["slot without title", "song+slot"],
    ["slot without title alongside artist", "song+slot+artist"],
    ["the pre-72 both", "both"],
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

describe("criterionCategories and buildCriterion", () => {
  it("lists the 11 valid combinations once each", () => {
    expect(GRADING_CRITERIA).toHaveLength(11);
    expect(new Set(GRADING_CRITERIA).size).toBe(11);
  });

  it.each(GRADING_CRITERIA)("round-trips %s", (criterion) => {
    expect(buildCriterion(criterionCategories(criterion))).toBe(criterion);
  });

  it("splits a combination into its categories in canonical order", () => {
    expect(criterionCategories("title+slot+artist")).toEqual(["title", "slot", "artist"]);
  });

  it("orders categories canonically whatever order they arrive in", () => {
    expect(buildCriterion(["artist", "slot", "title"])).toBe("title+slot+artist");
  });

  it("ignores duplicates", () => {
    expect(buildCriterion(["song", "song", "title"])).toBe("title+song");
  });

  it.each([
    ["no categories", []],
    ["slot alone", ["slot"]],
    ["slot without title", ["song", "slot", "artist"]],
  ] as const)("returns null for %s", (_label, categories) => {
    expect(buildCriterion(categories)).toBeNull();
  });
});

describe("isTitleCriterion", () => {
  it("is true only for the track stored on the card row", () => {
    expect(isTitleCriterion("title")).toBe(true);
    expect(isTitleCriterion("song")).toBe(false);
    expect(isTitleCriterion("title+song")).toBe(false);
  });

  it("defaults to the title track", () => {
    expect(isTitleCriterion(DEFAULT_GRADING_CRITERION)).toBe(true);
  });
});
