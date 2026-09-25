import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => vi.fn());
vi.mock("../../utils/artistSource.ts", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../utils/artistSource.ts")>(),
  searchArtistCandidates: search,
}));

async function lookupArtist(query: unknown) {
  vi.stubGlobal("getQuery", () => query);
  const route = (await import("./artist-answer-search.get")).default;
  return route({} as Parameters<typeof route>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("createError", (input: { statusCode: number; statusMessage: string }) => Object.assign(new Error(input.statusMessage), input));
  search.mockResolvedValue([{ source: "anisongdb", id: 8355, name: " YOASOBI ", slug: null }]);
});
afterEach(() => vi.unstubAllGlobals());

describe("artist answer search route", () => {
  it("rejects a missing or blank query", async () => {
    await expect(lookupArtist({})).rejects.toMatchObject({ statusCode: 400 });
    await expect(lookupArtist({ q: "   " })).rejects.toMatchObject({ statusCode: 400 });
    expect(search).not.toHaveBeenCalled();
  });

  it("returns only the redacted Artist-answer fields", async () => {
    await expect(lookupArtist({ q: " YOASOBI " })).resolves.toEqual({
      results: [{ key: "yoasobi", artistName: "YOASOBI" }],
    });
    expect(search).toHaveBeenCalledWith("YOASOBI");
  });
});
