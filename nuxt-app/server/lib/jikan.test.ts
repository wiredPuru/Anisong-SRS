import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMalCompletedList } from "./jikan";

vi.mock("../utils/mediaDownload.ts", () => ({ USER_AGENT: "test" }));
afterEach(() => vi.unstubAllGlobals());

describe("Completed-list page feedback", () => {
  it("reports only pages that were received and mapped", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ data: [{ anime: { mal_id: 1, title: "First" } }], pagination: { has_next_page: true } }))
      .mockResolvedValueOnce(Response.json({ data: [{ anime: { mal_id: 2, title: "Second" } }], pagination: { has_next_page: false } })));
    const onPage = vi.fn();
    expect(await fetchMalCompletedList("user", onPage)).toHaveLength(2);
    expect(onPage.mock.calls).toEqual([[1, 1], [2, 2]]);
  });

  it("does not report a failed page as completed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 504 })));
    const onPage = vi.fn();
    await expect(fetchMalCompletedList("user", onPage)).rejects.toThrow("504");
    expect(onPage).not.toHaveBeenCalled();
  });
});
