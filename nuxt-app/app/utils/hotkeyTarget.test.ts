import { describe, expect, it } from "vitest";
import { spaceYieldsToTarget, typedGiveUpApplies, type HotkeyTargetLike } from "./hotkeyTarget.ts";

function target(tagName: string, attrs: Record<string, string> = {}, inDialog = false): HotkeyTargetLike {
  return {
    tagName,
    getAttribute: (name) => attrs[name] ?? null,
    closest: () => (inDialog ? {} : null),
  };
}

describe("spaceYieldsToTarget", () => {
  it("acts when nothing is focused", () => {
    expect(spaceYieldsToTarget("study", null)).toBe(false);
    expect(spaceYieldsToTarget("preview", null)).toBe(false);
  });

  it.each(["BODY", "DIV", "MAIN", "VIDEO", "SPAN"])("acts on a non-interactive %s", (tag) => {
    for (const scope of ["study", "listen", "preview"] as const) {
      expect(spaceYieldsToTarget(scope, target(tag))).toBe(false);
    }
  });

  it.each(["study", "listen"] as const)("claims Space from a page-level button on %s", (scope) => {
    expect(spaceYieldsToTarget(scope, target("BUTTON"))).toBe(false);
  });

  it.each([
    ["a button", target("BUTTON")],
    ["a summary", target("SUMMARY")],
    ["a select", target("SELECT")],
    ["a linked anchor", target("A", { href: "/x" })],
    ["role=button", target("DIV", { role: "button" })],
    ["role=switch", target("DIV", { role: "switch" })],
    ["role=checkbox", target("SPAN", { role: "checkbox" })],
    ["role=tab", target("DIV", { role: "tab" })],
    ["role=menuitem", target("DIV", { role: "menuitem" })],
    ["role=option", target("LI", { role: "option" })],
    ["role=radio", target("DIV", { role: "radio" })],
    ["role=link", target("SPAN", { role: "link" })],
  ])("claims Space from %s on Study and Listen", (_name, el) => {
    expect(spaceYieldsToTarget("study", el)).toBe(false);
    expect(spaceYieldsToTarget("listen", el)).toBe(false);
  });

  it.each([
    ["a button", target("BUTTON", {}, true)],
    ["a select", target("SELECT", {}, true)],
    ["role=switch", target("DIV", { role: "switch" }, true)],
  ])("yields %s inside a dialog on every page", (_name, el) => {
    for (const scope of ["study", "listen", "preview"] as const) {
      expect(spaceYieldsToTarget(scope, el)).toBe(true);
    }
  });

  it("yields a control on the preview page even outside a dialog", () => {
    expect(spaceYieldsToTarget("preview", target("BUTTON"))).toBe(true);
    expect(spaceYieldsToTarget("preview", target("DIV", { role: "button" }))).toBe(true);
  });

  it("claims Space from a control behind an open dialog on the preview page", () => {
    expect(spaceYieldsToTarget("preview", target("BUTTON"), true)).toBe(false);
    expect(spaceYieldsToTarget("preview", target("DIV", { role: "button" }), true)).toBe(false);
  });

  it("still yields a control inside the open dialog", () => {
    expect(spaceYieldsToTarget("preview", target("BUTTON", {}, true), true)).toBe(true);
  });

  it("keeps yielding a preview-page control when no dialog is open", () => {
    expect(spaceYieldsToTarget("preview", target("BUTTON"), false)).toBe(true);
  });

  it("treats an anchor without href as plain text", () => {
    expect(spaceYieldsToTarget("preview", target("A"))).toBe(false);
  });

  it("ignores an unknown role", () => {
    expect(spaceYieldsToTarget("preview", target("DIV", { role: "presentation" }))).toBe(false);
  });

  it("matches tag names in any case", () => {
    expect(spaceYieldsToTarget("preview", target("button"))).toBe(true);
  });

  it("does not yield a non-interactive element just because it sits in a dialog", () => {
    expect(spaceYieldsToTarget("study", target("DIV", {}, true))).toBe(false);
  });
});

describe("typedGiveUpApplies", () => {
  const base = { passKeys: ["arrowright"], key: "arrowright", inTextField: false, caretAtEnd: false };

  it("gives up on the pass key outside a text field", () => {
    expect(typedGiveUpApplies(base)).toBe(true);
  });

  it("ignores a key that is not a pass key", () => {
    expect(typedGiveUpApplies({ ...base, key: "arrowleft" })).toBe(false);
    expect(typedGiveUpApplies({ ...base, key: "x" })).toBe(false);
  });

  it("does not give up with the caret mid-text", () => {
    expect(typedGiveUpApplies({ ...base, inTextField: true, caretAtEnd: false })).toBe(false);
  });

  it("gives up with the caret at the end of the text", () => {
    expect(typedGiveUpApplies({ ...base, inTextField: true, caretAtEnd: true })).toBe(true);
  });

  it("treats a rebound letter as typing inside a box, even at the end", () => {
    const rebound = { ...base, passKeys: ["k"], key: "k" };
    expect(typedGiveUpApplies({ ...rebound, inTextField: true, caretAtEnd: true })).toBe(false);
    expect(typedGiveUpApplies({ ...rebound, inTextField: true, caretAtEnd: false })).toBe(false);
  });

  it("gives up on a rebound letter outside a box", () => {
    expect(typedGiveUpApplies({ passKeys: ["k"], key: "k", inTextField: false, caretAtEnd: false })).toBe(true);
  });

  it("follows an alternate pass key", () => {
    expect(typedGiveUpApplies({ passKeys: ["k", "arrowright"], key: "arrowright", inTextField: true, caretAtEnd: true })).toBe(true);
  });

  it("never gives up when Pass is unbound", () => {
    expect(typedGiveUpApplies({ passKeys: [], key: "arrowright", inTextField: false, caretAtEnd: true })).toBe(false);
  });
});
