import { onMounted } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LISTEN_MIX_CURVE_STORAGE_KEY, LISTEN_MIX_LENGTH_STORAGE_KEY, LISTEN_MIX_STORAGE_KEY } from "../utils/listenMix";
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

describe("useListenMix fade length", () => {
  function lengthStorage(initial: string | null) {
    const values = new Map<string, string>(initial === null ? [] : [[LISTEN_MIX_LENGTH_STORAGE_KEY, initial]]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    };
    vi.stubGlobal("window", { localStorage: storage });
    return { storage, values };
  }

  it("defaults to five seconds and restores a saved option on mount", () => {
    lengthStorage("12");
    const { mix, mount } = setup();
    expect(mix.seconds.value).toBe(5);
    mount();
    expect(mix.seconds.value).toBe(12);
  });

  it("ignores a saved value that is not an option", () => {
    lengthStorage("7");
    const { mix, mount } = setup();
    mount();
    expect(mix.seconds.value).toBe(5);
  });

  it("saves a chosen option and keeps a bad one from being stored", () => {
    const { values } = lengthStorage(null);
    const { mix } = setup();
    mix.setSeconds(8);
    expect(mix.seconds.value).toBe(8);
    expect(values.get(LISTEN_MIX_LENGTH_STORAGE_KEY)).toBe("8");
    mix.setSeconds(30);
    expect(mix.seconds.value).toBe(5);
    expect(values.get(LISTEN_MIX_LENGTH_STORAGE_KEY)).toBe("5");
  });

  it("still changes for the session when storage throws", () => {
    vi.stubGlobal("window", { localStorage: {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    } });
    const { mix, mount } = setup();
    mount();
    mix.setSeconds(2);
    expect(mix.seconds.value).toBe(2);
  });
});

describe("useListenMix fade curve", () => {
  function curveStorage(initial: string | null) {
    const values = new Map<string, string>(initial === null ? [] : [[LISTEN_MIX_CURVE_STORAGE_KEY, initial]]);
    vi.stubGlobal("window", { localStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    } });
    return values;
  }

  it("defaults to Smooth, restores a saved Linear on mount, and ignores junk", () => {
    curveStorage("linear");
    const { mix, mount } = setup();
    expect(mix.curve.value).toBe("smooth");
    mount();
    expect(mix.curve.value).toBe("linear");
    curveStorage("wobbly");
    const second = setup();
    second.mount();
    expect(second.mix.curve.value).toBe("smooth");
  });

  it("saves a choice and treats an unknown choice as Smooth", () => {
    const values = curveStorage(null);
    const { mix } = setup();
    mix.setCurve("linear");
    expect(values.get(LISTEN_MIX_CURVE_STORAGE_KEY)).toBe("linear");
    mix.setCurve("other");
    expect(mix.curve.value).toBe("smooth");
    expect(values.get(LISTEN_MIX_CURVE_STORAGE_KEY)).toBe("smooth");
  });

  it("still changes for the session when storage throws", () => {
    vi.stubGlobal("window", { localStorage: {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    } });
    const { mix, mount } = setup();
    mount();
    mix.setCurve("linear");
    expect(mix.curve.value).toBe("linear");
  });
});
