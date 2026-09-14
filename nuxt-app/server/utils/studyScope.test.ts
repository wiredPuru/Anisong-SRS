import { describe, expect, it } from "vitest";
import { parseStudyScope } from "./studyScope.ts";

describe("parseStudyScope", () => {
  it("accepts all without an id", () => {
    expect(parseStudyScope("all", undefined)).toEqual({ scope: { type: "all" } });
  });

  it.each(["artist", "anime", "created"] as const)("accepts %s with a numeric id", (type) => {
    expect(parseStudyScope(type, "12")).toEqual({ scope: { type, id: 12 } });
  });

  it.each([[undefined], [""], ["  "], ["abc"], [["1", "2"]]])("rejects a created scope with id %j", (idRaw) => {
    expect(parseStudyScope("created", idRaw)).toHaveProperty("error");
  });

  it.each([[undefined], ["deck"], ["ALL"], [["all"]]])("rejects an unknown type %j", (type) => {
    expect(parseStudyScope(type, "1")).toHaveProperty("error");
  });
});
