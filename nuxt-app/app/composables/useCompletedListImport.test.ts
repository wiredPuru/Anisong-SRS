import { effectScope } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCompletedListImport } from "./useCompletedListImport";

afterEach(() => vi.unstubAllGlobals());

const anime = (aniListId: number, titleRomaji: string) => ({ aniListId, titleRomaji, titleEnglish: null, titleNative: null });
const done = (results: ReturnType<typeof anime>[]) => new Response(JSON.stringify({ type: "done", result: { results } }) + "\n");

describe("independent Completed-list sources", () => {
  it("ignores a previous run that finishes after a replacement run", async () => {
    let finishOld!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOld = resolve; }))
      .mockResolvedValueOnce(done([anime(2, "New result")])));
    const scope = effectScope();
    const state = scope.run(useCompletedListImport)!;
    const old = state.run({ aniList: "old", mal: "" });
    await state.run({ aniList: "new", mal: "" });
    finishOld(done([anime(1, "Old result")]));
    await old;
    expect(state.results.value).toEqual([anime(2, "New result")]);
    expect(state.sources.aniList.error).toBeNull();
    scope.stop();
  });

  it("exposes one completed source while the other is pending and preserves it on failure", async () => {
    let failMal!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("anilist-list")
      ? Promise.resolve(done([anime(1, "AniList title")]))
      : new Promise<Response>((resolve) => { failMal = resolve; })));
    const scope = effectScope();
    const state = scope.run(useCompletedListImport)!;
    const pending = state.run({ aniList: "alice", mal: "bob" });
    await vi.waitFor(() => expect(state.sources.aniList.status).toBe("done"));
    expect(state.loading.value).toBe(true);
    expect(state.results.value).toEqual([anime(1, "AniList title")]);
    failMal(new Response('{"type":"error","message":"MAL unavailable"}\n'));
    await pending;
    expect(state.loading.value).toBe(false);
    expect(state.sources.mal.error).toBe("MAL unavailable");
    expect(state.results.value).toEqual([anime(1, "AniList title")]);
    scope.stop();
  });

  it("keeps AniList precedence regardless of arrival order and resets subsequent runs", async () => {
    let finishAniList!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("anilist-list")
      ? new Promise<Response>((resolve) => { finishAniList = resolve; })
      : Promise.resolve(done([anime(1, "MAL title"), anime(2, "MAL only")]))));
    const scope = effectScope();
    const state = scope.run(useCompletedListImport)!;
    const pending = state.run({ aniList: "alice", mal: "bob" });
    await vi.waitFor(() => expect(state.sources.mal.status).toBe("done"));
    finishAniList(done([anime(1, "AniList title")]));
    await pending;
    expect(state.results.value).toEqual([anime(1, "AniList title"), anime(2, "MAL only")]);
    await state.run({ aniList: "", mal: "bob" });
    expect(state.sources.aniList.status).toBe("idle");
    expect(state.results.value).toEqual([anime(1, "MAL title"), anime(2, "MAL only")]);
    scope.stop();
  });
});

describe("outage reporting", () => {
  it("flags an AniList outage while keeping the MyAnimeList results from the same run", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("anilist-list")
      ? Promise.resolve(new Response('{"type":"error","message":"AniList is temporarily unavailable.","unavailable":true}\n'))
      : Promise.resolve(done([anime(1, "MAL title")]))));
    const scope = effectScope();
    const state = scope.run(useCompletedListImport)!;
    await state.run({ aniList: "alice", mal: "bob" });
    expect(state.sources.aniList.unavailable).toBe(true);
    expect(state.sources.mal.unavailable).toBe(false);
    expect(state.results.value).toEqual([anime(1, "MAL title")]);
    scope.stop();
  });

  it("does not flag a failure the user can correct, and clears the flag on the next run", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"type":"error","message":"AniList is temporarily unavailable.","unavailable":true}\n'))
      .mockResolvedValueOnce(new Response('{"type":"error","message":"AniList user not found"}\n'));
    vi.stubGlobal("fetch", fetchMock);
    const scope = effectScope();
    const state = scope.run(useCompletedListImport)!;
    await state.run({ aniList: "alice", mal: "" });
    expect(state.sources.aniList.unavailable).toBe(true);
    await state.run({ aniList: "nobody", mal: "" });
    expect(state.sources.aniList.unavailable).toBe(false);
    expect(state.sources.aniList.error).toBe("AniList user not found");
    scope.stop();
  });
});
