export type ColumnShares = [number, number, number];

export const DEFAULT_COLUMN_SHARES: ColumnShares = [1 / 3, 1 / 3, 1 / 3];
export const MIN_HOST_COLUMN_PX = 260;

function isShares(value: unknown): value is ColumnShares {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
}

function normalize(shares: ColumnShares): ColumnShares {
  const total = shares[0] + shares[1] + shares[2];
  return [shares[0] / total, shares[1] / total, shares[2] / total];
}

/** A stored layout is only a hint: anything but three positive numbers means equal columns. */
export function parseStoredShares(raw: string | null): ColumnShares {
  if (!raw) return [...DEFAULT_COLUMN_SHARES];
  try {
    const value: unknown = JSON.parse(raw);
    return isShares(value) ? normalize(value) : [...DEFAULT_COLUMN_SHARES];
  } catch {
    return [...DEFAULT_COLUMN_SHARES];
  }
}

/** Keeps every column at least the minimum width; equal columns when the area cannot fit three. */
export function clampShares(shares: ColumnShares, areaWidth: number): ColumnShares {
  if (!isShares(shares) || !(areaWidth >= MIN_HOST_COLUMN_PX * 3)) return [...DEFAULT_COLUMN_SHARES];
  const min = MIN_HOST_COLUMN_PX / areaWidth;
  const raised = normalize(shares).map((share) => Math.max(min, share));
  // Raising a narrow column takes the extra from the others in proportion to their slack.
  const excess = raised.reduce((sum, share) => sum + share, 0) - 1;
  const slack = raised.reduce((sum, share) => sum + (share - min), 0);
  return raised.map((share) => share - (slack > 0 ? (excess * (share - min)) / slack : 0)) as ColumnShares;
}

/**
 * Moves the divider after column `divider` (0 or 1) to `x`, measured in pixels
 * from the left of the column area. Only the two neighbouring columns change.
 */
export function moveDivider(shares: ColumnShares, divider: 0 | 1, x: number, areaWidth: number): ColumnShares {
  if (!(areaWidth >= MIN_HOST_COLUMN_PX * 3) || !Number.isFinite(x)) return shares;
  const min = MIN_HOST_COLUMN_PX / areaWidth;
  const start = divider === 0 ? 0 : shares[0];
  const pairTotal = shares[divider] + shares[divider + 1]!;
  const left = Math.min(pairTotal - min, Math.max(min, x / areaWidth - start));
  const next: ColumnShares = [...shares];
  next[divider] = left;
  next[divider + 1] = pairTotal - left;
  return next;
}
