import { describe, expect, it } from "vitest";
import {
  actionForEvent,
  applyBinding,
  eventKey,
  formatKey,
  HOTKEY_ACTIONS,
  hotkeyHint,
  normalizeKey,
  parseStored,
  resetBinding,
  resolveBindings,
  serializeOverrides,
  validateBinding,
  type HotkeyActionId,
} from "./hotkeys.ts";

function keyEvent(key: string, mods: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...mods };
}

describe("HOTKEY_ACTIONS defaults", () => {
  // These are the keys the pages hard-code today (Space is the new addition).
  const TODAY: Record<HotkeyActionId, [string, string | null]> = {
    playPause: ["space", "s"],
    hideVideo: ["v", null],
    hideCover: ["c", null],
    hideInfo: ["i", null],
    ambient: ["a", null],
    flipCard: ["d", null],
    previousCard: ["p", null],
    sessionLog: ["l", null],
    editCard: ["e", null],
    undo: ["u", null],
    pass: ["arrowright", null],
    fail: ["arrowleft", null],
    reveal: ["r", null],
    listenNext: ["arrowright", null],
    listenPrevious: ["arrowleft", null],
    expand: ["f", null],
  };

  it("pins every default to the key in use today", () => {
    for (const action of HOTKEY_ACTIONS) {
      expect([action.defaults.primary, action.defaults.alternate], action.id).toEqual(TODAY[action.id]);
    }
  });

  it("lists each action exactly once", () => {
    const ids = HOTKEY_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(Object.keys(TODAY).length);
  });

  it("gives every action at least one scope", () => {
    for (const action of HOTKEY_ACTIONS) expect(action.scopes.length, action.id).toBeGreaterThan(0);
  });

  it("has every default stored in its normalised form", () => {
    for (const { defaults } of HOTKEY_ACTIONS) {
      expect(normalizeKey(defaults.primary)).toBe(defaults.primary);
      if (defaults.alternate) expect(normalizeKey(defaults.alternate)).toBe(defaults.alternate);
    }
  });
});

describe("normalizeKey", () => {
  it("names the spacebar", () => {
    expect(normalizeKey(" ")).toBe("space");
  });

  it("lowercases letters so Shift does not matter", () => {
    expect(normalizeKey("S")).toBe("s");
  });

  it("lowercases named keys", () => {
    expect(normalizeKey("ArrowLeft")).toBe("arrowleft");
  });

  it("keeps symbols as typed", () => {
    expect(normalizeKey("?")).toBe("?");
  });

  it("returns null for an empty key", () => {
    expect(normalizeKey("")).toBeNull();
  });
});

describe("eventKey", () => {
  it("normalises a plain key press", () => {
    expect(eventKey(keyEvent(" "))).toBe("space");
    expect(eventKey(keyEvent("V"))).toBe("v");
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])("ignores a combo with %o held", (mods) => {
    expect(eventKey(keyEvent("s", mods))).toBeNull();
  });
});

describe("formatKey", () => {
  it("spells out the spacebar", () => {
    expect(formatKey("space")).toBe("Space");
  });

  it("draws arrows", () => {
    expect(formatKey("arrowleft")).toBe("←");
    expect(formatKey("arrowright")).toBe("→");
    expect(formatKey("arrowup")).toBe("↑");
    expect(formatKey("arrowdown")).toBe("↓");
  });

  it("uppercases a single character", () => {
    expect(formatKey("s")).toBe("S");
    expect(formatKey("?")).toBe("?");
  });

  it("capitalises other named keys", () => {
    expect(formatKey("backspace")).toBe("Backspace");
    expect(formatKey("f5")).toBe("F5");
  });
});

describe("resolveBindings", () => {
  it("starts from the defaults", () => {
    const bindings = resolveBindings();
    expect(bindings.playPause).toEqual({ primary: "space", alternate: "s" });
    expect(bindings.hideVideo).toEqual({ primary: "v", alternate: null });
  });

  it("lets an override replace one action only", () => {
    const bindings = resolveBindings({ hideVideo: { primary: "x", alternate: null } });
    expect(bindings.hideVideo.primary).toBe("x");
    expect(bindings.hideCover.primary).toBe("c");
  });

  it("does not let callers mutate the shared defaults", () => {
    const bindings = resolveBindings();
    bindings.undo.primary = "z";
    expect(resolveBindings().undo.primary).toBe("u");
  });
});

