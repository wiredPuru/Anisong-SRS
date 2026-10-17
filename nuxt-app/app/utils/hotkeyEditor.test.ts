import { describe, expect, it } from "vitest";
import { captureKey, describeBindingFailure, hotkeyGroups } from "./hotkeyEditor.ts";
import { applyBinding, HOTKEY_ACTIONS, resolveBindings } from "./hotkeys.ts";

function press(key: string, extra: Partial<Parameters<typeof captureKey>[0]> = {}) {
  return captureKey({ key, ctrlKey: false, metaKey: false, altKey: false, ...extra });
}

describe("captureKey", () => {
  it("returns a plain key normalised", () => {
    expect(press("X")).toEqual({ kind: "key", key: "x" });
    expect(press(" ")).toEqual({ kind: "key", key: "space" });
    expect(press("ArrowLeft")).toEqual({ kind: "key", key: "arrowleft" });
  });

  it("cancels on Escape and clears on Backspace or Delete", () => {
    expect(press("Escape")).toEqual({ kind: "cancel" });
    expect(press("Backspace")).toEqual({ kind: "clear" });
    expect(press("Delete")).toEqual({ kind: "clear" });
  });

  it.each(["Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph", "Dead", "Process", "Unidentified"])(
    "ignores %s on its own",
    (key) => {
      expect(press(key)).toEqual({ kind: "ignore" });
    },
  );

  it("ignores a repeat and an IME key", () => {
    expect(press("Enter", { repeat: true })).toEqual({ kind: "ignore" });
    expect(press("a", { isComposing: true })).toEqual({ kind: "ignore" });
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])("refuses a key with %o held", (mods) => {
    expect(press("k", mods)).toEqual({ kind: "rejected", message: "Plain keys only: hold no Ctrl, Cmd or Alt." });
  });

  it("still lets Escape cancel while a modifier is held", () => {
    expect(press("Escape", { ctrlKey: true })).toEqual({ kind: "cancel" });
  });

  it("hands Enter and Tab on, so the registry explains why they are reserved", () => {
    expect(press("Enter")).toEqual({ kind: "key", key: "enter" });
    expect(press("Tab")).toEqual({ kind: "key", key: "tab" });
  });

  it("ignores an empty key", () => {
    expect(press("")).toEqual({ kind: "ignore" });
  });
});

describe("describeBindingFailure", () => {
  const defaults = resolveBindings();

  function failure(id: Parameters<typeof applyBinding>[1], slot: "primary" | "alternate", key: string) {
    const result = applyBinding(defaults, id, slot, key);
    if (result.ok) throw new Error("expected a failure");
    return result;
  }

  it("names the action that holds the key", () => {
    expect(describeBindingFailure(failure("hideVideo", "primary", "c"), "c")).toBe(
      "C is already used by Hide cover. Change or clear that one first.",
    );
  });

  it("shows keys the way tooltips do", () => {
    expect(describeBindingFailure(failure("hideVideo", "primary", "space"), "space")).toBe(
      "Space is already used by Play / pause. Change or clear that one first.",
    );
  });

  it("explains a reserved key", () => {
    expect(describeBindingFailure(failure("hideVideo", "primary", "enter"), "enter")).toBe(
      "Enter can't be used: Enter, Escape and Tab keep their usual jobs.",
    );
  });

  it("explains the same key in both slots", () => {
    expect(describeBindingFailure(failure("playPause", "alternate", "space"), "space")).toBe(
      "Primary and alternate must be different keys.",
    );
  });
});

describe("hotkeyGroups", () => {
  const groups = hotkeyGroups();

  it("lists every action exactly once", () => {
    const ids = groups.flatMap((g) => g.actions.map((a) => a.id));
    expect(ids.sort()).toEqual(HOTKEY_ACTIONS.map((a) => a.id).sort());
  });

  it("orders the groups from widest to narrowest and has no 'other' group", () => {
    expect(groups.map((g) => g.label)).toEqual([
      "Everywhere",
      "Study and Listen",
      "Study only",
      "Listen only",
      "Cards and Preview",
    ]);
  });

  it("puts each action in the group that matches its pages", () => {
    const by = Object.fromEntries(groups.map((g) => [g.label, g.actions.map((a) => a.id)]));
    expect(by["Everywhere"]).toEqual(["playPause"]);
    expect(by["Study and Listen"]).toEqual(["hideVideo", "hideCover", "hideInfo", "ambient", "flipCard", "flipJapanese"]);
    expect(by["Listen only"]).toEqual(["reveal", "listenNext", "listenPrevious"]);
    expect(by["Cards and Preview"]).toEqual(["expand"]);
  });
});
