import { describe, expect, it } from "vitest";
import { dominantTint, meanLuma, rgbVar, tintPalette, type Rgb } from "./ambientTint";

function pixels(...colors: Rgb[]): number[] {
  return colors.flatMap(([r, g, b]) => [r, g, b, 255]);
}

function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("dominantTint", () => {
  it("returns null for an empty or greyscale frame", () => {
    expect(dominantTint([])).toBeNull();
    expect(dominantTint(pixels([0, 0, 0], [128, 128, 128], [255, 255, 255]))).toBeNull();
  });

  it("ignores dark and washed-out pixels", () => {
    expect(dominantTint(pixels([20, 0, 0], [240, 230, 230], [40, 120, 220]))).toEqual([40, 120, 220]);
  });

  it("picks the hue with the most vivid weight, not the most pixels", () => {
    const dullRed = Array.from({ length: 3 }, (): Rgb => [150, 105, 105]);
    const vividBlue = Array.from({ length: 2 }, (): Rgb => [20, 60, 250]);
    expect(dominantTint(pixels(...dullRed, ...vividBlue))).toEqual([20, 60, 250]);
  });

  it("averages the winning hue group", () => {
    expect(dominantTint(pixels([200, 40, 40], [220, 60, 60]))).toEqual([210, 50, 50]);
  });
});

describe("tintPalette", () => {
  const hues: Rgb[] = [[111, 179, 230], [228, 139, 149], [140, 147, 234], [108, 197, 207], [230, 200, 40], [60, 160, 60], [255, 255, 120]];

  it("keeps ink readable on the light fill across hues", () => {
    for (const hue of hues) {
      const { light, ink } = tintPalette(hue);
      expect(contrast(light, ink)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps white readable on the deep fill across hues", () => {
    for (const hue of hues) {
      expect(contrast(tintPalette(hue).deep, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("rgbVar", () => {
  it("formats a colour for rgb(var(--x))", () => {
    expect(rgbVar([1, 2, 3])).toBe("1, 2, 3");
  });
});

describe("meanLuma", () => {
  it("is 0 for an empty or black frame and high for a bright one", () => {
    expect(meanLuma([])).toBe(0);
    expect(meanLuma(pixels([0, 0, 0], [4, 4, 4]))).toBeLessThan(5);
    expect(meanLuma(pixels([255, 255, 255]))).toBeCloseTo(255, 0);
  });
});