describe("validateBinding", () => {
  const defaults = resolveBindings();

  it("accepts a free key", () => {
    expect(validateBinding(defaults, "hideVideo", "primary", "x")).toEqual({ ok: true });
  });

  it.each(["enter", "escape", "tab", "shift", "control", "dead", "process"])("refuses reserved key %s", (key) => {
    expect(validateBinding(defaults, "hideVideo", "primary", key)).toEqual({ ok: false, reason: "reserved" });
  });

  it("refuses a key another action on the same page holds", () => {
    expect(validateBinding(defaults, "hideVideo", "primary", "c")).toEqual({
      ok: false,
      reason: "conflict",
      conflictsWith: "hideCover",
    });
  });

  it("refuses a key held as another action's alternate", () => {
    expect(validateBinding(defaults, "hideVideo", "primary", "s")).toEqual({
      ok: false,
      reason: "conflict",
      conflictsWith: "playPause",
    });
  });

  it("refuses a key on any page when play/pause spans all of them", () => {
    expect(validateBinding(defaults, "reveal", "primary", "space")).toEqual({
      ok: false,
      reason: "conflict",
      conflictsWith: "playPause",
    });
    expect(validateBinding(defaults, "expand", "primary", "space")).toMatchObject({ reason: "conflict" });
  });

  it("allows reusing a key across pages that never overlap", () => {
    expect(validateBinding(defaults, "reveal", "primary", "p")).toEqual({ ok: true });
    expect(validateBinding(defaults, "expand", "primary", "v")).toEqual({ ok: true });
  });

  it("refuses the same key in both slots of one action", () => {
    expect(validateBinding(defaults, "playPause", "alternate", "space")).toEqual({ ok: false, reason: "duplicate" });
  });

  it("lets an action keep its own key", () => {
    expect(validateBinding(defaults, "hideVideo", "alternate", "x")).toEqual({ ok: true });
  });

  it("has no conflicts between the shipped defaults", () => {
    const keys = new Map<string, string>();
    for (const a of HOTKEY_ACTIONS) {
      for (const scope of a.scopes) {
        for (const key of [a.defaults.primary, a.defaults.alternate]) {
          if (!key) continue;
          const slot = `${scope}:${key}`;
          expect(keys.has(slot), `${slot} used by ${keys.get(slot)} and ${a.id}`).toBe(false);
          keys.set(slot, a.id);
        }
      }
    }
  });
});

describe("applyBinding", () => {
  const defaults = resolveBindings();

  it("sets a slot without touching the input", () => {
    const result = applyBinding(defaults, "hideVideo", "primary", "x");
    expect(result.ok && result.bindings.hideVideo.primary).toBe("x");
    expect(defaults.hideVideo.primary).toBe("v");
  });

  it("refuses a taken key instead of stealing it", () => {
    const result = applyBinding(defaults, "hideVideo", "primary", "c");
    expect(result).toMatchObject({ ok: false, reason: "conflict", conflictsWith: "hideCover" });
  });

  it("clears the alternate", () => {
    const result = applyBinding(defaults, "playPause", "alternate", null);
    expect(result.ok && result.bindings.playPause).toEqual({ primary: "space", alternate: null });
  });

  it("allows clearing the primary, leaving the action unbound", () => {
    const result = applyBinding(defaults, "hideVideo", "primary", null);
    expect(result.ok && result.bindings.hideVideo).toEqual({ primary: null, alternate: null });
  });

  it("frees a key once its holder gives it up", () => {
    const freed = applyBinding(defaults, "hideCover", "primary", "x");
    if (!freed.ok) throw new Error("expected ok");
    expect(applyBinding(freed.bindings, "hideVideo", "primary", "c").ok).toBe(true);
  });
});

