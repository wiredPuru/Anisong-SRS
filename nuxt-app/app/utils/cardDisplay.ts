interface CardSources {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
}

const DAY_MS = 86_400_000;

/**
 * "Today" for anything due now or earlier, otherwise a relative day count.
 * Compared at day granularity so a card due in a few hours still reads "Today"
 * rather than "in 0d".
 */
export function dueLabel(card: { nextReviewAt: string }): string {
  const due = new Date(card.nextReviewAt).getTime();
  if (!Number.isFinite(due)) return "-";
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const days = Math.round((new Date(due).setHours(0, 0, 0, 0) - startOfToday) / DAY_MS);
  if (days <= 0) return "Today";
  return `in ${days}d`;
}

export function isDueNow(card: { nextReviewAt: string }): boolean {
  return new Date(card.nextReviewAt).getTime() <= Date.now();
}

/**
 * Compact chips for the table's narrow Sources column. Local wins over remote
 * for a kind the card has both ways, since local is what actually plays; a
 * trailing `*` marks a remote-only kind.
 */
export function compactSourceBadges(card: CardSources): string[] {
  const badges: string[] = [];
  if (card.localVideoPath) badges.push("VID");
  else if (card.animethemesVideoUrl) badges.push("VID*");
  if (card.localAudioPath) badges.push("AUD");
  else if (card.animethemesAudioUrl) badges.push("AUD*");
  return badges;
}

/** Full-wording source list for the inspector, which has room for it. */
export function sourceBadges(card: CardSources): string[] {
  const badges: string[] = [];
  if (card.localVideoPath) badges.push("Local video");
  if (card.localAudioPath) badges.push("Local audio");
  if (card.animethemesVideoUrl) badges.push("Remote video");
  if (card.animethemesAudioUrl) badges.push("Remote audio");
  return badges;
}
