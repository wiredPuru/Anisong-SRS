import { vi } from "vitest";

vi.mock("./server/utils/networkMode.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./server/utils/networkMode.ts")>();
  return { ...actual, assertOnline: vi.fn() };
});

// Provider tests mock fetch and must always reach it, never the on-disk cache.
vi.mock("./server/utils/apiCache.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./server/utils/apiCache.ts")>();
  return { ...actual, apiResponseCache: { through: <T>(_p: string, _k: unknown, _t: number, run: () => Promise<T>) => run() } };
});
