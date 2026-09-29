import type { PartyPlayer, PartyRoundPoint } from "~/composables/usePartyDisplay";

/** How long the display waits for score changes to stop before showing them. */
export const SCORE_SETTLE_MS = 2000;

/** The score-bearing slice of the display state that settles as one. */
export interface PartyScoreView {
  token: string | null;
  roundPoints: PartyRoundPoint[];
  scoreboard: PartyPlayer[] | null;
}

const pointsOf = (view: PartyScoreView) => new Map(view.roundPoints.map((row) => [row.id, row.points]));

function sameRoundPoints(a: PartyScoreView, b: PartyScoreView): boolean {
  const before = pointsOf(a);
  return a.roundPoints.length === b.roundPoints.length && b.roundPoints.every((row) => before.get(row.id) === row.points);
}

function sameScores(a: PartyPlayer[], b: PartyPlayer[]): boolean {
  const before = new Map(a.map((p) => [p.id, p.score]));
  return b.every((p) => !before.has(p.id) || before.get(p.id) === p.score);
}

/**
 * Whether `next` should wait out the settle delay: only a score change on the
 * same song does. A new song, the scoreboard being shown or hidden, or a
 * rename or join alone shows at once.
 */
export function needsSettle(shown: PartyScoreView, next: PartyScoreView): boolean {
  if (shown.token !== next.token) return false;
  if ((shown.scoreboard === null) !== (next.scoreboard === null)) return false;
  if (!sameRoundPoints(shown, next)) return true;
  return shown.scoreboard !== null && next.scoreboard !== null && !sameScores(shown.scoreboard, next.scoreboard);
}

/** Each player's rise in round points from `shown` to `next` on the same song. */
export function scorePops(shown: PartyScoreView, next: PartyScoreView): PartyRoundPoint[] {
  if (shown.token !== next.token) return [];
  const before = pointsOf(shown);
  return next.roundPoints
    .map((row) => ({ ...row, points: row.points - (before.get(row.id) ?? 0) }))
    .filter((row) => row.points > 0);
}
