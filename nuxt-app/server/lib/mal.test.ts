import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMalCompletedList, MalUserNotFoundError } from "./mal";
import { ProviderUnavailableError } from "./graphql";

vi.mock("../utils/mediaDownload.ts", () => ({ USER_AGENT: "test" }));
afterEach(() => vi.unstubAllGlobals());

const fullPage = (from: number) => Array.from({ length: 300 }, (_, i) => ({
  anime_id: from + i, anime_title: `Anime ${from + i}`,
}));

describe("Completed-list paging", () => {
  it("walks offsets until a short page ends the list", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(fullPage(1)))
      .mockResolvedValueOnce(Response.json([{ anime_id: 301, anime_title: "Last" }]));
    vi.stubGlobal("fetch", fetchMock);

    const onPage = vi.fn();
    expect(await fetchMalCompletedList("user", onPage)).toHaveLength(301);
    expect(onPage.mock.calls).toEqual([[1, 300], [2, 301]]);
    expect(fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get("offset"))).toEqual(["0", "300"]);
  });

  it("stops after one short page without asking for another", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([{ anime_id: 48, anime_title: ".hack//Sign" }]));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchMalCompletedList("user")).toEqual([{ malId: 48, title: ".hack//Sign" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips an unreadable entry but keeps the rest of the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([
      { anime_id: 1, anime_title: "Kept" },
      { anime_id: 0, anime_title: "Bad id" },
      { anime_id: 2, anime_title: "   " },
    ])));
    expect(await fetchMalCompletedList("user")).toEqual([{ malId: 1, title: "Kept" }]);
  });
});

describe("Completed-list failures", () => {
  it("reports an unknown or private list as not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ errors: [] }, { status: 400 })));
    await expect(fetchMalCompletedList("nobody")).rejects.toThrow(MalUserNotFoundError);
  });

  it("names MyAnimeList when the list cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    const onPage = vi.fn();
    await expect(fetchMalCompletedList("user", onPage)).rejects.toThrow(/MyAnimeList is temporarily unavailable/);
    expect(onPage).not.toHaveBeenCalled();
  });

  it("treats a page it cannot read at all as an outage, not an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ id: 1, name: "Renamed fields" }])));
    await expect(fetchMalCompletedList("user")).rejects.toThrow(ProviderUnavailableError);
  });

  it("treats a non-array body as an outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [] })));
    await expect(fetchMalCompletedList("user")).rejects.toThrow(ProviderUnavailableError);
  });
});