describe("serializeOverrides and parseStored", () => {
  const defaults = resolveBindings();

  it("stores nothing but changes", () => {
    expect(JSON.parse(serializeOverrides(defaults))).toEqual({ v: 1, overrides: {} });
    const changed = applyBinding(defaults, "hideVideo", "primary", "x");
    if (!changed.ok) throw new Error("expected ok");
    expect(JSON.parse(serializeOverrides(changed.bindings))).toEqual({
      v: 1,
      overrides: { hideVideo: { primary: "x", alternate: null } },
    });
  });

  it("round-trips custom bindings, including a cleared alternate and an unbound action", () => {
    let bindings = defaults;
    for (const [id, slot, key] of [
      ["hideVideo", "primary", "x"],
      ["playPause", "alternate", null],
      ["undo", "primary", null],
    ] as const) {
      const result = applyBinding(bindings, id, slot, key);
      if (!result.ok) throw new Error("expected ok");
      bindings = result.bindings;
    }
    expect(parseStored(serializeOverrides(bindings))).toEqual(bindings);
  });

  it("round-trips two actions swapping keys", () => {
    const swapped = resolveBindings({
      hideVideo: { primary: "c", alternate: null },
      hideCover: { primary: "v", alternate: null },
    });
    expect(parseStored(serializeOverrides(swapped))).toEqual(swapped);
  });

  it("uses defaults when nothing is saved", () => {
    expect(parseStored(null)).toEqual(defaults);
    expect(parseStored("")).toEqual(defaults);
  });

  it("uses defaults for corrupt JSON", () => {
    expect(parseStored("{not json")).toEqual(defaults);
  });

  it.each(["null", "5", "[]", '"x"', '{"v":2,"overrides":{}}', '{"v":1}', '{"v":1,"overrides":null}'])(
    "uses defaults for unusable payload %s",
    (raw) => {
      expect(parseStored(raw)).toEqual(defaults);
    },
  );

  it("drops one bad override and keeps the rest", () => {
    const raw = JSON.stringify({
      v: 1,
      overrides: {
        hideVideo: { primary: "x", alternate: null },
        hideCover: { primary: "enter", alternate: null },
        nonsense: { primary: "q", alternate: null },
        undo: { primary: 5, alternate: null },
      },
    });
    const bindings = parseStored(raw);
    expect(bindings.hideVideo.primary).toBe("x");
    expect(bindings.hideCover.primary).toBe("c");
    expect(bindings.undo.primary).toBe("u");
  });

  it("drops an override with the same key in both slots", () => {
    const raw = JSON.stringify({ v: 1, overrides: { hideVideo: { primary: "x", alternate: "x" } } });
    expect(parseStored(raw).hideVideo).toEqual({ primary: "v", alternate: null });
  });

  it("normalises a stored key", () => {
    const raw = JSON.stringify({ v: 1, overrides: { hideVideo: { primary: "X", alternate: null } } });
    expect(parseStored(raw).hideVideo.primary).toBe("x");
  });

  it("puts a conflicting override back to its default", () => {
    // "c" is hideCover's default, so the saved hideVideo override cannot stand.
    const raw = JSON.stringify({ v: 1, overrides: { hideVideo: { primary: "c", alternate: null } } });
    const bindings = parseStored(raw);
    expect(bindings.hideVideo.primary).toBe("v");
    expect(bindings.hideCover.primary).toBe("c");
  });

  it("keeps the earlier override when two saved ones collide", () => {
    const raw = JSON.stringify({
      v: 1,
      overrides: {
        hideVideo: { primary: "x", alternate: null },
        hideInfo: { primary: "x", alternate: null },
      },
    });
    const bindings = parseStored(raw);
    expect(bindings.hideVideo.primary).toBe("x");
    expect(bindings.hideInfo.primary).toBe("i");
  });

  it("never returns bindings that conflict, whatever was saved", () => {
    const raw = JSON.stringify({
      v: 1,
      overrides: {
        playPause: { primary: "v", alternate: "c" },
        hideVideo: { primary: "c", alternate: "a" },
        pass: { primary: "arrowleft", alternate: null },
      },
    });
    const bindings = parseStored(raw);
    for (const a of HOTKEY_ACTIONS) {
      for (const slot of ["primary", "alternate"] as const) {
        const key = bindings[a.id][slot];
        if (key) expect(validateBinding({ ...bindings, [a.id]: { ...bindings[a.id], [slot]: null } }, a.id, slot, key).ok, `${a.id}.${slot}`).toBe(true);
      }
    }
  });
});

