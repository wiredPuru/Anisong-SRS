import { describe, expect, it } from "vitest";
import type { StudyFilters } from "./studyFilters.ts";
import { BULK_DELETE_MAX, hasAnyCardsIdsFilter, parseCardListFilters, parseDeleteBody, parseMatchingQuery } from "./cardDelete.ts";

describe("parseDeleteBody", () => {
  it("accepts a single id", () => {
    expect(parseDeleteBody({ id: 7 })).toEqual({ kind: "single", id: 7 });
  });

  it("accepts a list of ids", () => {
    expect(parseDeleteBody({ ids: [1, 2, 3] })).toEqual({ kind: "bulk", ids: [1, 2, 3] });
  });

  it("rejects an empty ids list", () => {
    expect(parseDeleteBody({ ids: [] })).toHaveProperty("error");
  });

  it.each([[[1, 2.5]], [[1, -3]], [[1, "2"]], [[0]]])("rejects non-positive-integer ids %j", (ids) => {
    expect(parseDeleteBody({ ids })).toHaveProperty("error");
  });

  it("rejects more ids than the cap", () => {
    const ids = Array.from({ length: BULK_DELETE_MAX + 1 }, (_, i) => i + 1);
    expect(parseDeleteBody({ ids })).toHaveProperty("error");
    expect(parseDeleteBody({ ids: ids.slice(1) })).toEqual({ kind: "bulk", ids: ids.slice(1) });
  });

  it.each([[{}], [null], ["7"], [{ id: "7" }]])("rejects a body with no usable id %j", (body) => {
    expect(parseDeleteBody(body)).toHaveProperty("error");
  });
});

describe("parseMatchingQuery", () => {
  it("trims a real search", () => {
    expect(parseMatchingQuery("  lisa ")).toBe("lisa");
  });

  it("rejects a missing, blank, or non-string query", () => {
    expect(parseMatchingQuery(undefined)).toBeNull();
    expect(parseMatchingQuery("")).toBeNull();
    expect(parseMatchingQuery("   ")).toBeNull();
    expect(parseMatchingQuery(["a", "b"])).toBeNull();
  });
});

const NARROWING: StudyFilters = {
  yearMin: null, yearMax: null, seasons: [], scoreMin: null, scoreMax: null, formats: [], themeTypes: ["IN"],
  genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
  listAniListIds: null, listSource: null,
};

describe("hasAnyCardsIdsFilter", () => {
  it("rejects a blank query with every toggle off", () => {
    expect(hasAnyCardsIdsFilter(null, {})).toBe(false);
    expect(hasAnyCardsIdsFilter(null, { missingAnimeThemesMatch: false, suspendedOnly: false })).toBe(false);
  });

  it("accepts a blank query with the AnimeThemes toggle on", () => {
    expect(hasAnyCardsIdsFilter(null, { missingAnimeThemesMatch: true })).toBe(true);
  });

  it("accepts a blank query with the Suspended toggle on", () => {
    expect(hasAnyCardsIdsFilter(null, { suspendedOnly: true })).toBe(true);
  });

  it("accepts a blank query with the Downloaded toggle or anime filters on", () => {
    expect(hasAnyCardsIdsFilter(null, { downloadedOnly: true })).toBe(true);
    expect(hasAnyCardsIdsFilter(null, { studyFilters: { ...NARROWING } })).toBe(true);
  });

  it("does not count empty anime filters or a false Downloaded toggle as active", () => {
    expect(hasAnyCardsIdsFilter(null, { downloadedOnly: false, studyFilters: null })).toBe(false);
  });

  it("accepts a real query with the toggles off", () => {
    expect(hasAnyCardsIdsFilter("lisa", {})).toBe(true);
  });

  it("accepts a real query with a toggle on", () => {
    expect(hasAnyCardsIdsFilter("lisa", { missingAnimeThemesMatch: true })).toBe(true);
  });
});

describe("parseCardListFilters", () => {
  const read = (query: Record<string, unknown>) => parseCardListFilters(query) as { filters: unknown } | { error: string };
  const off = { missingAnimeThemesMatch: false, suspendedOnly: false, downloadedOnly: false, studyFilters: null };

  it("reads each toggle only from the literal \"1\"", () => {
    expect(read({ missingAnimeThemes: "1", suspended: "1", downloaded: "1" })).toEqual({
      filters: { missingAnimeThemesMatch: true, suspendedOnly: true, downloadedOnly: true, studyFilters: null },
    });
    expect(read({ missingAnimeThemes: "true", suspended: ["1"], downloaded: "yes" })).toEqual({ filters: off });
    expect(read({})).toEqual({ filters: off });
  });

  it("parses the anime-level filters from the filters JSON", () => {
    const result = read({ filters: JSON.stringify({ themeTypes: ["IN"] }) }) as { filters: { studyFilters: { themeTypes: string[] } } };
    expect(result.filters.studyFilters.themeTypes).toEqual(["IN"]);
  });

  it("treats a filter set that narrows nothing as none", () => {
    expect(read({ filters: "{}" })).toEqual({ filters: off });
  });

  it("returns the parser's message for filters it cannot use", () => {
    expect(read({ filters: "{" })).toEqual({ error: "filters is not valid JSON" });
    expect(read({ filters: JSON.stringify({ themeTypes: ["XX"] }) })).toHaveProperty("error");
  });
});
