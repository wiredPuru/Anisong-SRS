import { describe, expect, it } from "vitest";
import { parseBrowseBody } from "./anilistBrowseBody.ts";

describe("parseBrowseBody", () => {
  it("defaults an empty body to page 1 with no filters", () => {
    expect(parseBrowseBody({})).toEqual({
      page: 1,
      filters: {
        yearMin: null, yearMax: null, seasons: [], scoreMin: null, scoreMax: null, formats: [],
        genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
      },
    });
  });

  it("keeps valid filters and de-duplicates lists", () => {
    const parsed = parseBrowseBody({
      page: 3,
      filters: { yearMin: 2010, yearMax: 2019, seasons: ["SPRING", "SPRING"], formats: ["TV"], genresInclude: ["Ecchi", "Ecchi"], tagsInclude: ["Cute Girls Doing Cute Things"], tagMinRank: 70 },
    });
    expect(parsed).toMatchObject({
      page: 3,
      filters: { yearMin: 2010, yearMax: 2019, seasons: ["SPRING"], formats: ["TV"], genresInclude: ["Ecchi"], tagMinRank: 70 },
    });
  });

  it.each([
    [{ page: 0 }],
    [{ page: 201 }],
    [{ page: 1.5 }],
    [{ filters: { formats: ["BOOK"] } }],
    [{ filters: { seasons: ["MONSOON"] } }],
    [{ filters: { yearMin: 1800 } }],
    [{ filters: { yearMin: 2020, yearMax: 2010 } }],
    [{ filters: { scoreMin: 90, scoreMax: 10 } }],
    [{ filters: { tagMinRank: 101 } }],
    [{ filters: { genresInclude: "Ecchi" } }],
    [{ filters: { tagsInclude: Array.from({ length: 51 }, (_, i) => `tag ${i}`) } }],
    [{ filters: { tagsExclude: [""] } }],
  ])("rejects %j", (body) => {
    expect(parseBrowseBody(body)).toHaveProperty("error");
  });

  it("rejects a non-object body", () => {
    expect(parseBrowseBody(null)).toHaveProperty("error");
    expect(parseBrowseBody("x")).toHaveProperty("error");
  });
});
