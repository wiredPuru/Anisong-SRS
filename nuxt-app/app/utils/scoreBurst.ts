import type { BonusCategoryResult } from "./quizScore.ts";

export type ScoreBurstKind = "points" | "miss" | "combo" | "comboLost" | "bonus";

export interface ScoreBurst {
  id: number;
  kind: ScoreBurstKind;
  label: string;
  points: number;
  delayMs: number;
  /** True flies into the score chip; false fades where it appeared. */
  travels: boolean;
}

export interface GradedAnswer {
  result: "pass" | "fail";
  /** False when the user gave up rather than submitting a wrong answer. */
  answered: boolean;
  pointsAwarded: number;
  /** The combo after this answer, so a pass reads 1 on the first correct card. */
  combo: number;
  /** The combo before this answer, which is what a fail breaks. */
  previousCombo: number;
  bonusResults: BonusCategoryResult[];
}

export interface BurstRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const BONUS_LABELS: Record<BonusCategoryResult["category"], string> = {
  songName: "song name",
  themeSlot: "opening/ending",
  artist: "artist",
};

/** The combo tag and the frame shake start at different streak lengths so the
    feedback escalates rather than arriving all at once. */
export const COMBO_TAG_FROM = 2;
export const COMBO_SHAKE_FROM = 3;

const COMBO_TAG_DELAY_MS = 90;
const FIRST_BONUS_DELAY_MS = 640;
const BONUS_STAGGER_MS = 260;

/**
 * One graded answer to the bursts it should fire, in order. Delays are what
 * stagger them, so the layer can launch the whole plan at once and stay free
 * of its own timing rules.
 */
export function buildBurstPlan(grade: GradedAnswer): ScoreBurst[] {
  const bursts: ScoreBurst[] = [];
  let id = 0;
  const next = () => (id += 1);

  if (grade.result === "pass") {
    bursts.push({
      id: next(),
      kind: "points",
      label: `+${grade.pointsAwarded}`,
      points: grade.pointsAwarded,
      delayMs: 0,
      travels: true,
    });
    if (grade.combo >= COMBO_TAG_FROM) {
      bursts.push({
        id: next(),
        kind: "combo",
        label: `${grade.combo}x combo`,
        points: 0,
        delayMs: COMBO_TAG_DELAY_MS,
        travels: false,
      });
    }
  } else {
    bursts.push({
      id: next(),
      // Giving up is a choice, not a failure to name it, and the result panel
      // already draws that distinction ("Answer revealed" vs "Not quite").
      kind: "miss",
      label: grade.answered ? "Miss" : "Revealed",
      points: 0,
      delayMs: 0,
      travels: false,
    });
    if (grade.previousCombo > 0) {
      bursts.push({
        id: next(),
        kind: "comboLost",
        label: "Combo lost",
        points: 0,
        delayMs: COMBO_TAG_DELAY_MS,
        travels: false,
      });
    }
  }

  // A bonus is graded independently of the anime guess, so a scoring bonus
  // still bursts behind a miss.
  grade.bonusResults
    .filter((bonus) => bonus.pointsAwarded > 0)
    .forEach((bonus, index) => {
      bursts.push({
        id: next(),
        kind: "bonus",
        label: `+${bonus.pointsAwarded} ${BONUS_LABELS[bonus.category]}`,
        points: bonus.pointsAwarded,
        delayMs: FIRST_BONUS_DELAY_MS + index * BONUS_STAGGER_MS,
        travels: true,
      });
    });

  return bursts;
}

/** Centre-to-centre offset a travelling burst animates along. */
export function burstTravel(from: BurstRect, to: BurstRect): { dx: number; dy: number } {
  return {
    dx: to.left + to.width / 2 - (from.left + from.width / 2),
    dy: to.top + to.height / 2 - (from.top + from.height / 2),
  };
}
