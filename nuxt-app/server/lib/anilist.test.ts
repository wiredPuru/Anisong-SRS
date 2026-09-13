import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const media = { id: 1, title: { romaji: "Cowboy Bebop", english: null, native: "カウボーイビバップ" }, coverImage: { large: "cover.jpg" } };
const fetch = vi.fn();
let client: typeof import("./anilist.ts");
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-09T12:00:00Z"));
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
  client = await import("./anilist.ts");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("AniList availability and recovery", () => {
  it("preserves successful metadata, empty searches and genuine not-found results", async () => {
    fetch.mockResolvedValueOnce(Response.json({ data: { Media: media } }))
      .mockResolvedValueOnce(Response.json({ data: { Page: { media: [] } } }))
      .mockResolvedValueOnce(Response.json({ data: { Media: null } }))
      .mockResolvedValueOnce(new Response("Not found", { status: 404 }));
    expect(await client.fetchAnimeFromAniList(1)).toMatchObject({ aniListId: 1, titleNative: "カウボーイビバップ", coverImageUrl: "cover.jpg" });
    expect(await client.searchAnimeOnAniList("none")).toEqual([]);
    expect(await client.fetchAnimeFromAniList(2)).toBeNull();
    expect(await client.fetchAnimeFromAniList(3)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it.each([{}, { Media: {} }, { Media: { ...media, id: 2 } }])("opens the cooldown on unusable or mismatched metadata", async (data) => {
    fetch.mockResolvedValue(Response.json({ data }));
    await expect(client.fetchAnimeFromAniList(1)).rejects.toMatchObject({ statusCode: 503 });
    await expect(client.fetchAnimeFromAniList(1)).rejects.toMatchObject({ statusCode: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([null, "120", "Wed, 09 Sep 2026 12:03:00 GMT"])("bypasses all operations during cooldown and recovers (Retry-After %s)", async (retryAfter) => {
    fetch.mockResolvedValueOnce(new Response("outage", { status: retryAfter ? 429 : 403, headers: retryAfter ? { "retry-after": retryAfter } : {} }));
    await expect(client.fetchAnimeFromAniList(1)).rejects.toThrow();
    await expect(client.searchAnimeOnAniList("Bebop")).rejects.toThrow();
    await expect(client.fetchAnimeFromAniListByMalId(1)).rejects.toThrow();
    await expect(client.fetchAniListCompletedList("public-user")).rejects.toThrow("temporarily unavailable");
    const delay = retryAfter === null ? 60_000 : retryAfter === "120" ? 120_000 : 180_000;
    vi.advanceTimersByTime(delay - 1);
    await expect(client.fetchAnimeFromAniList(1)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    fetch.mockResolvedValue(Response.json({ data: { Media: media } }));
    expect(await client.fetchAnimeFromAniList(1)).toMatchObject({ aniListId: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("lets only one recovery probe through concurrently", async () => {
    fetch.mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(client.fetchAnimeFromAniList(1)).rejects.toThrow();
    vi.advanceTimersByTime(60_000);
    let finish!: (response: Response) => void;
    fetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const recovery = client.fetchAnimeFromAniList(1);
    await expect(client.fetchAnimeFromAniListByMalId(1)).rejects.toThrow();
    finish(Response.json({ data: { Media: media } }));
    await expect(recovery).resolves.toMatchObject({ aniListId: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not let an older successful request clear a newer outage cooldown", async () => {
    let finish!: (response: Response) => void;
    fetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(new Response("outage", { status: 403 }));
    const older = client.fetchAnimeFromAniList(1);
    await expect(client.fetchAnimeFromAniList(2)).rejects.toThrow();
    finish(Response.json({ data: { Media: media } }));
    await expect(older).resolves.toMatchObject({ aniListId: 1 });
    await expect(client.fetchAnimeFromAniList(3)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("accepts AniList's GraphQL not-found error without cooling down", async () => {
    fetch.mockResolvedValueOnce(Response.json({ data: { Media: null }, errors: [{ status: 404, message: "Not Found." }] }))
      .mockResolvedValueOnce(Response.json({ data: { Media: media } }));
    expect(await client.fetchAnimeFromAniList(2)).toBeNull();
    await expect(client.fetchAnimeFromAniList(1)).resolves.toMatchObject({ aniListId: 1 });
  });

  it("does not cool down on validation errors", async () => {
    fetch.mockResolvedValueOnce(Response.json({ errors: [{ extensions: { code: "BAD_USER_INPUT" } }] }))
      .mockResolvedValueOnce(Response.json({ data: { Media: media } }));
    await expect(client.fetchAnimeFromAniList(1)).rejects.toThrow("rejected");
    await expect(client.fetchAnimeFromAniList(1)).resolves.toMatchObject({ aniListId: 1 });
  });

  it("carries idMal through both by-id queries, treating a missing one as null", async () => {
    fetch.mockResolvedValueOnce(Response.json({ data: { Media: { ...media, idMal: 1 } } }))
      .mockResolvedValueOnce(Response.json({ data: { Media: { ...media, idMal: null } } }))
      .mockResolvedValueOnce(Response.json({ data: { Media: media } }));
    expect(await client.fetchAnimeFromAniList(1)).toMatchObject({ malId: 1 });
    expect(await client.fetchAnimeFromAniList(1)).toMatchObject({ malId: null });
    expect(await client.fetchAnimeFromAniListByMalId(1)).toMatchObject({ malId: null });
    const byId = JSON.parse(fetch.mock.calls[0]![1].body).query;
    expect(byId).toContain("Media(id: $id");
    expect(byId).toContain("idMal");
  });

  it.each(["1", 0, -5, 1.5])("refuses %s as an idMal rather than passing on a bad mapping", async (idMal) => {
    fetch.mockResolvedValue(Response.json({ data: { Media: { ...media, idMal } } }));
    await expect(client.fetchAnimeFromAniList(1)).rejects.toMatchObject({ statusCode: 503 });
  });

  it("distinguishes a missing list user from an empty completed list", async () => {
    fetch.mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ data: { MediaListCollection: { lists: [] } } }));
    await expect(client.fetchAniListCompletedList("missing")).rejects.toBeInstanceOf(client.AniListUserNotFoundError);
    expect(await client.fetchAniListCompletedList("empty")).toEqual([]);
  });
});
