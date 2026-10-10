export const PREVIEW_LEADS = [1, 2, 3, 5] as const;
export const DEFAULT_PREVIEW_LEAD = 2;
// Closer than this, the preview is left to play on its own rather than jump.
export const PREVIEW_DRIFT_S = 0.5;
const END_MARGIN_S = 0.05;

export interface PreviewPosition {
  currentTime: number;
  duration: number | null;
  playing: boolean;
}

/**
 * Where the host's preview should be: the display's last reported time, moved
 * on by the time since that report while playing, plus the lead.
 */
export function previewTarget(position: PreviewPosition, receivedAt: number, now: number, lead: number): number {
  const sinceReport = position.playing ? Math.max(0, now - receivedAt) / 1000 : 0;
  const target = position.currentTime + sinceReport + lead;
  const end = position.duration !== null && position.duration > 0 ? position.duration - END_MARGIN_S : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(end, target));
}

export function previewNeedsSeek(actual: number, target: number): boolean {
  return Math.abs(actual - target) > PREVIEW_DRIFT_S;
}

export function parsePreviewLead(raw: string | null): number {
  const value = Number(raw);
  return (PREVIEW_LEADS as readonly number[]).includes(value) ? value : DEFAULT_PREVIEW_LEAD;
}
