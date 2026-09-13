import { describe, expect, it } from "vitest";
import {
  clampInspectorWidth,
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MIN_WIDTH,
} from "./paneWidth.ts";

describe("clampInspectorWidth", () => {
  it("keeps a width that fits", () => {
    expect(clampInspectorWidth(700, 2000)).toBe(700);
  });

  it("raises a width below the minimum", () => {
    expect(clampInspectorWidth(100, 2000)).toBe(INSPECTOR_MIN_WIDTH);
  });

  it("caps a width that would squeeze the list pane", () => {
    expect(clampInspectorWidth(1900, 2000)).toBe(1520);
  });

  it("falls back to the minimum when the container fits neither pane", () => {
    expect(clampInspectorWidth(600, 500)).toBe(INSPECTOR_MIN_WIDTH);
  });

  it("uses the default for a non-numeric stored value", () => {
    expect(clampInspectorWidth(Number.NaN, 2000)).toBe(INSPECTOR_DEFAULT_WIDTH);
  });

  it("rounds fractional pointer positions", () => {
    expect(clampInspectorWidth(500.6, 2000)).toBe(501);
  });
});
