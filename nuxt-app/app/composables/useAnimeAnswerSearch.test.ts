import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useAnimeAnswerSearch, type AnimeAnswerOption } from "./useAnimeAnswerSearch";

const option = (id: number): AnimeAnswerOption => ({ aniListId: id, titleEnglish: `Anime ${id}`, titleRomaji: `Anime ${id}`, titleNative: null });
const scopes: ReturnType<typeof effectScope>[] = [];
function setup(search: (q: string) => Promise<AnimeAnswerOption[]>) {
  vi.useFakeTimers();
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useAnimeAnswerSearch(search))!;
}
afterEach(() => { scopes.splice(0).forEach((scope) => scope.stop()); vi.useRealTimers(); });

describe("anime answer search", () => {
  it("debounces, trims, and reuses cached queries", async () => {
    const search = vi.fn(async () => [option(1)]);
    const state = setup(search);
    state.update("a");
    await vi.advanceTimersByTimeAsync(300);
    expect(search).not.toHaveBeenCalled();
    state.update("ab");
    await vi.advanceTimersByTimeAsync(200);
    state.update(" abc ");
    await vi.advanceTimersByTimeAsync(249);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledExactlyOnceWith("abc");
    state.update("abc");
    expect(state.results.value).toEqual([option(1)]);
    expect(state.loading.value).toBe(false);
  });

  it("ignores old completions after a new query or reset", async () => {
    const pending: ((value: AnimeAnswerOption[]) => void)[] = [];
    const state = setup(() => new Promise((resolve) => pending.push(resolve)));
    state.update("old"); await vi.advanceTimersByTimeAsync(250);
    state.update("new"); await vi.advanceTimersByTimeAsync(250);
    pending[1]!([option(2)]); await Promise.resolve();
    pending[0]!([option(1)]); await Promise.resolve();
    expect(state.results.value).toEqual([option(2)]);
    state.update("last"); await vi.advanceTimersByTimeAsync(250);
    state.reset(); pending[2]!([option(3)]); await Promise.resolve();
    expect(state.results.value).toEqual([]);
    expect(state.loading.value).toBe(false);
  });

  it("deduplicates identities, rejects invalid IDs, and limits results", async () => {
    const state = setup(async () => [option(0), option(1), ...Array.from({ length: 15 }, (_, i) => option(i + 1))]);
    state.update("anime"); await vi.advanceTimersByTimeAsync(250);
    expect(state.results.value.map((item) => item.aniListId)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  });

  it("shows failure without results and allows retry", async () => {
    const search = vi.fn<() => Promise<AnimeAnswerOption[]>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    const state = setup(search);
    state.update("anime"); await vi.advanceTimersByTimeAsync(250);
    expect(state.error.value).toContain("unavailable");
    expect(state.results.value).toEqual([]);
    expect(state.loading.value).toBe(false);
    state.update("anime"); await vi.advanceTimersByTimeAsync(250);
    expect(state.error.value).toBeNull();
  });
});
