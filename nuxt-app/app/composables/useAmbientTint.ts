import { rgbVar, tintPalette, type Rgb } from "~/utils/ambientTint";

/** CSS variables that recolour accents from a clip; main.css reads them under [data-ambient-tint]. */
export function tintStyle(color: Rgb): Record<string, string> {
  const { light, ink, deep } = tintPalette(color);
  return { "--amb-rgb": rgbVar(color), "--amb-light": rgbVar(light), "--amb-ink": rgbVar(ink), "--amb-deep": rgbVar(deep) };
}

export function useAmbientTint() {
  function setTint(color: Rgb | null) {
    if (!import.meta.client) return;
    const root = document.documentElement;
    if (!color) {
      root.removeAttribute("data-ambient-tint");
      for (const name of ["--amb-rgb", "--amb-light", "--amb-ink", "--amb-deep"]) root.style.removeProperty(name);
      return;
    }
    for (const [name, value] of Object.entries(tintStyle(color))) root.style.setProperty(name, value);
    root.setAttribute("data-ambient-tint", "true");
  }

  return { setTint };
}
