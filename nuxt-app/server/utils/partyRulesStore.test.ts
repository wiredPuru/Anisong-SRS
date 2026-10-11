import { describe, expect, it } from "vitest";
import { loadSavedRules, storeSavedRules } from "./partyRulesStore.ts";

describe("saved rules", () => {
  it("starts empty, remembers the text, and replaces it", () => {
    expect(loadSavedRules()).toBe("");
    storeSavedRules("Buzz first.\nNo cheating.");
    expect(loadSavedRules()).toBe("Buzz first.\nNo cheating.");
    storeSavedRules("");
    expect(loadSavedRules()).toBe("");
  });
});
