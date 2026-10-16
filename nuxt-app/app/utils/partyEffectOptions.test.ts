import { describe, expect, it } from "vitest";
import {
  EFFECT_OPTIONS, NO_EFFECTS, addPreset, isPlain, optionsIn, parsePresets, removePreset, setRandom, toggleOption,
} from "./partyEffectOptions";

const option = (id: string) => EFFECT_OPTIONS.find((o) => o.id === id)!;

describe("effect options", () => {
  it("groups blur, pixelate and bubbles apart from music and mute", () => {
    expect(optionsIn("effects").map((o) => o.id)).toEqual(["blur", "pixelate", "bubbles"]);
    expect(optionsIn("playback").map((o) => o.id)).toEqual(["music", "muted"]);
  });

  it("toggles on and back to plain", () => {
    const on = toggleOption(NO_EFFECTS, option("blur"));
    expect(option("blur").on(on)).toBe(true);
    expect(isPlain(toggleOption(on, option("blur")))).toBe(true);
  });

  it("random flags the effects and clears the picks, leaving playback alone", () => {
    const out = setRandom({ ...NO_EFFECTS, blur: 40, muted: true }, true);
    expect(out.random).toBe(true);
    expect(optionsIn("effects").some((o) => o.on(out))).toBe(false);
    expect(out.muted).toBe(true);
    expect(isPlain(setRandom(out, false))).toBe(false);
    expect(setRandom(out, false).random).toBeUndefined();
  });

  it("picking an effect drops random", () => {
    const out = toggleOption(setRandom(NO_EFFECTS, true), option("blur"));
    expect(out.random).toBeUndefined();
    expect(option("blur").on(out)).toBe(true);
  });
});

describe("presets", () => {
  it("ignores malformed storage", () => {
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets("{")).toEqual([]);
    expect(parsePresets('[{"name":""},5]')).toEqual([]);
  });

  it("adds, replaces by name and removes", () => {
    const a = { name: "Blurry", effects: { ...NO_EFFECTS, blur: 40 } };
    let list = addPreset([], a);
    list = addPreset(list, { ...a, effects: setRandom(NO_EFFECTS, true) });
    expect(list).toHaveLength(1);
    expect(list[0]!.effects.random).toBe(true);
    expect(removePreset(list, "Blurry")).toEqual([]);
    expect(parsePresets(JSON.stringify(list))).toEqual(list);
  });
});
