export type Rgb = [number, number, number];

const HUE_BUCKETS = 24;
const MIN_SATURATION = 0.25;
const MIN_VALUE = 0.3;

function toHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return [hue / 360, max === 0 ? 0 : delta / max, max / 255];
}

/**
 * The most prominent vivid colour in RGBA pixel data: pixels are grouped by
 * hue, weighted by how saturated and bright they are, and the heaviest group
 * is averaged. A plain average would turn most frames muddy grey. Null when
 * the frame has no vivid colour at all (black, white, greyscale).
 */
export function dominantTint(data: ArrayLike<number>): Rgb | null {
  const weight = new Array<number>(HUE_BUCKETS).fill(0);
  const sums = Array.from({ length: HUE_BUCKETS }, () => [0, 0, 0, 0]);
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const [h, s, v] = toHsv(r, g, b);
    if (s < MIN_SATURATION || v < MIN_VALUE) continue;
    const bucket = Math.min(HUE_BUCKETS - 1, Math.floor(h * HUE_BUCKETS));
    weight[bucket]! += s * v;
    const sum = sums[bucket]!;
    sum[0]! += r;
    sum[1]! += g;
    sum[2]! += b;
    sum[3]! += 1;
  }
  let best = -1;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    if (weight[i]! > 0 && (best < 0 || weight[i]! > weight[best]!)) best = i;
  }
  if (best < 0) return null;
  const [r, g, b, n] = sums[best]!;
  return [Math.round(r! / n!), Math.round(g! / n!), Math.round(b! / n!)];
}

function mix(color: Rgb, target: number, amount: number): Rgb {
  return color.map((c) => Math.round(c + (target - c) * amount)) as Rgb;
}

/**
 * The tint's hue as a pastel fill with dark ink (dark theme), and as a deep
 * fill that takes white ink (light theme, where the accent is also text).
 */
export function tintPalette(color: Rgb): { light: Rgb; ink: Rgb; deep: Rgb } {
  return { light: mix(color, 255, 0.55), ink: mix(color, 0, 0.82), deep: mix(color, 0, 0.6) };
}

export function rgbVar(color: Rgb): string {
  return color.join(", ");
}

/** Mean brightness (0-255) of RGBA pixel data, to spot a black frame. */
export function meanLuma(data: ArrayLike<number>): number {
  let total = 0;
  let n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    total += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    n++;
  }
  return n === 0 ? 0 : total / n;
}
