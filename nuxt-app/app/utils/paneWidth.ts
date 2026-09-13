export const INSPECTOR_DEFAULT_WIDTH = 400;
export const INSPECTOR_MIN_WIDTH = 320;
export const LIST_PANE_MIN_WIDTH = 480;

/** Clamps a requested inspector width so both panes keep a usable size. */
export function clampInspectorWidth(requested: number, containerWidth: number): number {
  if (!Number.isFinite(requested)) return INSPECTOR_DEFAULT_WIDTH;
  // A container too narrow for both minimums still yields the inspector minimum
  // rather than a max below the min.
  const max = Math.max(INSPECTOR_MIN_WIDTH, containerWidth - LIST_PANE_MIN_WIDTH);
  return Math.round(Math.min(max, Math.max(INSPECTOR_MIN_WIDTH, requested)));
}