describe("actionForEvent", () => {
  const defaults = resolveBindings();

  it("finds an action by its primary or alternate key", () => {
    expect(actionForEvent(defaults, "study", keyEvent(" "))).toBe("playPause");
    expect(actionForEvent(defaults, "study", keyEvent("S"))).toBe("playPause");
    expect(actionForEvent(defaults, "study", keyEvent("v"))).toBe("hideVideo");
  });

  it("resolves the same key per page", () => {
    expect(actionForEvent(defaults, "study", keyEvent("ArrowRight"))).toBe("pass");
    expect(actionForEvent(defaults, "listen", keyEvent("ArrowRight"))).toBe("listenNext");
    expect(actionForEvent(defaults, "preview", keyEvent("ArrowRight"))).toBeNull();
  });

  it("ignores actions that do not exist on the page", () => {
    expect(actionForEvent(defaults, "listen", keyEvent("u"))).toBeNull();
    expect(actionForEvent(defaults, "study", keyEvent("f"))).toBeNull();
    expect(actionForEvent(defaults, "preview", keyEvent("f"))).toBe("expand");
  });

  it("ignores a combo and an unbound key", () => {
    expect(actionForEvent(defaults, "study", keyEvent("s", { metaKey: true }))).toBeNull();
    expect(actionForEvent(defaults, "study", keyEvent("z"))).toBeNull();
  });

  it("follows a rebind", () => {
    const rebound = applyBinding(defaults, "hideVideo", "primary", "x");
    if (!rebound.ok) throw new Error("expected ok");
    expect(actionForEvent(rebound.bindings, "study", keyEvent("x"))).toBe("hideVideo");
    expect(actionForEvent(rebound.bindings, "study", keyEvent("v"))).toBeNull();
  });
});

describe("hotkeyHint", () => {
  const defaults = resolveBindings();

  it("joins both keys", () => {
    expect(hotkeyHint(defaults, "playPause")).toBe("Space / S");
  });

  it("shows one key", () => {
    expect(hotkeyHint(defaults, "hideVideo")).toBe("V");
    expect(hotkeyHint(defaults, "pass")).toBe("→");
  });

  it("is empty when unbound", () => {
    const cleared = applyBinding(defaults, "hideVideo", "primary", null);
    if (!cleared.ok) throw new Error("expected ok");
    expect(hotkeyHint(cleared.bindings, "hideVideo")).toBe("");
  });

  it("shows a lone alternate", () => {
    const cleared = applyBinding(defaults, "playPause", "primary", null);
    if (!cleared.ok) throw new Error("expected ok");
    expect(hotkeyHint(cleared.bindings, "playPause")).toBe("S");
  });
});

describe("resetBinding", () => {
  const defaults = resolveBindings();

  it("restores both default keys", () => {
    const moved = resolveBindings({ playPause: { primary: "x", alternate: null } });
    const result = resetBinding(moved, "playPause");
    expect(result.ok && result.bindings.playPause).toEqual({ primary: "space", alternate: "s" });
  });

  it("is a no-op on an untouched action", () => {
    const result = resetBinding(defaults, "hideVideo");
    expect(result.ok && result.bindings).toEqual(defaults);
  });

  it("is refused when another action now holds the default key", () => {
    const moved = resolveBindings({
      hideVideo: { primary: "x", alternate: null },
      hideCover: { primary: "v", alternate: null },
    });
    expect(resetBinding(moved, "hideVideo")).toEqual({ ok: false, reason: "conflict", conflictsWith: "hideCover" });
  });

  it("does not change the input", () => {
    const moved = resolveBindings({ hideVideo: { primary: "x", alternate: null } });
    resetBinding(moved, "hideVideo");
    expect(moved.hideVideo.primary).toBe("x");
  });
});
