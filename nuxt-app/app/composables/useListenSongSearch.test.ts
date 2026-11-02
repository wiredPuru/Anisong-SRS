import { effectScope, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardWithDetails } from "./useStudySession";
import type { ListenCatalogSong } from "../utils/listenRequests";
import type { NetworkMode } from "../utils/networkMode";
import { useListenSongSearch } from "./useListenSongSearch";

const card = (id: number) => ({ id } as CardWithDetails);
const song = (id: number) => ({ resultKey: `adb:${id}`, animeAniListId: 1, themeSlot: "OP1" } as ListenCatalogSong);
const reply = (ids = [1], page = 1, totalPages = 1) => ({ cards: ids.map(card), page, totalPages, total: 4 });
const scopes: ReturnType<typeof effectScope>[] = [];
function setup(mode: NetworkMode = false) {
  vi.useFakeTimers();
  const offline = ref<NetworkMode>(mode);
  const library = vi.fn(async (_q: string, _page: number) => reply());
  const catalog = vi.fn(async (_q: string) => ({ results: [song(10)] }));
  const scope = effectScope(); scopes.push(scope);
  const state = scope.run(() => useListenSongSearch(offline, { library, catalog }))!;
  return { state, library, catalog, offline, scope };
}
afterEach(() => { scopes.splice(0).forEach((scope) => scope.stop()); vi.useRealTimers(); });

describe("Listen library and catalog search", () => {
  it("debounces two-character queries and searches both sources independently", async () => {
    const { state, library, catalog } = setup();
    state.query.value = "a"; await vi.advanceTimersByTimeAsync(300);
    expect(library).not.toHaveBeenCalled(); expect(catalog).not.toHaveBeenCalled();
    state.query.value = "ab"; await vi.advanceTimersByTimeAsync(100);
    state.query.value = "  song  "; await vi.advanceTimersByTimeAsync(249);
    expect(library).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(library).toHaveBeenCalledExactlyOnceWith("song", 1);
    expect(catalog).toHaveBeenCalledExactlyOnceWith("song");
    expect(state.library.value[0]?.key).toBe("card:1");
    expect(state.catalog.value[0]?.key).toBe("catalog:adb:10:1:OP1");
  });

  it("does not let an old query or clear repopulate current results", async () => {
    const { state, library } = setup();
    let resolve!: (value: ReturnType<typeof reply>) => void;
    library.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    state.query.value = "old"; await vi.advanceTimersByTimeAsync(250);
    state.query.value = "new"; await vi.advanceTimersByTimeAsync(250);
    resolve(reply([99])); await Promise.resolve();
    expect(state.library.value.map((track) => track.key)).toEqual(["card:1"]);
    state.query.value = "";
    expect(state.library.value).toEqual([]);
    expect(state.catalog.value).toEqual([]);
    expect(state.libraryLoading.value).toBe(false);
  });

  it("preserves library results when catalog search fails and supports retry", async () => {
    const { state, catalog } = setup();
    catalog.mockRejectedValueOnce(new Error("provider unavailable"));
    state.query.value = "song"; await vi.advanceTimersByTimeAsync(250);
    expect(state.library.value).toHaveLength(1);
    expect(state.catalogError.value).toContain("online catalog");
    expect(state.libraryError.value).toBeNull();
    await state.retryCatalog();
    expect(state.catalog.value).toHaveLength(1);
    expect(state.catalogError.value).toBeNull();
  });

  it("preserves catalog results when local search fails", async () => {
    const { state, library } = setup();
    library.mockRejectedValueOnce(new Error("database busy"));
    state.query.value = "song"; await vi.advanceTimersByTimeAsync(250);
    expect(state.catalog.value).toHaveLength(1);
    expect(state.libraryError.value).toContain("library");
    await state.retryLibrary();
    expect(state.library.value).toHaveLength(1);
  });

  it("paginates locally without repeating catalog requests and retains results on page failure", async () => {
    const { state, library, catalog } = setup();
    library.mockResolvedValueOnce(reply([1, 2], 1, 2));
    state.query.value = "song"; await vi.advanceTimersByTimeAsync(250);
    library.mockRejectedValueOnce(new Error("failed page"));
    await state.loadMore();
    expect(state.library.value).toHaveLength(2);
    library.mockResolvedValueOnce(reply([2, 3], 2, 2));
    await state.retryLibrary();
    expect(library).toHaveBeenLastCalledWith("song", 2);
    expect(state.library.value.map((track) => track.key)).toEqual(["card:1", "card:2", "card:3"]);
    expect(state.hasMore.value).toBe(false);
    expect(catalog).toHaveBeenCalledOnce();
  });

  it("does not search catalog while offline or while mode is unknown", async () => {
    for (const mode of [true, null]) {
      const { state, library, catalog } = setup(mode);
      state.query.value = "song"; await vi.advanceTimersByTimeAsync(250);
      expect(library).toHaveBeenCalledOnce();
      expect(catalog).not.toHaveBeenCalled();
      expect(state.onlineOnly.value).toBe(mode === true);
      expect(state.catalogLoading.value).toBe(false);
    }
  });

  it("rejects an in-flight catalog response after switching offline", async () => {
    const { state, catalog, offline } = setup();
    let resolve!: (value: { results: ListenCatalogSong[] }) => void;
    catalog.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    state.query.value = "song"; await vi.advanceTimersByTimeAsync(250);
    offline.value = true;
    resolve({ results: [song(99)] }); await vi.advanceTimersByTimeAsync(250);
    expect(state.catalog.value).toEqual([]);
    expect(state.onlineOnly.value).toBe(true);
    expect(state.library.value).toHaveLength(1);
  });

  it("distinguishes an Offline response and ignores work after disposal", async () => {
    const { state, catalog, scope } = setup();
    catalog.mockRejectedValueOnce({ data: { data: { code: "OFFLINE_MODE" } } });
    state.query.value = "song"; await vi.advanceTimersByTimeAsync(250);
    expect(state.onlineOnly.value).toBe(true);
    expect(state.catalogError.value).toBeNull();
    state.query.value = "another";
    scope.stop(); await vi.advanceTimersByTimeAsync(250);
    expect(catalog).toHaveBeenCalledOnce();
  });
});
