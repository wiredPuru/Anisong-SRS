import { describe, expect, it } from "vitest";
import { parseDeckPatchBody } from "./deckPatch.ts";

describe("parseDeckPatchBody", () => {
  it("accepts a name alone", () => {
    expect(parseDeckPatchBody({ id: 3, name: "Bangers" })).toEqual({ id: 3, name: "Bangers" });
  });

  it.each(["title", "song", "both"])("accepts the %s criterion alone", (gradingCriterion) => {
    expect(parseDeckPatchBody({ id: 3, gradingCriterion })).toEqual({ id: 3, gradingCriterion });
  });

  it("accepts a name and a criterion together", () => {
    expect(parseDeckPatchBody({ id: 3, name: "Bangers", gradingCriterion: "both" })).toEqual({
      id: 3,
      name: "Bangers",
      gradingCriterion: "both",
    });
  });

  it.each([[{}], [null], ["3"], [{ name: "Bangers" }], [{ id: "3", name: "Bangers" }]])(
    "rejects a body with no usable id %j",
    (body) => {
      expect(parseDeckPatchBody(body)).toHaveProperty("error");
    },
  );

  it("rejects a body with neither field", () => {
    expect(parseDeckPatchBody({ id: 3 })).toHaveProperty("error");
  });

  it("rejects a non-string name", () => {
    expect(parseDeckPatchBody({ id: 3, name: 7 })).toHaveProperty("error");
  });

  it.each([["artist"], ["Song"], [""], [null], [2]])("rejects criterion %j", (gradingCriterion) => {
    expect(parseDeckPatchBody({ id: 3, gradingCriterion })).toHaveProperty("error");
  });

  it("rejects a bad criterion even alongside a valid name", () => {
    expect(parseDeckPatchBody({ id: 3, name: "Bangers", gradingCriterion: "artist" })).toHaveProperty("error");
  });
});
