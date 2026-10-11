import { THEME_TYPES, type ThemeType } from "./studyFilters.ts";

/** Relative weights per theme type: 70/30/0 means seven openings to three endings, no inserts. */
export type ThemeMix = Record<ThemeType, number>;

export function typeOfSlot(slot: string): ThemeType | null {
  const upper = slot.trim().toUpperCase();
  if (upper.startsWith("OP")) return "OP";
  if (upper.startsWith("ED")) return "ED";
  if (upper.startsWith("IN")) return "IN";
  return null;
}

/** A type with weight 0 is left out entirely, on top of any chosen theme types. */
export function effectiveThemeTypes(themeTypes: readonly ThemeType[], mix: ThemeMix | null): ThemeType[] {
  const chosen = themeTypes.length ? themeTypes : THEME_TYPES;
  if (!mix) return [...themeTypes];
  return chosen.filter((type) => mix[type] > 0);
}

/** Picks a type by weight among those that still have something to serve; null when none do. */
export function pickMixedType(
  mix: ThemeMix,
  available: ReadonlySet<ThemeType>,
  random: () => number = Math.random,
): ThemeType | null {
  const options = THEME_TYPES.filter((type) => available.has(type) && mix[type] > 0);
  const total = options.reduce((sum, type) => sum + mix[type], 0);
  if (!total) return null;
  let roll = random() * total;
  for (const type of options) {
    roll -= mix[type];
    if (roll < 0) return type;
  }
  return options[options.length - 1] ?? null;
}

/**
 * Reorders items so the stream follows the mix: each next item's type is drawn
 * by weight from the types with items left, keeping each type's own order.
 * Items of an unknown type, or of a weight-0 type, are dropped.
 */
export function orderByMix<T>(
  items: readonly T[],
  typeOf: (item: T) => ThemeType | null,
  mix: ThemeMix,
  random: () => number = Math.random,
): T[] {
  const queues = new Map<ThemeType, T[]>();
  for (const item of items) {
    const type = typeOf(item);
    if (!type || mix[type] <= 0) continue;
    queues.set(type, [...(queues.get(type) ?? []), item]);
  }
  const ordered: T[] = [];
  for (;;) {
    const available = new Set([...queues].filter(([, list]) => list.length > 0).map(([type]) => type));
    const type = pickMixedType(mix, available, random);
    if (!type) return ordered;
    ordered.push(queues.get(type)!.shift()!);
  }
}
