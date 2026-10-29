import { onMounted } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LISTEN_MIX_STORAGE_KEY } from "../utils/listenMix";
import { useListenMix } from "./useListenMix";

vi.mock("vue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue")>();
  return { ...actual, onMounted: vi.fn() };
});

function setup() {
  const mix = useListenMix();
  const mount = vi.mocked(onMounted).mock.calls.at(-1)?.[0];
  expect(mount).toBeDefined();
  return { mix, mount: () => mount?.() };
}

function storedPreference(initial: string | null = null) {
  let stored = initial;
  const storage = {
    getItem: vi.fn((key: string) => key === LISTEN_MIX_STORAGE_KEY ? stored : null),
    setItem: vi.fn((key: string, value: string) => {
      if (key === LISTEN_MIX_STORAGE_KEY) stored = value;
    }),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("useListenMix preference", () => {
  it("stays off until mount without reading or overwriting saved storage", () => {
    const storage = storedPreference("1");
    const { mix, mount } = setup();
    expect(mix.enabled.value).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    mount();
    expect(mix.enabled.value).toBe(true);
    expect(storage.getItem).toHaveBeenCalledWith(LISTEN_MIX_STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("defaults off for a new browser and persists user changes across visits", () => {
    const storage = storedPreference();
    const first = setup();
    first.mount();
    expect(first.mix.enabled.value).toBe(false);
    first.mix.toggle();
    expect(first.mix.enabled.value).toBe(true);
    expect(storage.setItem).toHaveBeenLastCalledWith(LISTEN_MIX_STORAGE_KEY, "1");
    const second = setup();
    second.mount();
    expect(second.mix.enabled.value).toBe(true);
    second.mix.setEnabled(false);
    expect(storage.setItem).toHaveBeenLastCalledWith(LISTEN_MIX_STORAGE_KEY, "0");
    const third = setup();
    third.mount();
    expect(third.mix.enabled.value).toBe(false);
  });

  it("keeps session toggles usable when accessing localStorage throws", () => {
    vi.stubGlobal("window", { get localStorage(): Storage { throw new Error("Storage denied"); } });
    const { mix, mount } = setup();
    expect(() => mount()).not.toThrow();
    expect(mix.enabled.value).toBe(false);
    expect(() => mix.toggle()).not.toThrow();
    expect(mix.enabled.value).toBe(true);
    mix.toggle();
    expect(mix.enabled.value).toBe(false);
  });

  it("retains a saved choice if later writes fail", () => {
    const storage = storedPreference("1");
    storage.setItem.mockImplementation(() => { throw new Error("Storage full"); });
    const { mix, mount } = setup();
    mount();
    expect(mix.enabled.value).toBe(true);
    expect(() => mix.setEnabled(false)).not.toThrow();
    expect(mix.enabled.value).toBe(false);
    mix.toggle();
    expect(mix.enabled.value).toBe(true);
  });

  it("does not require browser globals during server setup", () => {
    vi.stubGlobal("window", undefined);
    const { mix } = setup();
    expect(mix.enabled.value).toBe(false);
    expect(() => mix.setEnabled(true)).not.toThrow();
    expect(mix.enabled.value).toBe(true);
  });
});
